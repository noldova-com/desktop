/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UsageException } from "./usage.exception.js";

export class UnknownCommandException extends UsageException {
  public readonly command: string;

  public constructor(command: string) {
    super(Resources.formatUnknownCommand(command));

    this.command = command;
  }
}
