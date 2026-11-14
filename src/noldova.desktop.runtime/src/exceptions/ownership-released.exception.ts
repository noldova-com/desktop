/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class OwnershipReleasedException extends RuntimeException {
  public constructor() {
    super(Resources.ownershipReleased);
  }
}
