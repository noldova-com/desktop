/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { RegistrationException } from "./registration.exception.js";

export class SettingNotWritableException extends RegistrationException {
  public readonly moduleId: string;
  public readonly setting: string;

  public constructor(moduleId: string, setting: string, options?: ExceptionOptions) {
    super(Resources.formatSettingNotWritable(moduleId, setting), options);

    this.moduleId = moduleId;
    this.setting = setting;
  }
}
