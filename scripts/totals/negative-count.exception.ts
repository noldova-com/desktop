/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { TotalsException } from "./totals.exception.ts";

export class NegativeCountException extends TotalsException {
  public readonly source: string;
  public readonly path: string;
  public readonly field: string;

  public constructor(source: string, path: string, field: string) {
    super(Resources.formatJsonFieldsNegativeCount(source, path, field));

    this.source = source;
    this.path = path;
    this.field = field;
  }
}
