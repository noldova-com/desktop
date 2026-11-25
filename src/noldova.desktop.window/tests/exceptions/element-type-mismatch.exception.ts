/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "../../src/app/exceptions/window.exception";

export class ElementTypeMismatchException extends WindowException {
  public override readonly name: string = "ElementTypeMismatchException";

  public readonly selector: string;
  public readonly localName: string;
  public readonly typeName: string;

  public constructor(selector: string, localName: string, typeName: string) {
    super(`${selector} matches a ${localName}, not a ${typeName}.`);

    this.selector = selector;
    this.localName = localName;
    this.typeName = typeName;
  }
}
