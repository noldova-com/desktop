/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class PreShellDataException extends RuntimeException {
  public readonly root: string;
  public readonly entries: readonly string[];

  public constructor(root: string, entries: readonly string[]) {
    super(Resources.formatPreShellData(root, entries));

    this.root = root;
    this.entries = [...entries];
  }
}
