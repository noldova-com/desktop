/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild, ShellSettings, type UpdateBarrierStatus } from "@noldova/desktop.runtime";

import type { IMainProcessOptions } from "../interfaces/i-main-process-options.js";
import type { IMainProcessUpdateParts } from "../interfaces/i-main-process-update-parts.js";
import { Resources } from "../resources.js";
import { DeviceSettingFollower } from "./device-setting-follower.js";
import type { MainProcessLog } from "./main-process-log.js";
import { UpdateBarrierGate } from "./update-barrier-gate.js";
import { UpdateBarrierWatch } from "./update-barrier-watch.js";
import { UpdateBridge } from "./update-bridge.js";
import { UpdateController } from "./update-controller.js";
import { UpdateRestart } from "./update-restart.js";

export class MainProcessUpdates {
  public readonly checks: DeviceSettingFollower;
  public readonly bridge: UpdateBridge;
  public readonly restart: UpdateRestart;
  private readonly gate: UpdateBarrierGate;
  private readonly watch: UpdateBarrierWatch;
  private readonly log: MainProcessLog;

  public constructor(options: IMainProcessOptions, parts: IMainProcessUpdateParts) {
    const { electron, process, installation, log } = options;
    const setup = options.updater.setup;
    this.log = log;
    this.gate = new UpdateBarrierGate(installation, RuntimeBuild.identity.productVersion, electron.dialog, t => log.write(t));
    this.watch = new UpdateBarrierWatch(parts.host, installation.folder, () => !Object.isNull(parts.startup.connection), () => parts.startup.barrierChanged(), t => log.write(t));
    const updates = Object.isNull(setup) ? null : new UpdateController(setup.updater, options.createDeviceFile(installation.folder, Resources.updateReadyFile), options.updateLock,
      RuntimeBuild.identity.productVersion, process.platform === Resources.macPlatform && !electron.app.isInApplicationsFolder(), setup.handoff.refusal, t => this.bridge.publish(t), t => this.bridge.postReadyAsync(t),
      t => log.write(t), Date.now, (wait, run) => UpdateBridge.schedule(wait, run), t => this.restart.restartAsync(t, setup.handoff));
    this.checks = new DeviceSettingFollower(ShellSettings.updateChecks, Resources.automaticUpdateChecks, t => parts.runtime.callAsync(ShellMethods.readSetting, t.toJson()),
      t => this.bridge.followSetting(t), t => log.write(t));
    this.bridge = new UpdateBridge(updates, setup?.handoff ?? null, options.updater.status, this.checks, parts.deviceState, parts.tray, parts.windows, parts.runtime, parts.device, t => log.write(t));
    this.restart = new UpdateRestart(electron.app, electron.nativeUpdater, electron.dialog, process, options.dataDirectory.logsFolder, parts.launchArguments,
      parts.handoverFolders, options.restartArguments, installation, options.presence, options.connector, parts.windows, parts.phase, () => parts.findPromptAsync(), () => parts.host.quit(),
      t => log.write(t));
  }

  public passAsync(): Promise<boolean> {
    return this.passBarrierAsync(() => this.gate.passAsync());
  }

  public askAsync(status: UpdateBarrierStatus): Promise<boolean> {
    return this.passBarrierAsync(() => this.gate.askAsync(status));
  }

  public start(state: JsonObject): void {
    const updateChecks = state[Resources.updateChecksStateKey];
    if (Object.isString(updateChecks))
      this.checks.startFrom(updateChecks);
    this.watch.start();
    this.bridge.start();
  }

  public connect(): void {
    void this.bridge.refreshAsync();
  }

  public disconnect(): void {
    void this.watch.checkAsync();
  }

  public stop(): void {
    this.watch.stop();
    this.bridge.stop();
  }

  private async passBarrierAsync(pass: () => Promise<boolean>): Promise<boolean> {
    try {
      return await pass();
    }
    catch (error) {
      this.log.write(Resources.formatBarrierUnsettled(String(error)));
      return false;
    }
  }
}
