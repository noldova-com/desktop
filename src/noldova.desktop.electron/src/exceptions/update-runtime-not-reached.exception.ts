/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { UpdateStopException } from "./update-stop.exception.js";

export class UpdateRuntimeNotReachedException extends UpdateStopException {
  public readonly dataDirectory: string;

  public constructor(dataDirectory: string, options?: ExceptionOptions) {
    super(Resources.formatRuntimeNotReached(dataDirectory), options);

    this.dataDirectory = dataDirectory;
  }
}
