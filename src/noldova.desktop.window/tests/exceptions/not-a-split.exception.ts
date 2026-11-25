/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "../../src/app/exceptions/window.exception";

export class NotASplitException extends WindowException {
  public override readonly name: string = "NotASplitException";

  public constructor() {
    super("The node is not a split.");
  }
}
