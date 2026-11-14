/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { SearchRequest } from "../../../src/app/models/search-request";

describe("SearchRequest", () => {
  it("keeps its query and source", () => {
    const request = new SearchRequest("notes", "chats");

    expect([request.query, request.source]).toEqual(["notes", "chats"]);
  });

  it("opens a plain search with no query and every source", () => {
    expect([SearchRequest.plain.query, SearchRequest.plain.source]).toEqual([String.empty, null]);
  });

  it("opens a search of commands only with the commands prefix and every source", () => {
    expect([SearchRequest.commands.query, SearchRequest.commands.source]).toEqual([">", null]);
  });
});
