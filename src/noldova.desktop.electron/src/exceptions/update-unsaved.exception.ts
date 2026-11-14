/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UpdateStopException } from "./update-stop.exception.js";

export class UpdateUnsavedException extends UpdateStopException {
  public readonly dataDirectory: string;
  public readonly problems: readonly string[];

  public constructor(dataDirectory: string, problems: readonly string[]) {
    super(Resources.formatUpdateUnsaved(dataDirectory, problems.join(Resources.workSeparator)));

    this.dataDirectory = dataDirectory;
    this.problems = problems;
  }
}
