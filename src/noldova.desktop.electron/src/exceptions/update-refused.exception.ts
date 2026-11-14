/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Failure } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";
import { UpdateStopException } from "./update-stop.exception.js";

export class UpdateRefusedException extends UpdateStopException {
  public readonly dataDirectory: string;
  public readonly failure: Failure;

  public constructor(dataDirectory: string, failure: Failure) {
    super(Resources.formatUpdateRefused(dataDirectory, failure.message));

    this.dataDirectory = dataDirectory;
    this.failure = failure;
  }
}
