/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MiddleHold {
  public static readonly none: MiddleHold = new MiddleHold(null, null);

  public readonly key: string | null;
  public readonly width: number | null;

  public constructor(key: string | null, width: number | null) {
    this.key = key;
    this.width = width;
  }
}
