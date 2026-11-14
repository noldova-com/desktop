/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { TotalsException } from "./totals.exception.ts";

export class TotalsUnreadableException extends TotalsException {
  public readonly source: string;

  public constructor(source: string, cause: unknown) {
    super(Resources.formatJsonFieldsUnreadable(source, cause), new ExceptionOptions(cause));

    this.source = source;
  }
}
