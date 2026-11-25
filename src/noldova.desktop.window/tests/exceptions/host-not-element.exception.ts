/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "../../src/app/exceptions/window.exception";

export class HostNotElementException extends WindowException {
  public override readonly name: string = "HostNotElementException";

  public constructor() {
    super("The fixture's host is not an HTML element.");
  }
}
