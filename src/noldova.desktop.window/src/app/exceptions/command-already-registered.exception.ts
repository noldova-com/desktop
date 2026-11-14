/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { WindowPartAccessException } from "./window-part-access.exception.js";

export class CommandAlreadyRegisteredException extends WindowPartAccessException {
  public override readonly name: string = "CommandAlreadyRegisteredException";
  public readonly command: string;

  public constructor(moduleId: string, command: string) {
    super(Resources.formatCommandRegistered(command), moduleId);

    this.command = command;
  }
}
