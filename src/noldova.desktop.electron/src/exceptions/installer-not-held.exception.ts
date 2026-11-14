/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UpdateHandoffException } from "./update-handoff.exception.js";

export class InstallerNotHeldException extends UpdateHandoffException {
  public readonly errorCode: number;

  public constructor(errorCode: number) {
    super(Resources.formatInstallerNotHeld(errorCode));

    this.errorCode = errorCode;
  }
}
