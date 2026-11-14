/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WindowException } from "./window.exception.js";

export abstract class WindowPartAccessException extends WindowException {
  public override readonly name: string = "WindowPartAccessException";
  public readonly moduleId: string;

  protected constructor(message: string, moduleId: string) {
    super(message);

    this.moduleId = moduleId;
  }
}
