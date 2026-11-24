/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MiddleHold {
  public readonly key: string;
  public readonly width: number;

  public constructor(key: string, width: number) {
    this.key = key;
    this.width = width;
  }
}
