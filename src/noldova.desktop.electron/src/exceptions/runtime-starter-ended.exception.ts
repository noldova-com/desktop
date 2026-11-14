/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LaunchException } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";

export class RuntimeStarterEndedException extends LaunchException {
  public constructor() {
    super(Resources.starterEnded);
  }
}
