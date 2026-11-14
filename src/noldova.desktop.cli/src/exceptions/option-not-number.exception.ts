/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UsageException } from "./usage.exception.js";

export class OptionNotNumberException extends UsageException {
  public readonly option: string;
  public readonly value: string;

  public constructor(option: string, value: string) {
    super(Resources.formatOptionNotNumber(option, value));

    this.option = option;
    this.value = value;
  }
}
