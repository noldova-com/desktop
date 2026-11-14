/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiEntryUnreadableException extends ApiException {
  public readonly file: string;

  public constructor(file: string, cause: unknown) {
    super(Resources.formatApiEntryUnreadable(file), new ExceptionOptions(cause));

    this.file = file;
  }
}
