/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "../../src/app/exceptions/window.exception";

export class InkMissingException extends WindowException {
  public override readonly name: string = "InkMissingException";

  public constructor() {
    super("The element holds no ink before its later part.");
  }
}
