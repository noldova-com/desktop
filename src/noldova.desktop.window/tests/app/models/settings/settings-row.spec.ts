/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { SettingsRow } from "../../../../src/app/models/settings/settings-row";

describe("SettingsRow", () => {
  it("keeps its id, title and description, with no description by default", () => {
    const rows = [new SettingsRow("notes.sync.server", "Sync server", "Where your notes sync to."), new SettingsRow("notes.sync.interval", "Sync every")];

    expect(rows.map(t => [t.id, t.title, t.description])).toEqual([["notes.sync.server", "Sync server", "Where your notes sync to."], ["notes.sync.interval", "Sync every", null]]);
  });

  it("refuses an id that is not <module id>.<name> and a blank title", () => {
    expect(() => new SettingsRow("server", "Sync server")).toThrowError(ArgumentException);
    expect(() => new SettingsRow("notes.sync.server", " ")).toThrowError("A settings row's title is a string that is not blank.");
  });
});
