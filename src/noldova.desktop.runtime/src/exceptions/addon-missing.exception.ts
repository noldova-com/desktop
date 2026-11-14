/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { AddonLoadException } from "./addon-load.exception.js";

export class AddonMissingException extends AddonLoadException {
  public readonly target: string;
  public readonly file: string;

  public constructor(target: string, file: string) {
    super(Resources.formatAddonMissing(target, file));

    this.target = target;
    this.file = file;
  }
}
