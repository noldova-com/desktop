/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class StepRun {
  public readonly status: number | null;
  public readonly output: string;

  public constructor(status: number | null, output: string) {
    this.status = status;
    this.output = output;
  }
}
