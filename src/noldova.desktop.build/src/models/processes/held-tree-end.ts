/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HeldTreeEnd {
  public readonly output: string;
  public readonly isEnded: boolean;

  public constructor(output: string, isEnded: boolean) {
    this.output = output;
    this.isEnded = isEnded;
  }
}
