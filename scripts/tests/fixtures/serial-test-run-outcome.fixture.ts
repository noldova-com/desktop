/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SerialTestRunOutcomeFixture {
  public readonly code: unknown;
  public readonly output: string;
  public readonly errors: string;
  public readonly left: readonly string[];

  public constructor(code: unknown, output: string, errors: string, left: readonly string[]) {
    this.code = code;
    this.output = output;
    this.errors = errors;
    this.left = left;
  }
}
