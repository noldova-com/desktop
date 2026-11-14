/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { FailureCode, ShellMethods, WindowStateKey, WindowStateValue, WindowStateWrite } from "@noldova/desktop.protocol";

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

  public constructor(windows: WindowRegistry, runtime: RuntimeCaller, device: KnownDevice) {
    this.windows = windows;
    this.runtime = runtime;
    this.device = device;
  }

  public async readAsync(event: IIpcEvent): Promise<JsonObject> {
    if (Object.isNull(this.windows.findTrusted(event)))
      return RuntimeRequests.fail(FailureCode.Unauthorized, Resources.untrustedRequest);
    const device = await this.device.readAsync();
    if (Object.isNull(device))
      return RuntimeRequests.fail(FailureCode.Unavailable, Resources.deviceNotIdentified);
    const response = await this.runtime.callAsync(ShellMethods.readWindowLayout, new WindowStateKey(device, Resources.mainWindow).toJson());
    return response.hasFailed ? response.toJson() : { [Resources.payloadField]: WindowStateValue.fromJson(response.payload).value };
  }

  public async writeAsync(event: IIpcEvent, layout: unknown): Promise<JsonObject> {
    if (Object.isNull(this.windows.findTrusted(event)))
      return RuntimeRequests.fail(FailureCode.Unauthorized, Resources.untrustedRequest);
    const value = LayoutKeeper.readLayout(layout);
    if (Object.isUndefined(value))
      return RuntimeRequests.fail(FailureCode.InvalidMessage, Resources.layoutNotObject);
    const device = await this.device.readAsync();
    if (Object.isNull(device))
      return RuntimeRequests.fail(FailureCode.Unavailable, Resources.deviceNotIdentified);
    const response = await this.runtime.callAsync(ShellMethods.writeWindowLayout, new WindowStateWrite(new WindowStateKey(device, Resources.mainWindow), value).toJson());
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
