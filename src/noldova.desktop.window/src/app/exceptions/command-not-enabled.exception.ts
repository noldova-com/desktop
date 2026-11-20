/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowException } from "./window.exception.js";

export class CommandNotEnabledException extends WindowException {
  public override readonly name: string = "CommandNotEnabledException";
  public readonly commandName: string;

  public constructor(commandName: string) {
    super(Resources.formatCommandNotEnabled(commandName));

    this.commandName = commandName;
  }
}
