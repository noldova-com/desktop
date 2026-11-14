/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { UpdateStopException } from "./update-stop.exception.js";

export class DatabasesNotBackedUpException extends UpdateStopException {
  public readonly dataDirectory: string;

  public constructor(dataDirectory: string, cause: unknown) {
    super(Resources.formatDatabasesNotBackedUp(dataDirectory, cause instanceof Error ? cause.message : String(cause)), new ExceptionOptions(cause));

    this.dataDirectory = dataDirectory;
  }
}
