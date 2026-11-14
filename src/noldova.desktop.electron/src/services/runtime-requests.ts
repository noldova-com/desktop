/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { Failure, FailureCode, NotificationState, NotificationsQuery, QualifiedName, Response, ShellMethods } from "@noldova/desktop.protocol";

import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import type { KnownDevice } from "../models/known-device.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import type { RuntimeCaller } from "./runtime-caller.js";
import type { SystemNotifier } from "./system-notifier.js";

export class RuntimeRequests {
  private readonly windows: WindowRegistry;
  private readonly runtime: RuntimeCaller;
  private readonly device: KnownDevice;
  private readonly notifier: SystemNotifier;
  private readonly log: (text: string) => void;

  public constructor(windows: WindowRegistry, runtime: RuntimeCaller, device: KnownDevice, notifier: SystemNotifier, log: (text: string) => void) {
    this.windows = windows;
    this.runtime = runtime;
    this.device = device;
    this.notifier = notifier;
    this.log = log;
  }

  public static fail(code: FailureCode, message: string): JsonObject {
    return Response.failure(null, new Failure(code, message)).toJson();
  }

  public async requestAsync(event: IIpcEvent, method: unknown, payload: unknown, page: unknown): Promise<JsonObject> {
    if (Object.isNull(this.windows.findTrusted(event)))
      return RuntimeRequests.fail(FailureCode.Unauthorized, Resources.untrustedRequest);
    const name = RuntimeRequests.readMethod(method);
    if (Object.isNull(name))
      return RuntimeRequests.fail(FailureCode.InvalidMessage, Resources.methodNotText);
    const value = RuntimeRequests.readPayload(payload);
    if (Object.isUndefined(value))
      return RuntimeRequests.fail(FailureCode.InvalidMessage, Resources.payloadNotJson);
    if (name.owner === Resources.shellOwner && !Resources.windowShellMethods.includes(name.text))
      return RuntimeRequests.fail(FailureCode.Unauthorized, Resources.formatMethodRefused(name.text));
    if (name.text === ShellMethods.notifications.text)
      return await this.readNotificationsAsync(name);
    if (Resources.deviceMethods.includes(name.text))
      return await this.requestForDeviceAsync(name, value);
    const current = this.windows.pageOf(event.sender.id, page);
    return (await this.runtime.callAsync(name, value, event.sender.id, current?.signal ?? AbortSignal.abort(), current?.serial)).toJson();
  }

  private async requestForDeviceAsync(name: QualifiedName, value: JsonValue): Promise<JsonObject> {
    if (!Object.isObject(value) || Array.isArray(value))
      return RuntimeRequests.fail(FailureCode.InvalidMessage, Resources.deviceRequestPayloadNotObject);
    const device = await this.device.readAsync();
    if (Object.isNull(device))
      return RuntimeRequests.fail(FailureCode.Unavailable, Resources.deviceRequestNeedsIdentity);
    return (await this.runtime.callAsync(name, { ...value, [Resources.deviceField]: device })).toJson();
  }

  private async readNotificationsAsync(name: QualifiedName): Promise<JsonObject> {
    const epoch = this.notifier.epoch;
    const device = await this.device.readAsync();
    if (Object.isNull(device))
      return RuntimeRequests.fail(FailureCode.Unavailable, Resources.deviceNotIdentified);
    const response = await this.runtime.callAsync(name, new NotificationsQuery(device).toJson());
    this.beginNotifier(epoch, device, response);
    return response.toJson();
  }

  private beginNotifier(epoch: number, device: string, response: Response): void {
    if (response.hasFailed)
      return;
    try {
      this.notifier.begin(epoch, device, NotificationState.fromJson(response.payload).sequence);
    }
    catch (error) {
      this.log(Resources.formatNotificationsNotRead(String(error)));
    }
  }

  private static readMethod(method: unknown): QualifiedName | null {
    if (!Object.isString(method))
      return null;
    try {
      return QualifiedName.parse(method, Resources.methodParameter);
    }
    catch {
      return null;
    }
  }

  private static readPayload(payload: unknown): JsonValue | undefined {
    try {
      return JsonReader.toJsonValue(payload);
    }
    catch {
      return undefined;
    }
  }
}
