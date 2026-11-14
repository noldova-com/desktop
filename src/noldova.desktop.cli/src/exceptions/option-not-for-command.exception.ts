/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UsageException } from "./usage.exception.js";

export class OptionNotForCommandException extends UsageException {
  public readonly option: string;
  public readonly command: string;

  public constructor(option: string, command: string) {
    super(Resources.formatOptionNotForCommand(option, command));

    this.option = option;
    this.command = command;
  }
}
