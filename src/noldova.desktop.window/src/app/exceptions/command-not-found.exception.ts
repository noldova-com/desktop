/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowException } from "./window.exception.js";

export class CommandNotFoundException extends WindowException {
  public override readonly name: string = "CommandNotFoundException";
  public readonly commandName: string;

  public constructor(commandName: string) {
    super(Resources.formatCommandNotFound(commandName));

    this.commandName = commandName;
  }
}
