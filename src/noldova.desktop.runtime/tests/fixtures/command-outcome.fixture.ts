/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CommandOutcomeFixture {
  public readonly status: number | null;
  public readonly output: string;
  public readonly text: string;

  public constructor(status: number | null, output: string, text: string) {
    this.status = status;
    this.output = output;
    this.text = text;
  }
}
