/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { ElectronException } from "./electron.exception.js";

export class ProfileNotClearedException extends ElectronException {
  public constructor(options?: ExceptionOptions) {
    super(Resources.profileNotCleared, options);
  }
}
