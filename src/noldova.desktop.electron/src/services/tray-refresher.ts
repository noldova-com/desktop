/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Failure, FailureCode, NotificationState, NotificationsQuery, SettingKey, SettingValue, ShellMethods, WorkReport } from "@noldova/desktop.protocol";
import { ShellSettings } from "@noldova/desktop.runtime";

import type { KnownDevice } from "../models/known-device.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import type { DeviceSettingFollower } from "./device-setting-follower.js";
import type { DeviceState } from "./device-state.js";
import type { RuntimeCaller } from "./runtime-caller.js";
import type { SystemNotifier } from "./system-notifier.js";
import type { TrayController } from "./tray-controller.js";

export class TrayRefresher {
  private readonly tray: TrayController;
  private readonly trayIcon: DeviceSettingFollower;
  private readonly deviceState: DeviceState;
  private readonly windows: WindowRegistry;
  private readonly runtime: RuntimeCaller;
  private readonly device: KnownDevice;
  private readonly notifier: SystemNotifier;
  private readonly log: (text: string) => void;

  public constructor(tray: TrayController, trayIcon: DeviceSettingFollower, deviceState: DeviceState, windows: WindowRegistry, runtime: RuntimeCaller, device: KnownDevice, notifier: SystemNotifier,
    log: (text: string) => void) {
    this.tray = tray;
    this.trayIcon = trayIcon;
    this.deviceState = deviceState;
    this.windows = windows;
    this.runtime = runtime;
    this.device = device;
    this.notifier = notifier;
    this.log = log;
  }

  public async refreshAsync(): Promise<void> {
    const epoch = this.notifier.epoch;
    const device = await this.device.readAsync();
    if (Object.isNull(device))
      return;
    const [work, notifications] = await Promise.all([
      this.runtime.callAsync(ShellMethods.work, null),
      this.runtime.callAsync(ShellMethods.notifications, new NotificationsQuery(device).toJson()),
      this.trayIcon.refreshAsync(device)
    ]);
    if (epoch !== this.notifier.epoch)
      return;
    try {
      if (!work.hasFailed)
        this.tray.receiveWork(WorkReport.fromJson(work.payload));
      if (!notifications.hasFailed)
        this.tray.receiveNotifications(NotificationState.fromJson(notifications.payload));
    }
    catch (error) {
      this.log(Resources.formatTrayStateNotRead(String(error)));
    }
  }

  public async setDoNotDisturbAsync(isOn: boolean): Promise<void> {
    const device = await this.device.readAsync();
    const failure = Object.isNull(device)
      ? new Failure(FailureCode.Unavailable, Resources.deviceNotIdentified)
      : (await this.runtime.callAsync(ShellMethods.setSetting, new SettingValue(new SettingKey(ShellSettings.doNotDisturb, null, device), isOn).toJson())).failure;
    if (Object.isUndefined(failure))
      return;
    this.log(Resources.formatDoNotDisturbNotSet(failure.message));
    this.tray.rebuildMenu();
  }

  public followTrayIconSetting(value: JsonValue): void {
    this.tray.setEnabled(value === true);
    void this.deviceState.rememberAsync(Resources.trayIconStateKey, value);
  }

  public changeHost(isAvailable: boolean): void {
    this.tray.setHostAvailable(isAvailable);
    this.windows.sendToAll(Resources.trayAvailableChannel, isAvailable);
  }
}
