/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { StaleUpdateException } from "./stale-update.exception.js";

export class UpdateChangedBeforeHandoffException extends StaleUpdateException {
  public constructor() {
    super(Resources.updateChangedBeforeHandoff);
  }
}
