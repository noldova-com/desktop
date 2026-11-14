/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { CommandRun, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName, ShellMethods, ShellNotifications } from "@noldova/desktop.protocol";

import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { KnownDevice } from "../models/known-device.js";
import type { UpdateStatus } from "../models/update-status.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import type { DeviceSettingFollower } from "./device-setting-follower.js";
import type { DeviceState } from "./device-state.js";
import type { RuntimeCaller } from "./runtime-caller.js";
import type { TrayController } from "./tray-controller.js";
import type { UpdateController } from "./update-controller.js";

export class UpdateBridge {
  private readonly updates: UpdateController | null;
  private readonly handoff: IUpdateHandoff | null;
  private readonly updatesOff: UpdateStatus;
  private readonly updateChecks: DeviceSettingFollower;
  private readonly deviceState: DeviceState;
  private readonly tray: TrayController;
  private readonly windows: WindowRegistry;
  private readonly runtime: RuntimeCaller;
  private readonly device: KnownDevice;
  private readonly log: (text: string) => void;
  private started: Promise<void>;

  public constructor(updates: UpdateController | null, handoff: IUpdateHandoff | null, updatesOff: UpdateStatus, updateChecks: DeviceSettingFollower, deviceState: DeviceState, tray: TrayController,
    windows: WindowRegistry, runtime: RuntimeCaller, device: KnownDevice, log: (text: string) => void) {
    this.updates = updates;
    this.handoff = handoff;
    this.updatesOff = updatesOff;
    this.updateChecks = updateChecks;
    this.deviceState = deviceState;
    this.tray = tray;
    this.windows = windows;
    this.runtime = runtime;
    this.device = device;
    this.log = log;
    this.started = Promise.resolve();
  }

  public get status(): UpdateStatus {
    return this.updates?.status ?? this.updatesOff;
  }

  public static schedule(wait: number, run: () => void): () => void {
    const timer = setTimeout(run, wait);
    timer.unref();
    return () => clearTimeout(timer);
  }

  public act(action: unknown): boolean {
    return this.updates?.act(action) === true;
  }

  public start(): void {
    if (!Object.isNull(this.updates))
      this.started = this.startAsync(this.updates);
  }

  public stop(): void {
    this.updates?.stop();
  }

  public followSetting(value: JsonValue): void {
    this.updates?.follow(value);
    void this.deviceState.rememberAsync(Resources.updateChecksStateKey, value);
  }

  public async refreshAsync(): Promise<void> {
    const updates = this.updates;
    if (Object.isNull(updates))
      return;
    const device = await this.device.readAsync();
    if (!Object.isNull(device))
      await this.updateChecks.refreshAsync(device);
    await this.started;
    await updates.notifyAsync();
  }

  public publish(status: UpdateStatus): void {
    this.tray.receiveUpdate(status);
    this.windows.sendToAll(Resources.updateStateChannel, status.toJson());
  }

  public async postReadyAsync(version: string): Promise<boolean> {
    const restart = new CommandRun(new QualifiedName(ShellNotifications.updateReady.owner, Resources.restartToUpdateMember), null);
    const post = new NotificationPost(ShellNotifications.updateReady, version, Resources.formatUpdateReadyTitle(version), null, NotificationSeverity.Info, null,
      [new NotificationAction(Resources.restartToUpdateTitle, restart)], null);
    const failure = (await this.runtime.callAsync(ShellMethods.postNotification, post.toJson())).failure;
    if (!Object.isUndefined(failure))
      this.log(Resources.formatUpdateNotPosted(failure.message));
    return Object.isUndefined(failure);
  }

  private async startAsync(updates: UpdateController): Promise<void> {
    await this.handoff?.clearAsync();
    updates.follow(this.updateChecks.value);
    await updates.startAsync();
  }
}
