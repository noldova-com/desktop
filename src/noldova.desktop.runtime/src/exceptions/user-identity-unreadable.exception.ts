/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { SystemCommandException } from "./system-command.exception.js";

export class UserIdentityUnreadableException extends SystemCommandException {
  public readonly output: string;

  public constructor(output: string) {
    super(Resources.formatIdentityUnreadable(output));

    this.output = output;
  }
}
