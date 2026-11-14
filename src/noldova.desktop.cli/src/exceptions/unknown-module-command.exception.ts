/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UsageException } from "./usage.exception.js";

export class UnknownModuleCommandException extends UsageException {
  public readonly command: string;
  public readonly moduleId: string;

  public constructor(command: string, moduleId: string) {
    super(Resources.formatUnknownModuleCommand(command, moduleId));

    this.command = command;
    this.moduleId = moduleId;
  }
}
