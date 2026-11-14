/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InjectionToken } from "@angular/core";

import type { IModuleSaver } from "../interfaces/i-module-saver.js";
import { Resources } from "../../resources.js";

export class ModuleSwitchTokens {
  public static readonly saver: InjectionToken<IModuleSaver> = new InjectionToken<IModuleSaver>(Resources.moduleSaverToken);
}
