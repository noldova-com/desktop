/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessRecord } from "./process-record.js";

export class RunningProcess {
  private readonly begin: () => void;

  public readonly record: ProcessRecord;
  public readonly started: Date;
  public readonly exitTime: Promise<number>;
  public readonly signal: NodeJS.Signals;

  public constructor(record: ProcessRecord, started: Date, exitTime: Promise<number>, signal: NodeJS.Signals, begin: () => void) {
    this.record = record;
    this.started = started;
    this.exitTime = exitTime;
    this.signal = signal;
    this.begin = begin;
  }

  public beginEnd(): void {
    this.begin();
  }
}
