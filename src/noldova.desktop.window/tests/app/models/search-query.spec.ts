/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { SearchQuery } from "../../../src/app/models/search-query";

describe("SearchQuery", () => {
  it.each<[string, string, boolean]>([
    ["  term ", "term", false],
    [String.empty, String.empty, false],
    ["   ", String.empty, false],
    [">", String.empty, true],
    ["> new  ", "new", true],
    [" >new", "new", true],
    ["a > b", "a > b", false]
  ])("reads %j as the text %j, commands only %s", (typed, text, isCommandsOnly) => {
    const query = SearchQuery.parse(typed);

    expect([query.text, query.isCommandsOnly, query.isEmpty]).toEqual([text, isCommandsOnly, text.length === 0]);
  });

  it("equals a query of the same text and kind only", () => {
    expect(SearchQuery.parse(" term").equals(SearchQuery.parse("term "))).toBe(true);
    expect(SearchQuery.parse("term").equals(SearchQuery.parse(">term"))).toBe(false);
    expect(SearchQuery.parse("term").equals(SearchQuery.parse("terms"))).toBe(false);
    expect(SearchQuery.parse(" ").equals(SearchQuery.empty)).toBe(true);
  });
});
