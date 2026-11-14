/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { AddonLoadException } from "./addon-load.exception.js";

export class AddonUnexpectedValueException extends AddonLoadException {
  public readonly addon: string;

  public constructor(addon: string) {
    super(Resources.formatAddonUnexpected(addon));

    this.addon = addon;
  }
}
