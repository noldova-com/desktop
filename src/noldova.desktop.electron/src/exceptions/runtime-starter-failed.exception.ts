/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LaunchException } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";

export class RuntimeStarterFailedException extends LaunchException {
  public readonly failure: string;

  public constructor(failure: string) {
    super(Resources.formatStarterFailed(failure));

    this.failure = failure;
  }
}
