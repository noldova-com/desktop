/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowPartAccessException } from "./window-part-access.exception.js";

export class ForeignNameException extends WindowPartAccessException {
  public override readonly name: string = "ForeignNameException";
  public readonly contributionName: string;

  public constructor(moduleId: string, contributionName: string) {
    super(Resources.formatForeignName(moduleId, contributionName), moduleId);

    this.contributionName = contributionName;
  }
}
