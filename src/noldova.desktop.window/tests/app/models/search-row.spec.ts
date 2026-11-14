/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { SearchAnswer } from "../../../src/app/models/search-answer";
import { SearchResult } from "../../../src/app/models/search-result";
import { SearchRow } from "../../../src/app/models/search-row";
import { SearchSourceContribution } from "../../../src/app/models/search-source-contribution";

describe("SearchRow", () => {
  function source(name: string): SearchSourceContribution {
    return new SearchSourceContribution(name, "Chats", "chats", "In Chats", null, "forum", () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([])));
  }

  function result(id: string): SearchResult {
    return new SearchResult(id, "Weekly sync", String.empty, () => Promise.resolve());
  }

  it("keeps its source and result", () => {
    const chats = source("notes.chats");
    const sync = result("42");

    const row = new SearchRow(chats, sync);

    expect([row.source, row.result]).toEqual([chats, sync]);
  });

  it("takes an id from its source's name and its result's id, so two sources' results with one id stay apart", () => {
    expect([new SearchRow(source("notes.chats"), result("42")).id, new SearchRow(source("notes.messages"), result("42")).id]).toEqual(["notes.chats/42", "notes.messages/42"]);
  });
});
