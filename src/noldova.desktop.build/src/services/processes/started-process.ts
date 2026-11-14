/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcess } from "node:child_process";
import { clearTimeout, setTimeout } from "node:timers";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class StartedProcess {
  private readonly child: ChildProcess;
  private readonly exited: Promise<void>;

  public constructor(child: ChildProcess) {
    this.child = child;
    this.exited = new Promise<void>(t => child.once(Resources.exitEvent, () => t()));
  }

  public get id(): number {
    if (Object.isUndefined(this.child.pid))
      throw new BuildException(Resources.processWithoutId);
    return this.child.pid;
  }

  public get hasExited(): boolean {
    return !Object.isNull(this.child.exitCode) || !Object.isNull(this.child.signalCode);
  }

  public get exitCode(): number | null {
    return this.child.exitCode;
  }

  public get signalCode(): NodeJS.Signals | null {
    return this.child.signalCode;
  }

  public get ending(): string {
    return Object.isNull(this.child.signalCode) ? Resources.formatProcessExited(this.child.exitCode) : Resources.formatProcessSignalled(this.child.signalCode);
  }

  public async waitAsync(timeout: number): Promise<boolean> {
    const deadline = Promise.withResolvers<void>();
    const timer = setTimeout(() => deadline.resolve(), timeout);
    await Promise.race([this.exited, deadline.promise]);
    clearTimeout(timer);
    return this.hasExited;
  }

  public signal(name: NodeJS.Signals): void {
    this.child.kill(name);
  }
}
