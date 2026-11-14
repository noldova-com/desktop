/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { TotalsException } from "./totals.exception.ts";

export class UnknownTestStatusException extends TotalsException {
  public readonly source: string;
  public readonly file: string;
  public readonly status: string;

  public constructor(source: string, file: string, status: string) {
    super(Resources.formatAngularTestUnknownStatus(source, file, status));

    this.source = source;
    this.file = file;
    this.status = status;
  }
}
