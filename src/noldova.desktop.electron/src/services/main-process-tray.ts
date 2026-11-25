/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { ShellMethods } from "@noldova/desktop.protocol";
import { ShellSettings } from "@noldova/desktop.runtime";

import type { IMainProcessOptions } from "../interfaces/i-main-process-options.js";
import type { IMainProcessTrayParts } from "../interfaces/i-main-process-tray-parts.js";
import { Resources } from "../resources.js";
import { DeviceSettingFollower } from "./device-setting-follower.js";
import type { DeviceState } from "./device-state.js";
import { StopKeyController } from "./stop-key-controller.js";
import { TrayController } from "./tray-controller.js";
import { TrayHostWatcher } from "./tray-host-watcher.js";
import { TrayNotices } from "./tray-notices.js";
import { TrayRefresher } from "./tray-refresher.js";

export class MainProcessTray {
  public readonly tray: TrayController;
  public readonly hosts: TrayHostWatcher;
  public readonly icon: DeviceSettingFollower;
  public readonly stopKey: StopKeyController;
  private readonly notices: TrayNotices;
  private readonly refresher: TrayRefresher;
  private readonly deviceState: DeviceState;

  public constructor(options: IMainProcessOptions, parts: IMainProcessTrayParts) {
    const { electron, process, icons, log } = options;
    this.deviceState = parts.deviceState;
    this.notices = new TrayNotices(electron.notifications, options.settings.platform, icons, () => parts.open(), t => log.write(t));
    this.tray = new TrayController(electron.tray, electron.menu, icons, process.platform,
      { open: () => parts.open(), openNotification: t => parts.openNotification(t), setDoNotDisturb: t => void this.refresher.setDoNotDisturbAsync(t), stopAgents: () => parts.stopAgents(),
        resumeAgents: () => parts.resumeAgents(), restartToUpdate: () => parts.restartToUpdate(), quit: () => parts.quit(), runCommand: t => parts.runCommand(t) },
      options.tray ?? Resources.defaultTrayItems, t => log.write(t),
      t => parts.followTrayIcon(t));
    if (process.platform !== Resources.macPlatform)
      electron.theme.on(Resources.themeUpdatedEvent, () => this.tray.followTheme());
    this.hosts = new TrayHostWatcher(process.platform, process.programs, process.env, t => delay(t, undefined, { ref: false }), t => this.refresher.changeHost(t));
    this.icon = new DeviceSettingFollower(ShellSettings.trayIcon, process.platform !== Resources.macPlatform, t => parts.runtime.callAsync(ShellMethods.readSetting, t.toJson()),
      t => this.refresher.followTrayIconSetting(t), t => log.write(t));
    this.refresher = new TrayRefresher(this.tray, this.icon, parts.deviceState, parts.windows, parts.runtime, parts.device, parts.notifier, t => log.write(t));
    this.stopKey = new StopKeyController(electron.shortcuts, process.platform, () => parts.stopAgents(), t => this.notices.showStopKeyNotice(t),
      () => this.tray.setRefusedKey(this.stopKey.refused?.label(process.platform) ?? null), t => log.write(t), this.tray.claimsStopKey);
  }

  public start(state: JsonObject): void {
    const trayIcon = state[Resources.trayIconStateKey];
    if (Object.isBoolean(trayIcon))
      this.icon.startFrom(trayIcon);
    this.tray.setHostAvailable(this.hosts.isAvailable);
    this.tray.setEnabled(this.icon.value === true);
    this.hosts.start();
  }

  public connect(): void {
    void this.refresher.refreshAsync();
  }

  public disconnect(): void {
    this.tray.clear();
  }

  public showCloseHint(): void {
    void this.deviceState.showOnceAsync(Resources.trayCloseHintKey, () => this.notices.showCloseHintAsync());
  }

  public release(): void {
    this.hosts.stop();
    this.tray.dispose();
    this.notices.close();
    this.stopKey.dispose();
  }
}
