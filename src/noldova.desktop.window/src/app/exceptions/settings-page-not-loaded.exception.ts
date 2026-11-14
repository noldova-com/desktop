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

export class SettingsPageNotLoadedException extends WindowPartFailureException {
  public override readonly name: string = "SettingsPageNotLoadedException";

  public constructor(moduleId: string, cause: unknown) {
    super(Resources.settingsPageLoadFailed, moduleId, new ExceptionOptions(cause));
  }
}
