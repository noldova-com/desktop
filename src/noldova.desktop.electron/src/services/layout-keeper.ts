/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Failure, FailureCode, Response, ShellMethods, WindowStateKey, WindowStateValue, WindowStateWrite } from "@noldova/desktop.protocol";

import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import type { KnownDevice } from "../models/known-device.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import type { RuntimeCaller } from "./runtime-caller.js";
import { RuntimeRequests } from "./runtime-requests.js";

export class LayoutKeeper {
  private readonly windows: WindowRegistry;
  private readonly runtime: RuntimeCaller;
  private readonly device: KnownDevice;
  private readonly log: (text: string) => void;
  private written: Promise<void> = Promise.resolve();
  private failure: string | null = null;

  public constructor(windows: WindowRegistry, runtime: RuntimeCaller, device: KnownDevice, log: (text: string) => void) {
    this.windows = windows;
    this.runtime = runtime;
    this.device = device;
    this.log = log;
  }

  public async readAsync(event: IIpcEvent): Promise<JsonObject> {
    if (Object.isNull(this.windows.findTrusted(event)))
      return RuntimeRequests.fail(FailureCode.Unauthorized, Resources.untrustedRequest);
    await this.written;
    if (!Object.isNull(this.failure))
      this.log(Resources.formatLayoutReadAfterFailedWrite(this.failure));
    this.failure = null;
    const device = await this.device.readAsync();
    if (Object.isNull(device))
      return RuntimeRequests.fail(FailureCode.Unavailable, Resources.deviceNotIdentified);
    const response = await this.runtime.callAsync(ShellMethods.readWindowLayout, new WindowStateKey(device, Resources.mainWindow).toJson());
    return response.hasFailed ? response.toJson() : { [Resources.payloadField]: WindowStateValue.fromJson(response.payload).value };
  }

  public writeAsync(event: IIpcEvent, layout: unknown): Promise<JsonObject> {
    if (Object.isNull(this.windows.findTrusted(event)))
      return Promise.resolve(RuntimeRequests.fail(FailureCode.Unauthorized, Resources.untrustedRequest));
    const value = LayoutKeeper.readLayout(layout);
    if (Object.isUndefined(value))
      return Promise.resolve(RuntimeRequests.fail(FailureCode.InvalidMessage, Resources.layoutNotObject));
    const write = this.written.then(() => this.keepAsync(value));
    this.written = write.then(() => undefined, (error: unknown) => {
      this.failure = String(error);
    });
    return write;
  }

  private async keepAsync(value: JsonObject): Promise<JsonObject> {
    const device = await this.device.readAsync();
    const response = Object.isNull(device) ? Response.failure(null, new Failure(FailureCode.Unavailable, Resources.deviceNotIdentified))
      : await this.runtime.callAsync(ShellMethods.writeWindowLayout, new WindowStateWrite(new WindowStateKey(device, Resources.mainWindow), value).toJson());
    this.failure = response.failure?.message ?? null;
    return response.hasFailed ? response.toJson() : { [Resources.payloadField]: null };
  }

  private static readLayout(layout: unknown): JsonObject | undefined {
    try {
      return JsonReader.fromValue(layout).toJson();
    }
    catch {
      return undefined;
    }
  }
}
