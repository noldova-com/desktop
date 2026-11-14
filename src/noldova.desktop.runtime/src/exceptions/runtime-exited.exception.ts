/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { LaunchException } from "./launch.exception.js";

export class RuntimeExitedException extends LaunchException {
  public readonly output: string;

  public constructor(output: string) {
    super(Resources.formatRuntimeExited(output));

    this.output = output;
  }
}
