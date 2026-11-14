/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { WindowStateUnavailableException } from "./window-state-unavailable.exception.js";

export class WindowStateNotConnectedException extends WindowStateUnavailableException {
  public constructor() {
    super(Resources.runtimeNotConnected);
  }
}
