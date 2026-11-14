/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowException } from "./window.exception.js";

export class FileNotOpenedException extends WindowException {
  public override readonly name: string = "FileNotOpenedException";
  public readonly reason: string;

  public constructor(productName: string, reason: string) {
    super(Resources.formatFileNotOpened(productName, reason));

    this.reason = reason;
  }
}
