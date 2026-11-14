/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class SearchRank {
  public static readonly atStart: number = 0;
  public static readonly atWordStart: number = 1;
  public static readonly anywhere: number = 2;

  public static of(query: string, title: string): number | null {
    const text = title.toLocaleLowerCase();
    const wanted = query.toLocaleLowerCase();
    if (wanted.length === 0)
      return null;
    if (text.startsWith(wanted))
      return SearchRank.atStart;
    let found = text.indexOf(wanted);
    if (found < 0)
      return null;
    while (found >= 0) {
      if (!Resources.wordCharacterPattern.test(text.charAt(found - 1)))
        return SearchRank.atWordStart;
      found = text.indexOf(wanted, found + 1);
    }
    return SearchRank.anywhere;
  }
}
