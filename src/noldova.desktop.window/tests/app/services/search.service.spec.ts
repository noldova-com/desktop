/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EnvironmentInjector, type WritableSignal, createEnvironmentInjector, runInInjectionContext, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { SearchAnswer } from "../../../src/app/models/search-answer";
import { SearchSourceContribution } from "../../../src/app/models/search-source-contribution";
import { SearchService } from "../../../src/app/services/search.service";
import { ShellSearchSourcesService } from "../../../src/app/services/shell-search-sources.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";

describe("SearchService", () => {
  const source = (name: string, placeholderName: string, search: () => Promise<SearchAnswer> = () => Promise.resolve(new SearchAnswer([]))): SearchSourceContribution =>
    new SearchSourceContribution(name, placeholderName, placeholderName, placeholderName, null, "search", () => Promise.resolve([]), search);
  const commandQueries: string[] = [];
  const commands = new SearchSourceContribution("desktop.commands", "commands", "commands", "commands", null, "search", () => Promise.resolve([]), query => {
    commandQueries.push(query);
    return Promise.resolve(new SearchAnswer([]));
  });
  const settings = source("desktop.settings", "settings");
  let modules: WritableSignal<readonly SearchSourceContribution[]>;
  let changed: WritableSignal<readonly unknown[]>;
  let logged: [string, string][];

  beforeEach(() => {
    modules = signal([]);
    changed = signal([]);
    logged = [];
    commandQueries.length = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: { searchSources: modules, log: (moduleId: string, message: string) => logged.push([moduleId, message]) } },
        { provide: ShellSearchSourcesService, useValue: { commandsSource: commands, settingsSource: settings, commandsChanged: changed } }
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
    const session = TestBed.runInInjectionContext(() => TestBed.inject(SearchService).createSession());

    session.search("term");
    await vi.waitFor(() => expect(logged).toHaveLength(2));
    session.close();

    expect(logged).toEqual([
      ["chat", "The search source chat.chats failed: The index is locked."],
      ["chat", "The search source chat.messages failed: gone"]
    ]);
  });

  it("asks the commands again for the open query each time they change, not when it starts, and no more once its owner is gone", () => {
    const owner = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    const session = runInInjectionContext(owner, () => TestBed.inject(SearchService).createSession());
    session.search(">tick");
    TestBed.tick();
    const started = [...commandQueries];

    changed.set([1]);
    TestBed.tick();
    const refreshed = [...commandQueries];
    owner.destroy();
    changed.set([2]);
    TestBed.tick();
    session.close();

    expect([started, refreshed, commandQueries]).toEqual([["tick"], ["tick", "tick"], ["tick", "tick"]]);
  });
});
