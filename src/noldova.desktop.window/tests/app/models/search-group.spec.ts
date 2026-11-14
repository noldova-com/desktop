/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { SearchAnswer } from "../../../src/app/models/search-answer";
import { SearchGroup } from "../../../src/app/models/search-group";
import { SearchResult } from "../../../src/app/models/search-result";
import { SearchRow } from "../../../src/app/models/search-row";
import { SearchSourceContribution } from "../../../src/app/models/search-source-contribution";

describe("SearchGroup", () => {
  it("keeps its name, heading and rows", () => {
    const source = new SearchSourceContribution("notes.chats", "Chats", "chats", "In Chats", null, "forum", () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([])));
    const rows = [new SearchRow(source, new SearchResult("1", "Weekly sync", String.empty, () => Promise.resolve()))];

    const group = new SearchGroup("chats", "In Chats", rows);

    expect([group.name, group.heading, group.rows]).toEqual(["chats", "In Chats", rows]);
  });

  it("may hold no rows", () => {
    expect(new SearchGroup("recent", "Recent", []).rows).toEqual([]);
  });
});
