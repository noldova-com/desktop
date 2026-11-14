/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { AddonLoadException } from "./addon-load.exception.js";

export class AddonLoadFailedException extends AddonLoadException {
  public readonly addon: string;

  public constructor(addon: string, options?: ExceptionOptions) {
    super(Resources.formatAddonLoadFailed(addon), options);

    this.addon = addon;
  }
}
