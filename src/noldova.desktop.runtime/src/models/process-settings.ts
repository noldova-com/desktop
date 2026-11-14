/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class ProcessSettings {
  public readonly graceMilliseconds: number;
  public readonly endMilliseconds: number;
  public readonly seenMilliseconds: number;
  public readonly terminalWatchMilliseconds: number;
  public readonly terminalReportMilliseconds: number;
  public readonly stopLimit: number;

  public constructor(
    graceMilliseconds: number = Resources.processGraceMilliseconds,
    endMilliseconds: number = Resources.processEndMilliseconds,
    seenMilliseconds: number = Resources.processSeenMilliseconds,
    terminalWatchMilliseconds: number = Resources.pseudoTerminalWatchMilliseconds,
    terminalReportMilliseconds: number = Resources.pseudoTerminalReportMilliseconds) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(graceMilliseconds, Resources.graceMillisecondsParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(endMilliseconds, Resources.endMillisecondsParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(seenMilliseconds, Resources.seenMillisecondsParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(terminalWatchMilliseconds, Resources.terminalWatchMillisecondsParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(terminalReportMilliseconds, Resources.terminalReportMillisecondsParameterName);

    this.graceMilliseconds = graceMilliseconds;
    this.endMilliseconds = endMilliseconds;
    this.seenMilliseconds = seenMilliseconds;
    this.terminalWatchMilliseconds = terminalWatchMilliseconds;
    this.terminalReportMilliseconds = terminalReportMilliseconds;
    this.stopLimit = graceMilliseconds + endMilliseconds * Resources.stopEndCount;
  }
}
