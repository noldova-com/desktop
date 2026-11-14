/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { AgentControlState, CommandRun, type QualifiedName, ShellMethods } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";
import type { DeviceSettingFollower } from "./device-setting-follower.js";
import type { RuntimeCaller } from "./runtime-caller.js";
import type { StopKeyController } from "./stop-key-controller.js";
import type { TrayController } from "./tray-controller.js";

export class AgentController {
  private readonly runtime: RuntimeCaller;
  private readonly stopKey: StopKeyController;
  private readonly tray: TrayController;
  private readonly keyBindings: DeviceSettingFollower;
  private readonly log: (text: string) => void;
  private epoch: number;

  public constructor(runtime: RuntimeCaller, stopKey: StopKeyController, tray: TrayController, keyBindings: DeviceSettingFollower, log: (text: string) => void) {
    this.runtime = runtime;
    this.stopKey = stopKey;
    this.tray = tray;
    this.keyBindings = keyBindings;
    this.log = log;
    this.epoch = 0;
  }

  public async refreshAsync(): Promise<void> {
    const epoch = ++this.epoch;
    const [control] = await Promise.all([this.runtime.callAsync(ShellMethods.agentControl, null), this.keyBindings.refreshAsync(null)]);
    if (epoch !== this.epoch)
      return;
    const failure = control.failure;
    if (Object.isUndefined(failure))
      this.receive(control.payload);
    else
      this.log(Resources.formatAgentControlNotRead(failure.message));
  }

  public receiveChange(payload: unknown): void {
    this.epoch++;
    this.receive(payload);
  }

  public disconnect(): void {
    this.epoch++;
    this.stopKey.receiveActing(false);
  }

  public async runCommandAsync(command: QualifiedName): Promise<void> {
    const failure = (await this.runtime.callAsync(ShellMethods.runCommand, new CommandRun(command, null).toJson())).failure;
    if (!Object.isUndefined(failure))
      this.log(Resources.formatAgentCommandFailed(command.text, failure.message));
  }

  private receive(payload: unknown): void {
    try {
      const state = AgentControlState.fromJson(payload);
      this.stopKey.receiveActing(state.isActing);
      this.tray.receiveAgentControl(state);
    }
    catch (error) {
      this.log(Resources.formatAgentControlNotRead(String(error)));
    }
  }
}
