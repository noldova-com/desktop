/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { RuntimeException } from "../exceptions/runtime.exception.js";
import type { IPseudoTerminalHandle } from "../interfaces/i-pseudo-terminal-handle.js";
import { Resources } from "../resources.js";

export class PseudoTerminalConsole {
  private readonly handle: IPseudoTerminalHandle;
  private readonly isWindows: boolean;
  private isClosed: boolean = false;

  public constructor(handle: IPseudoTerminalHandle, platform: string) {
    this.handle = handle;
    this.isWindows = platform === Resources.windowsPlatform;
  }

  public close(): void {
    if (this.isClosed)
      return;
    this.isClosed = true;
    this.handle.kill();
  }

  public async stopOutputWorkerAsync(): Promise<void> {
    const handle = this.handle;
    if (!this.isWindows && !(Resources.pseudoTerminalAgent in handle))
      return;
    const agent: unknown = Resources.pseudoTerminalAgent in handle ? handle[Resources.pseudoTerminalAgent] : undefined;
    const output: unknown = Object.isObject(agent) && Resources.pseudoTerminalOutputWorker in agent ? agent[Resources.pseudoTerminalOutputWorker] : undefined;
    const worker: unknown = Object.isObject(output) && Resources.pseudoTerminalWorker in output ? output[Resources.pseudoTerminalWorker] : undefined;
    const stop: unknown = Object.isObject(worker) && Resources.pseudoTerminalWorkerStop in worker ? worker[Resources.pseudoTerminalWorkerStop] : undefined;
    if (!PseudoTerminalConsole.isStop(stop))
      throw new RuntimeException(Resources.formatPseudoTerminalMemberMissing(
        Resources.pseudoTerminalAgent, Resources.pseudoTerminalOutputWorker, Resources.pseudoTerminalWorker, Resources.pseudoTerminalWorkerStop));
    await stop.call(worker);
  }

  private static isStop(value: unknown): value is () => unknown {
    return Object.isFunction(value);
  }
}
