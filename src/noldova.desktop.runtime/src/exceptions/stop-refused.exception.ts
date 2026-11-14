/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Failure } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";
import { LaunchException } from "./launch.exception.js";

export class StopRefusedException extends LaunchException {
  public readonly failure: Failure;

  public constructor(failure: Failure) {
    super(Resources.formatStopRefused(failure.message));

    this.failure = failure;
  }
}
