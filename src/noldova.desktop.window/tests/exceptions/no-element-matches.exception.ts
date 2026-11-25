/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "../../src/app/exceptions/window.exception";

export class NoElementMatchesException extends WindowException {
  public override readonly name: string = "NoElementMatchesException";

  public readonly selector: string;

  public constructor(selector: string) {
    super(`Nothing matches ${selector}.`);

    this.selector = selector;
  }
}
