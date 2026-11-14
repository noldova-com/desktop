/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { ApiException } from "../api/api.exception.ts";
import { Resources } from "../resources.ts";

export class SyntaxTreeMissingException extends ApiException {
  public readonly file: string;

  public constructor(file: string, cause: unknown) {
    super(Resources.formatSyntaxTreeMissing(file), new ExceptionOptions(cause));

    this.file = file;
  }
}
