/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class CodePointOrder {
  public static compare(left: string, right: string): number {
    const first = Array.from(left, t => t.codePointAt(0) ?? 0);
    const second = Array.from(right, t => t.codePointAt(0) ?? 0);
    for (let index = 0; index < Math.min(first.length, second.length); index++) {
      const difference = (first[index] ?? 0) - (second[index] ?? 0);
      if (difference !== 0)
        return difference;
    }
    return first.length - second.length;
  }
}
