/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";
import { Failure, FailureCode } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";
import { SettingException } from "./setting.exception.js";

export class SettingUnknownException extends SettingException {
  public readonly setting: string;

  public constructor(setting: string, options?: ExceptionOptions) {
    super(new Failure(FailureCode.NotFound, Resources.formatSettingUnknown(setting)), options);

    this.setting = setting;
  }
}
