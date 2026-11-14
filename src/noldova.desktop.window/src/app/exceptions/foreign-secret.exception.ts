/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowPartAccessException } from "./window-part-access.exception.js";

export class ForeignSecretException extends WindowPartAccessException {
  public override readonly name: string = "ForeignSecretException";
  public readonly secret: string;

  public constructor(moduleId: string, secret: string) {
    super(Resources.formatForeignSecret(moduleId, secret), moduleId);

    this.secret = secret;
  }
}
