/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ProcessStartTimes } from "./process-start-times.ts";
import { UiRunIdInvalidException } from "../exceptions/ui-run-id-invalid.exception.ts";
import { UiRunNotSetException } from "../exceptions/ui-run-not-set.exception.ts";

export class UiRun {
  private static readonly ENVIRONMENT_VARIABLE: string = "NOLDOVA_DESKTOP_UI_RUN";
  private static readonly ID: RegExp = /^(\d+)-(\d+)$/;

  public readonly runner: number;
  public readonly started: number;

  public constructor(runner: number, started: number) {
    this.runner = runner;
    this.started = started;
  }

  public get id(): string {
    return `${this.runner}-${this.started}`;
  }

  public static parse(id: string): UiRun {
    const match = UiRun.ID.exec(id);
    if (Object.isNull(match))
      throw new UiRunIdInvalidException(id);
    return new UiRun(Number(match[1]), Number(match[2]));
  }

  public static async startAsync(): Promise<UiRun> {
    const run = new UiRun(process.pid, (await ProcessStartTimes.readAsync([])).own);
    process.env[UiRun.ENVIRONMENT_VARIABLE] = run.id;
    return run;
  }

  public static readCurrent(): UiRun {
    const id = process.env[UiRun.ENVIRONMENT_VARIABLE];
    if (Object.isUndefined(id))
      throw new UiRunNotSetException(UiRun.ENVIRONMENT_VARIABLE);
    return UiRun.parse(id);
  }

  public hasEnded(startTimes: ProcessStartTimes): boolean {
    return startTimes.hasEnded(this.runner, this.started);
  }
}
