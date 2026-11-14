/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowPartAccessException } from "./window-part-access.exception.js";

export class ForeignContributionException extends WindowPartAccessException {
  public override readonly name: string = "ForeignContributionException";
  public readonly contribution: string;

  public constructor(moduleId: string, contribution: string) {
    super(Resources.formatForeignContribution(moduleId, contribution), moduleId);

    this.contribution = contribution;
  }
}
