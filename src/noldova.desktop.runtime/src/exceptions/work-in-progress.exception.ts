/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RunningWork } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class WorkInProgressException extends RuntimeException {
  public readonly work: RunningWork;

  public constructor(work: RunningWork) {
    super(Resources.formatWorkInProgress(work.descriptions));

    this.work = work;
  }
}
