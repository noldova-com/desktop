/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { LaunchException } from "./launch.exception.js";

export class RuntimeExitedWithoutReasonException extends LaunchException {
  public constructor() {
    super(Resources.runtimeExitedWithoutReason);
  }
}
