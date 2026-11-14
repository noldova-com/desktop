/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../../resources.js";
import { WindowPartFailureException } from "./window-part-failure.exception.js";

export class SettingOptionsFailedException extends WindowPartFailureException {
  public override readonly name: string = "SettingOptionsFailedException";
  public readonly setting: string;

  public constructor(moduleId: string, setting: string, cause: unknown) {
    super(Resources.formatSettingOptionsFailed(setting), moduleId, new ExceptionOptions(cause));

    this.setting = setting;
  }
}
