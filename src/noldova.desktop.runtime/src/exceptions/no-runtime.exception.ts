/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class NoRuntimeException extends RuntimeException {
  public readonly root: string;

  public constructor(root: string) {
    super(Resources.formatNoRuntime(root));

    this.root = root;
  }
}
