/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class LogFileClosedException extends RuntimeException {
  public readonly file: string;

  public constructor(file: string) {
    super(Resources.formatLogFileClosed(file));

    this.file = file;
  }
}
