/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowPartFailureException } from "./window-part-failure.exception.js";

export class SettingOptionsRepeatedException extends WindowPartFailureException {
  public override readonly name: string = "SettingOptionsRepeatedException";
  public readonly setting: string;

  public constructor(moduleId: string, setting: string) {
    super(Resources.formatSettingOptionsRepeated(setting), moduleId);

    this.setting = setting;
  }
}
