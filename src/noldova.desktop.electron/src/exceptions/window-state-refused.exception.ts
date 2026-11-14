/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Failure, QualifiedName } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";
import { WindowStateException } from "./window-state.exception.js";

export class WindowStateRefusedException extends WindowStateException {
  public readonly method: QualifiedName;
  public readonly failure: Failure;

  public constructor(method: QualifiedName, failure: Failure) {
    super(Resources.formatWindowStateFailed(method.text, failure.message));

    this.method = method;
    this.failure = failure;
  }
}
