/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ScriptException } from "../script.exception.ts";

export class EmptyTestPartsException extends ScriptException {
  public readonly parts: readonly string[];

  public constructor(parts: readonly string[]) {
    super(Resources.formatSerialTestPartsEmpty(parts));

    this.parts = parts;
  }
}
