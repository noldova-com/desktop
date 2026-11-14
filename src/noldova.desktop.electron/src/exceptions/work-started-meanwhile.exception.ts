/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UpdateStopException } from "./update-stop.exception.js";

export class WorkStartedMeanwhileException extends UpdateStopException {
  public readonly work: readonly string[];

  public constructor(work: readonly string[]) {
    super(Resources.formatWorkStartedMeanwhile(work.join(Resources.workSeparator)));

    this.work = work;
  }
}
