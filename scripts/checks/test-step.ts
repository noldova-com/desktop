/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class TestStep {
  public readonly name: string;
  public readonly startedAt: number;
  private endedAt: number | null = null;

  public constructor(name: string, startedAt: number) {
    this.name = name;
    this.startedAt = startedAt;
  }

  public get isRunning(): boolean {
    return Object.isNull(this.endedAt);
  }

  public end(at: number): void {
    this.endedAt = at;
  }

  public format(now: number): string {
    return Object.isNull(this.endedAt)
      ? Resources.formatSerialTestStepRunning(this.name, Math.round(now - this.startedAt))
      : Resources.formatSerialTestStep(this.name, Math.round(this.endedAt - this.startedAt));
  }

  public formatAfter(now: number): string {
    return Object.isNull(this.endedAt)
      ? this.format(now)
      : Resources.formatSerialTestNoStepRunning(this.name, Math.round(now - this.endedAt));
  }
}
