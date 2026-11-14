/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UpdateException } from "./update.exception.js";

export class UpdateCheckerUnknownException extends UpdateException {
  public constructor() {
    super(Resources.updateCheckerUnknown);
  }
}
