/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { CliException } from "./cli.exception.js";

export class MainProcessNotStartedException extends CliException {
  public constructor(cause: unknown) {
    super(Resources.mainProcessNotStarted, new ExceptionOptions(cause));
  }
}
