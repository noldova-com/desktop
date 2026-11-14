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

export class DeviceIdentityException extends ElectronException {
  public readonly file: string;

  public constructor(file: string, options?: ExceptionOptions) {
    super(Resources.formatInvalidDevice(file), options);

    this.file = file;
  }
}
