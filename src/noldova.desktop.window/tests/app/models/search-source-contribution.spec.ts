/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { SearchAnswer } from "../../../src/app/models/search-answer";
import { SearchSourceContribution } from "../../../src/app/models/search-source-contribution";

describe("SearchSourceContribution", () => {
  const recent = (): Promise<readonly []> => Promise.resolve([]);
  const search = (): Promise<SearchAnswer> => Promise.resolve(new SearchAnswer([]));
  const source = (name: string, label: string, placeholderName: string, heading: string, recentHeading: string | null, icon: string): SearchSourceContribution =>
    new SearchSourceContribution(name, label, placeholderName, heading, recentHeading, icon, recent, search);

  it("holds its name, labels, headings, icon and calls, with or without recent items", () => {
    const messages = source("chat.messages", "Messages", "messages", "In messages", null, "notes");
    const chats = source("chat.chats", "Chats", "chats", "Chats", "Recent chats", "chat_bubble");

    expect([messages.name, messages.label, messages.placeholderName, messages.heading, messages.recentHeading, messages.icon, messages.recentAsync, messages.searchAsync])
      .toEqual(["chat.messages", "Messages", "messages", "In messages", null, "notes", recent, search]);
    expect(chats.recentHeading).toBe("Recent chats");
  });

  it.each<[string, () => SearchSourceContribution]>([
    ["a name without its module", () => source("messages", "Messages", "messages", "In messages", null, "notes")],
    ["a blank label", () => source("chat.messages", " ", "messages", "In messages", null, "notes")],
    ["a blank placeholder name", () => source("chat.messages", "Messages", " ", "In messages", null, "notes")],
    ["a blank heading", () => source("chat.messages", "Messages", "messages", " ", null, "notes")],
    ["a blank recent heading", () => source("chat.messages", "Messages", "messages", "In messages", " ", "notes")],
    ["a blank icon", () => source("chat.messages", "Messages", "messages", "In messages", null, " ")]
  ])("refuses %s", (_, create) => {
    expect(create).toThrowError(ArgumentException);
  });
});
