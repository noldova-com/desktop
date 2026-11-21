/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, execFile } from "node:child_process";

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class ProcessTree {
  private readonly platform: string;
  private readonly kill: (processId: number, signal: NodeJS.Signals) => void;
  private readonly run: (command: string, commandArguments: readonly string[], options: { readonly windowsHide: boolean }, callback: () => void) => unknown;

  public constructor(platform: string = process.platform, kill: (processId: number, signal: NodeJS.Signals) => void = process.kill,
    run: (command: string, commandArguments: readonly string[], options: { readonly windowsHide: boolean }, callback: () => void) => unknown = execFile) {
    this.platform = platform;
    this.kill = kill;
    this.run = run;
  }

  public get isGrouped(): boolean {
    return this.platform !== Resources.windowsPlatform;
  }

  public end(child: Pick<ChildProcess, "pid">): void {
    const processId = child.pid;
    if (Object.isUndefined(processId))
      return;
    if (this.isGrouped)
      this.killGroup(processId);
    else
      this.run(Resources.taskkillCommand, [Resources.taskkillProcessOption, String(processId), ...Resources.taskkillTreeOptions], { windowsHide: true }, () => undefined);
  }

  public whenEnded(child: ChildProcess, settle: () => void): void {
    if (Object.isNull(child.exitCode) && Object.isNull(child.signalCode))
      child.once(Resources.exitEvent, settle);
    else
      settle();
  }

  private killGroup(processId: number): void {
    try {
      this.kill(-processId, Resources.killSignal);
    }
    catch (error) {
      if (!(error instanceof Error && Resources.errorCodeField in error && error[Resources.errorCodeField] === Resources.missingProcessCode))
        throw error;
    }
  }
}
