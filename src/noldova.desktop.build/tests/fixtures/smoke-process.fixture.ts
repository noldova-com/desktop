/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChildProcess } from "node:child_process";

import "@noldova/context.core";

import { Resources } from "../../src/resources.js";
import { StartedProcess } from "../../src/services/processes/started-process.js";

export class SmokeProcessFixture extends StartedProcess {
  private readonly processId: number;
  private readonly onEnd: () => void;
  private code: number | null;
  private signalName: NodeJS.Signals | null = null;

  public readonly signals: NodeJS.Signals[] = [];

  public constructor(processId: number, code: number | null, onEnd: () => void) {
    super(new ChildProcess());
    this.processId = processId;
    this.code = code;
    this.onEnd = onEnd;
  }

  public override get id(): number {
    return this.processId;
  }

  public override get hasExited(): boolean {
    return !Object.isNull(this.code) || !Object.isNull(this.signalName);
  }

  public override get exitCode(): number | null {
    return this.code;
  }

  public override get signalCode(): NodeJS.Signals | null {
    return this.signalName;
  }

  public override get ending(): string {
    return Object.isNull(this.signalName) ? Resources.formatProcessExited(this.code) : Resources.formatProcessSignalled(this.signalName);
  }

  public override waitAsync(): Promise<boolean> {
    return Promise.resolve(this.hasExited);
  }

  public override signal(name: NodeJS.Signals): void {
    this.signals.push(name);
    this.signalName = name;
    this.onEnd();
  }

  public exit(code: number): void {
    this.code = code;
    this.onEnd();
  }
}
