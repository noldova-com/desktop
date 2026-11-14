/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { SearchRank } from "../../../src/app/models/search-rank";

describe("SearchRank", () => {
  it.each<[string, string, number | null]>([
    ["term", "Terminal: Font size", SearchRank.atStart],
    ["TERM", "terminal", SearchRank.atStart],
    ["term", "New terminal", SearchRank.atWordStart],
    ["term", "Determine the terminal", SearchRank.atWordStart],
    ["term", "Open a (terminal)", SearchRank.atWordStart],
    ["term", "Determine", SearchRank.anywhere],
    ["term", "Determinedly determined", SearchRank.anywhere],
    ["term", "Settings", null],
    [String.empty, "Terminal", null]
  ])("ranks %j in %j as %s", (query, title, rank) => {
    expect(SearchRank.of(query, title)).toBe(rank);
  });

  it("orders a match at the start before one at a word's start before one anywhere", () => {
    expect([SearchRank.atStart < SearchRank.atWordStart, SearchRank.atWordStart < SearchRank.anywhere]).toEqual([true, true]);
  });
});
