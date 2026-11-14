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

export class SettingScopeNotAllowedException extends SettingException {
  public readonly setting: string;
  public readonly scope: string;

  public constructor(setting: string, scope: string, options?: ExceptionOptions) {
    super(new Failure(FailureCode.InvalidParams, Resources.formatSettingScopeNotAllowed(setting, scope)), options);

    this.setting = setting;
    this.scope = scope;
  }
}
