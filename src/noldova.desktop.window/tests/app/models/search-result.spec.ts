/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { SearchResult } from "../../../src/app/models/search-result";
import { TextRange } from "../../../src/app/models/text-range";

describe("SearchResult", () => {
  const open = (): Promise<void> => Promise.resolve();

  it("holds its id, title, detail, matched ranges, key and opener, with no ranges and no key by default", () => {
    const titleMatch = new TextRange(0, 4);
    const detailMatch = new TextRange(2, 3);
    const result = new SearchResult("terminal.new", "New terminal", "Terminal", open, titleMatch, detailMatch, "Ctrl+Shift+`");
    const plain = new SearchResult("42", "Pick a license", String.empty, open);

    expect([result.id, result.title, result.detail, result.openAsync, result.titleMatch, result.detailMatch, result.keyLabel])
      .toEqual(["terminal.new", "New terminal", "Terminal", open, titleMatch, detailMatch, "Ctrl+Shift+`"]);
    expect([plain.detail, plain.titleMatch, plain.detailMatch, plain.keyLabel]).toEqual([String.empty, null, null, null]);
  });

  it("takes a range that ends at its text's end and refuses one that runs past it, in the title or the detail", () => {
    expect(new SearchResult("1", "Term", "desk", open, new TextRange(0, 4), new TextRange(1, 3)).titleMatch?.end).toBe(4);
    expect(() => new SearchResult("1", "Term", "desk", open, new TextRange(1, 4))).toThrowError(ArgumentOutOfRangeException);
    expect(() => new SearchResult("1", "Term", "desk", open, null, new TextRange(4, 1))).toThrowError(ArgumentOutOfRangeException);
  });

  it("refuses a blank id, a blank title and a blank key", () => {
    expect(() => new SearchResult(" ", "Term", String.empty, open)).toThrowError(ArgumentException);
    expect(() => new SearchResult("1", " ", String.empty, open)).toThrowError(ArgumentException);
    expect(() => new SearchResult("1", "Term", String.empty, open, null, null, " ")).toThrowError(ArgumentException);
  });
});
