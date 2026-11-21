/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SessionBusRun {
  public readonly status: number | null;
  public readonly output: string;
  public readonly errors: string;
  public readonly calls: readonly string[];
  public readonly busProcess: number | null;
  public readonly busLog: string;

  public constructor(status: number | null, output: string, errors: string, calls: readonly string[], busProcess: number | null, busLog: string) {
    this.status = status;
    this.output = output;
    this.errors = errors;
    this.calls = calls;
    this.busProcess = busProcess;
    this.busLog = busLog;
  }
}
