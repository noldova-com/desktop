/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import "@noldova/context.core";

import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { SettingsPageEntry } from "../../../src/app/models/settings/settings-page-entry";
import { SettingsRow } from "../../../src/app/models/settings/settings-row";
import { WindowPartContext } from "../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { CommandService } from "../../../src/app/services/command.service";
import { SettingsRowsService } from "../../../src/app/services/settings-rows.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { WindowPartContextHostFixture } from "../../fixtures/window-part-context-host.fixture";

describe("SettingsRowsService", () => {
  it("lists every command as a Keyboard shortcuts row, with its title, name and key, then each module page's rows under the page's title, as they change", () => {
    const context = new WindowPartContext(new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused")), [], [],
      [{ name: "notes.sync", title: "Sync" }]), new WindowPartContextHostFixture());
    const commands = [new CommandContribution("notes.newNote", "New note", null, null, () => Promise.resolve(null)), new CommandContribution("notes.sync", "Sync now", null, null, () => Promise.resolve(null))];
    TestBed.configureTestingModule({
      providers: [
        { provide: CommandService, useValue: { commands: signal(commands), keyLabel: (name: string) => name === "notes.newNote" ? "Ctrl+Alt+N" : null } },
        { provide: WindowPartHostService, useValue: { settingsPages: signal([new SettingsPageEntry("notes.sync", "Sync", "notes", null, context, null)]) } }
      ]
    });
    const service = TestBed.inject(SettingsRowsService);
    const before = service.rows().map(t => [t.page, t.row.id, t.row.title, t.row.description]);
    context.setSettingsRows("notes.sync", [new SettingsRow("notes.sync.server", "Sync server", "Where your notes sync to.")]);

    expect(before).toEqual([["Keyboard shortcuts", "notes.newNote", "New note", "Ctrl+Alt+N"], ["Keyboard shortcuts", "notes.sync", "Sync now", null]]);
    expect(service.rows().slice(2).map(t => [t.page, t.row.id, t.row.title, t.row.description])).toEqual([["Sync", "notes.sync.server", "Sync server", "Where your notes sync to."]]);
  });
});
