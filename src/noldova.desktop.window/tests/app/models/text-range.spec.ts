/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { TextRange } from "../../../src/app/models/text-range";

describe("TextRange", () => {
  it("holds a start and a length and ends after its last character", () => {
    const range = new TextRange(4, 3);

    expect([range.start, range.length, range.end]).toEqual([4, 3, 7]);
    expect(new TextRange(0, 1).end).toBe(1);
  });

  it.each([[-1, 1], [0.5, 1], [Number.NaN, 1], [0, 0], [0, 1.5], [0, Number.POSITIVE_INFINITY]])("refuses the start %d with the length %d", (start, length) => {
    expect(() => new TextRange(start, length)).toThrowError(ArgumentOutOfRangeException);
  });
});
