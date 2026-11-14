/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SearchFilter } from "../../../src/app/models/search-filter";

describe("SearchFilter", () => {
  it("keeps a source's filter with its label, count and whether it is active", () => {
    const filter = new SearchFilter("notes.notes", "Notes", 12, true);

    expect([filter.source, filter.label, filter.count, filter.isActive]).toEqual(["notes.notes", "Notes", 12, true]);
  });

  it("keeps the filter of every source, with no count yet", () => {
    const filter = new SearchFilter(null, "All", null, false);

    expect([filter.source, filter.label, filter.count, filter.isActive]).toEqual([null, "All", null, false]);
  });
});
