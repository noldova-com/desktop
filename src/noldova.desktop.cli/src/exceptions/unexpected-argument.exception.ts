/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UsageException } from "./usage.exception.js";

export class UnexpectedArgumentException extends UsageException {
  public readonly argument: string;

  public constructor(argument: string) {
    super(Resources.formatUnexpectedArgument(argument));

    this.argument = argument;
  }
}
