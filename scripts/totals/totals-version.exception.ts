/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RunnerTotalsResources } from "./runner-totals.resources.ts";
import { TotalsException } from "./totals.exception.ts";

export class TotalsVersionException extends TotalsException {
  public readonly source: string;
  public readonly version: number;

  public constructor(source: string, version: number) {
    super(RunnerTotalsResources.formatWrongVersion(source, version));

    this.source = source;
    this.version = version;
  }
}
