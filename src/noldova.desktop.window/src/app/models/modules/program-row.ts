/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProgramStatus } from "@noldova/desktop.protocol";

import { Resources } from "../../../resources.js";

export class ProgramRow {
  public readonly processId: number;
  public readonly name: string;
  public readonly path: string;
  public readonly state: string;
  public readonly details: string;

  public constructor(processId: number, name: string, path: string, state: string, details: string) {
    this.processId = processId;
    this.name = name;
    this.path = path;
    this.state = state;
    this.details = details;
  }

  public static from(status: ProgramStatus, now: number, time: Intl.DateTimeFormat): ProgramRow {
    const name = status.program.split(Resources.pathSeparators).filter(t => t.length > 0).at(-1) ?? status.program;
    const minutes = Math.max(0, Math.floor((now - status.started.getTime()) / Resources.minuteDuration));
    return new ProgramRow(
      status.processId,
      name,
      status.program,
      status.hasExited ? Resources.programExited : Resources.formatRunningFor(minutes),
      Resources.formatProgramDetails(status.program, status.processId, time.format(status.started)));
  }
}
