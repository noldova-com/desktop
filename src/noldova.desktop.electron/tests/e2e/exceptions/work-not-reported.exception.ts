/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class WorkNotReportedException extends installedElectron.ElectronException {
  private static readonly LOG_LINES: number = 8;

  public readonly reported: string;
  public readonly hasWorkFolder: boolean;
  public readonly hasBegun: boolean;
  public readonly runtimeLog: string | null;
  public readonly mainProcessLog: string | null;

  public constructor(reported: string, hasWorkFolder: boolean, hasBegun: boolean, runtimeLog: string | null, mainProcessLog: string | null, cause: unknown) {
    super([
      "The shell did not report the work before the window was closed.",
      `The shell's work report, the one the quit question reads: ${reported}.`,
      `The work command ran (the clock's work folder exists): ${hasWorkFolder}.`,
      `The runtime logged that the clock began counting: ${hasBegun}.`,
      `Runtime log: ${WorkNotReportedException.describeLog(runtimeLog)}.`,
      `Main process log: ${WorkNotReportedException.describeLog(mainProcessLog)}.`
    ].join("\n"), new ExceptionOptions(cause));

    this.reported = reported;
    this.hasWorkFolder = hasWorkFolder;
    this.hasBegun = hasBegun;
    this.runtimeLog = runtimeLog;
    this.mainProcessLog = mainProcessLog;
  }

  private static describeLog(log: string | null): string {
    return Object.isNull(log) ? "missing" : JSON.stringify(log.split("\n").slice(-WorkNotReportedException.LOG_LINES));
  }
}
