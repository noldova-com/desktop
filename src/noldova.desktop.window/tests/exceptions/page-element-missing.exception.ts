/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "../../src/app/exceptions/window.exception";

export class PageElementMissingException extends WindowException {
  public override readonly name: string = "PageElementMissingException";

  public readonly typeName: string;
  public readonly selector: string;

  public constructor(typeName: string, selector: string) {
    super(`The page has no ${typeName} matching ${selector}.`);

    this.typeName = typeName;
    this.selector = selector;
  }
}
