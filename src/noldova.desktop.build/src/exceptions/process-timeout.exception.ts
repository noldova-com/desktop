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
  public readonly processId: number | undefined;

  public constructor(command: string, timeout: number, output: string | null = null, processId?: number) {
    super(Resources.formatProcessTimedOut(command, timeout, output));

    this.command = command;
    this.timeout = timeout;
    this.processId = processId;
  }
}
