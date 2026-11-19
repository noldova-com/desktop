/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BuildException } from "./build.exception.ts";
import { Resources } from "../resources.ts";

export class ProcessTimeoutException extends BuildException {
  public readonly command: string;
  public readonly timeout: number;

  public constructor(command: string, timeout: number, output: string | null = null) {
    super(Resources.formatProcessTimedOut(command, timeout, output));

    this.command = command;
    this.timeout = timeout;
  }
}
