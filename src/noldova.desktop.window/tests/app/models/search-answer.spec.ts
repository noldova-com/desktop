/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { SearchAnswer } from "../../../src/app/models/search-answer";
import { SearchResult } from "../../../src/app/models/search-result";

describe("SearchAnswer", () => {
  const results = [new SearchResult("1", "Terminal", String.empty, () => Promise.resolve()), new SearchResult("2", "Term", String.empty, () => Promise.resolve())];

  it("copies its results and counts them unless given a larger total", () => {
    const listed = [...results];
    const answer = new SearchAnswer(listed);
    listed.pop();

    expect([answer.results, answer.total]).toEqual([results, 2]);
    expect(new SearchAnswer(results, 14).total).toBe(14);
    expect(new SearchAnswer([]).total).toBe(0);
  });

  it.each([1, 2.5, Number.NaN])("refuses the total %d for two results", total => {
    expect(() => new SearchAnswer(results, total)).toThrowError(ArgumentOutOfRangeException);
  });
});
