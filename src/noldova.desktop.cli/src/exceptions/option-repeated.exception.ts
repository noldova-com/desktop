/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UsageException } from "./usage.exception.js";

export class OptionRepeatedException extends UsageException {
  public readonly option: string;

  public constructor(option: string) {
    super(Resources.formatOptionRepeated(option));

    this.option = option;
  }
}
