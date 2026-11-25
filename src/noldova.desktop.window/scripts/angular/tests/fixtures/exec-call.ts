/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ExecCall {
  public readonly command: string;
  public readonly arguments_: readonly string[];
  public readonly timeout: number | undefined;

  public constructor(command: string, arguments_: readonly string[], timeout: number | undefined) {
    this.command = command;
    this.arguments_ = arguments_;
    this.timeout = timeout;
  }
}
