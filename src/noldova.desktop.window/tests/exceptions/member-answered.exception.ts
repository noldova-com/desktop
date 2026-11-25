/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "../../src/app/exceptions/window.exception";

export class MemberAnsweredException extends WindowException {
  public override readonly name: string = "MemberAnsweredException";

  public constructor() {
    super("The member returned without an answer.");
  }
}
