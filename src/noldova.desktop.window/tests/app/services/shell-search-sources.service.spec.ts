/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type WritableSignal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/context.json";
import type { SettingDefinition } from "@noldova/desktop.protocol";

import { UpdateStateKind } from "../../../src/app/enums/update-state-kind";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { MenuSearchRow } from "../../../src/app/models/menu-search-row";
import type { SearchResult } from "../../../src/app/models/search-result";
import { SettingsRow } from "../../../src/app/models/settings/settings-row";
import { UpdateState } from "../../../src/app/models/update-state";
import { ClockSettingService } from "../../../src/app/services/clock-setting.service";
import { CommandService } from "../../../src/app/services/command.service";
import { MenuBarService } from "../../../src/app/services/menu-bar.service";
import { RecentCommandsService } from "../../../src/app/services/recent-commands.service";
import { SettingsPageService } from "../../../src/app/services/settings-page.service";
import { SettingsRowsService } from "../../../src/app/services/settings-rows.service";
import { SettingsService } from "../../../src/app/services/settings.service";
import { ShellSearchSourcesService } from "../../../src/app/services/shell-search-sources.service";
import { UpdateService } from "../../../src/app/services/update.service";
import { SettingsFixture } from "../../fixtures/settings.fixture";

describe("ShellSearchSourcesService", () => {
  const command = (name: string, title: string): CommandContribution => new CommandContribution(name, title, null, null, () => Promise.resolve(null));
  let runs: string[];
  let recorded: string[];
  let opened: [string, string | null][];
  let recentIds: WritableSignal<readonly string[]>;
  let values: WritableSignal<ReadonlyMap<string, JsonValue>>;
  let updateKind: WritableSignal<UpdateStateKind>;
  let menuRows: WritableSignal<readonly MenuSearchRow[]>;
  let sources: ShellSearchSourcesService;

  const shown = (results: readonly SearchResult[]): readonly (readonly (string | number | null)[])[] =>
    results.map(t => [t.id, t.title, t.detail, t.titleMatch?.start ?? null, t.titleMatch?.length ?? null, t.detailMatch?.start ?? null, t.keyLabel]);

  beforeEach(() => {
    runs = [];
    recorded = [];
    opened = [];
    recentIds = signal([]);
    values = signal(new Map([["desktop.recentCommandCount", 2]]));
    updateKind = signal(UpdateStateKind.Off);
    menuRows = signal([new MenuSearchRow("desktop.view/notes.shown/0", "Forecast", null, "View")]);
    const commands = [command("notes.newNote", "New note"), command("terminal.toggle", "Toggle terminal"), command("terminal.new", "New terminal"), command("notes.archive", "Archive")];
    const definitions: readonly SettingDefinition[] = [SettingsFixture.timeFormat, SettingsFixture.panelSize, SettingsFixture.updateChecks];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CommandService, useValue: {
            commands: signal(commands),
            isEnabled: (name: string) => name !== "notes.archive",
            ownerOf: (name: string) => name.startsWith("notes") ? "Notes" : "Terminal",
            keyLabel: (name: string) => name === "terminal.toggle" ? "Ctrl+`" : null,
            run: (name: string) => runs.push(name)
          }
        },
        { provide: MenuBarService, useValue: { searchRows: menuRows, run: (id: string) => runs.push(id) } },
        { provide: SettingsService, useValue: { definitions: signal(definitions), values } },
        { provide: ClockSettingService, useValue: { definition: SettingsFixture.define("desktop.clock", "Clock", "Which clock the window shows.", SettingsFixture.mode.type, "System", "General", "Time") } },
        { provide: UpdateService, useValue: { state: () => new UpdateState(updateKind(), null, null, null, null, false) } },
        { provide: RecentCommandsService, useValue: { ids: recentIds, record: (id: string) => recorded.push(id) } },
        { provide: SettingsPageService, useValue: { open: (page: string, setting: string | null) => opened.push([page, setting]) } },
        {
          provide: SettingsRowsService, useValue: {
            rows: signal([
              { page: "Keyboard shortcuts", row: new SettingsRow("terminal.toggle", "Toggle terminal", "Ctrl+`") },
              { page: "Notes", row: new SettingsRow("desktop.timeFormat", "Date format") }
            ])
          }
        }
      ]
    });
    sources = TestBed.inject(ShellSearchSourcesService);
  });

  it("names Commands and Settings, with recent items for the commands only", async () => {
    const { commandsSource, settingsSource } = sources;

    expect([commandsSource.name, commandsSource.label, commandsSource.placeholderName, commandsSource.heading, commandsSource.recentHeading, commandsSource.icon])
      .toEqual(["desktop.commands", "Commands", "commands", "Commands", "Recent commands", "terminal"]);
    expect([settingsSource.name, settingsSource.label, settingsSource.placeholderName, settingsSource.heading, settingsSource.recentHeading, settingsSource.icon])
      .toEqual(["desktop.settings", "Settings", "settings", "Settings", null, "settings"]);
    expect(await settingsSource.recentAsync(new AbortController().signal)).toEqual([]);
  });

  it("finds enabled commands and menu rows, those starting with the query first, marks the match and shows each command's owner and key", async () => {
    const answer = await sources.commandsSource.searchAsync("ne", new AbortController().signal);

    expect(shown(answer.results)).toEqual([["notes.newNote", "New note", "Notes", 0, 2, null, null], ["terminal.new", "New terminal", "Terminal", 0, 2, null, null]]);
    expect(answer.total).toBe(2);
    expect(shown((await sources.commandsSource.searchAsync("term", new AbortController().signal)).results).map(t => t[0])).toEqual(["terminal.new", "terminal.toggle"]);
    expect(shown((await sources.commandsSource.searchAsync("vie", new AbortController().signal)).results)).toEqual([["desktop.view/notes.shown/0", "Forecast", "View", null, null, 0, null]]);
    expect((await sources.commandsSource.searchAsync("archive", new AbortController().signal)).results).toEqual([]);
  });

  it("lists every enabled command and menu row by title, with nothing marked, for an empty query", async () => {
    const answer = await sources.commandsSource.searchAsync(String.empty, new AbortController().signal);

    expect(shown(answer.results)).toEqual([["desktop.view/notes.shown/0", "Forecast", "View", null, null, null, null], ["notes.newNote", "New note", "Notes", null, null, null, null],
      ["terminal.new", "New terminal", "Terminal", null, null, null, null], ["terminal.toggle", "Toggle terminal", "Terminal", null, null, null, "Ctrl+`"]]);
  });

  it("lists a menu row and a command of the same title by where each comes from", async () => {
    menuRows.set([new MenuSearchRow("desktop.file/notes.create/1", "New note", null, "File")]);

    const answer = await sources.commandsSource.searchAsync(String.empty, new AbortController().signal);

    expect(shown(answer.results).slice(0, 2).map(t => [t[0], t[2]])).toEqual([["desktop.file/notes.create/1", "File"], ["notes.newNote", "Notes"]]);
  });

  it("lists the commands last run as recent, as many as the setting asks, and records and runs a command when opened", async () => {
    recentIds.set(["terminal.toggle", "gone.command", "notes.newNote", "terminal.new"]);
    const recent = await sources.commandsSource.recentAsync(new AbortController().signal);

    expect(shown(recent)).toEqual([["terminal.toggle", "Toggle terminal", "Terminal", null, null, null, "Ctrl+`"], ["notes.newNote", "New note", "Notes", null, null, null, null]]);
    await recent[0]?.openAsync();
    await (await sources.commandsSource.searchAsync("forecast", new AbortController().signal)).results[0]?.openAsync();
    expect([recorded, runs]).toEqual([["terminal.toggle", "desktop.view/notes.shown/0"], ["terminal.toggle", "desktop.view/notes.shown/0"]]);
    values.set(new Map());
    expect(await sources.commandsSource.recentAsync(new AbortController().signal)).toEqual([]);
  });

  it("finds settings by their page and title, the clock beside the time format, leaves out About while updates are off, and opens Settings at the setting", async () => {
    const found = await sources.settingsSource.searchAsync("time", new AbortController().signal);

    expect(shown(found.results)).toEqual([["desktop.timeFormat", "General: Time format", "Settings › General", 9, 4, null, null]]);
    expect(shown((await sources.settingsSource.searchAsync("general", new AbortController().signal)).results).map(t => t[0])).toEqual(["desktop.clock", "desktop.timeFormat"]);
    expect((await sources.settingsSource.searchAsync("check for", new AbortController().signal)).results).toEqual([]);
    updateKind.set(UpdateStateKind.UpToDate);
    const updates = (await sources.settingsSource.searchAsync("check for", new AbortController().signal)).results;
    expect(shown(updates)).toEqual([["desktop.updateChecks", "About: Check for updates", "Settings › About", 7, 9, null, null]]);

    await updates[0]?.openAsync();
    expect(opened).toEqual([["About", "desktop.updateChecks"]]);
  });

  it("finds the rows a page lists by their page and title, apart from a setting of the same id, and opens Settings at the row", async () => {
    const times = (await sources.settingsSource.searchAsync("format", new AbortController().signal)).results;
    const toggles = (await sources.settingsSource.searchAsync("toggle", new AbortController().signal)).results;

    expect(shown(times).map(t => t.slice(0, 3))).toEqual([["desktop.timeFormat", "General: Time format", "Settings › General"], ["Notes/desktop.timeFormat", "Notes: Date format", "Settings › Notes"]]);
    expect(shown(toggles)).toEqual([["Keyboard shortcuts/terminal.toggle", "Keyboard shortcuts: Toggle terminal", "Settings › Keyboard shortcuts", 20, 6, null, null]]);
    await times[1]?.openAsync();
    await toggles[0]?.openAsync();
    expect(opened).toEqual([["Notes", "desktop.timeFormat"], ["Keyboard shortcuts", "terminal.toggle"]]);
  });
});
