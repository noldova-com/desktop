/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShortcutRow } from "../../../../src/app/models/settings/shortcut-row";

describe("ShortcutRow", () => {
  it("holds a command's row: its name, title, owner, key and whether it has a key, was changed or collides", () => {
    const row = new ShortcutRow("notes.sync", "Sync", "Notes", "F6", true, true, "Focus next group", null);

    expect([row.name, row.title, row.owner, row.key, row.hasKey, row.isModified, row.collision, row.paneNote]).toEqual(["notes.sync", "Sync", "Notes", "F6", true, true, "Focus next group", null]);
  });

  it("holds the note that a pane takes its key in the pane's own pages", () => {
    const row = new ShortcutRow("notes.sync", "Sync", "Notes", "Ctrl+L", true, false, null, "Browser takes Ctrl+L in its pages");

    expect([row.collision, row.paneNote]).toEqual([null, "Browser takes Ctrl+L in its pages"]);
  });
});
