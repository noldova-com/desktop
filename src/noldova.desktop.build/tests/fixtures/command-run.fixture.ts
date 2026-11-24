/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CommandRunFixture {
  public readonly exitCode: number;
  public readonly output: string;

  public constructor(exitCode: number, output: string) {
    this.exitCode = exitCode;
    this.output = output;
  }
}
