/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowPartAccessException } from "./window-part-access.exception.js";

export class ContributionRegisteredException extends WindowPartAccessException {
  public override readonly name: string = "ContributionRegisteredException";
  public readonly contribution: string;
  public readonly kind: string;

  public constructor(moduleId: string, contribution: string, kind: string) {
    super(Resources.formatContributionRegistered(kind, contribution), moduleId);

    this.contribution = contribution;
    this.kind = kind;
  }
}
