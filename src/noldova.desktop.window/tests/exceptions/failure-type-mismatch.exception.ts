/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "../../src/app/exceptions/window.exception";

export class FailureTypeMismatchException extends WindowException {
  public override readonly name: string = "FailureTypeMismatchException";

  public readonly typeName: string;

  public constructor(typeName: string) {
    super(`The failure is not a ${typeName}.`);

    this.typeName = typeName;
  }
}
