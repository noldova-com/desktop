/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UpdateStopException } from "./update-stop.exception.js";

export class UpdateRuntimeStillStartingException extends UpdateStopException {
  public readonly dataDirectory: string;

  public constructor(dataDirectory: string) {
    super(Resources.formatRuntimeStillStarting(dataDirectory));

    this.dataDirectory = dataDirectory;
  }
}
