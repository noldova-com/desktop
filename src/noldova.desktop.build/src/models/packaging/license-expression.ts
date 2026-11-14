/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class LicenseExpression {
  public readonly expression: string;
  public readonly chosen: string;
  public readonly isAccepted: boolean;

  public constructor(packageId: string, expression: unknown, accepted: string | null = null, otherAccepted: readonly string[] = []) {
    if (Object.isString(expression) && expression === accepted) {
      this.expression = expression;
      this.chosen = expression;
      this.isAccepted = true;
      return;
    }
    if (!Object.isString(expression))
      throw new BuildException(Resources.formatLicenseMissing(packageId));
    const trimmed = expression.trim();
    const identifiers = (Resources.licenseGroup.exec(trimmed)?.[1] ?? trimmed).trim().split(Resources.licenseAlternative);
    const chosen = identifiers.every(t => Resources.licenseIdentifier.test(t)) ? identifiers.find(t => Resources.allowedLicenses.includes(t)) : undefined;
    if (Object.isUndefined(chosen))
      throw new BuildException(Resources.formatLicenseRefused(packageId, expression, otherAccepted));

    this.expression = expression;
    this.chosen = chosen;
    this.isAccepted = false;
  }

  public describe(): string {
    if (this.isAccepted)
      return Resources.formatLicenseAccepted(this.expression);
    return this.expression === this.chosen ? this.chosen : Resources.formatLicenseChosen(this.chosen, this.expression);
  }
}
