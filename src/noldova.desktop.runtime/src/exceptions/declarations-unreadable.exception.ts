/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { DeclarationsFormatException } from "./declarations-format.exception.js";

export class DeclarationsUnreadableException extends DeclarationsFormatException {
  public readonly file: string;

  public constructor(file: string, cause: unknown) {
    super(Resources.formatDeclarationsUnreadable(file, String(cause)), new ExceptionOptions(cause));

    this.file = file;
  }
}
