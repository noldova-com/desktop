/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { StaleUpdateException } from "./stale-update.exception.js";

export class UpdateNoLongerOfferedException extends StaleUpdateException {
  public readonly version: string;

  public constructor(version: string) {
    super(Resources.formatUpdateNoLongerOffered(version));

    this.version = version;
  }
}
