/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { SearchAnswer } from "../../../src/app/models/search-answer";
import { SearchSourceContribution } from "../../../src/app/models/search-source-contribution";
import { SearchService } from "../../../src/app/services/search.service";
import { ShellSearchSourcesService } from "../../../src/app/services/shell-search-sources.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";

describe("SearchService", () => {
  const source = (name: string, placeholderName: string, search: () => Promise<SearchAnswer> = () => Promise.resolve(new SearchAnswer([]))): SearchSourceContribution =>
    new SearchSourceContribution(name, placeholderName, placeholderName, placeholderName, null, "search", () => Promise.resolve([]), search);
  const commands = source("desktop.commands", "commands");
  const settings = source("desktop.settings", "settings");
  let modules: WritableSignal<readonly SearchSourceContribution[]>;
  let logged: [string, string][];

  beforeEach(() => {
    modules = signal([]);
    logged = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: { searchSources: modules, log: (moduleId: string, message: string) => logged.push([moduleId, message]) } },
        { provide: ShellSearchSourcesService, useValue: { commandsSource: commands, settingsSource: settings } }
      ]
    });
  });

  it("lists the modules' sources before Noldova Desktop's Commands and Settings, and names them all in the placeholder", () => {
    const search = TestBed.inject(SearchService);
    expect(search.placeholder()).toBe("Search commands and settings");

    const chats = source("chat.chats", "chats");
    const messages = source("chat.messages", "messages");
    modules.set([chats, messages]);

    expect([search.sources(), search.placeholder()]).toEqual([[chats, messages, commands, settings], "Search chats, messages, commands and settings"]);
  });

  it("starts a session over the current sources that logs a failed source under its module", async () => {
    modules.set([source("chat.chats", "chats", () => Promise.reject(new Error("The index is locked."))), source("chat.messages", "messages", () => Promise.reject("gone"))]);
    const session = TestBed.inject(SearchService).createSession();

    session.search("term");
    await vi.waitFor(() => expect(logged).toHaveLength(2));
    session.close();

    expect(logged).toEqual([
      ["chat", "The search source chat.chats failed: The index is locked."],
      ["chat", "The search source chat.messages failed: gone"]
    ]);
  });
});
