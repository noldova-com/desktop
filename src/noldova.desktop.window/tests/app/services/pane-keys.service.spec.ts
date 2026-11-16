/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { KeyChord } from "@noldova/desktop.protocol";

import { PaneKeysService } from "../../../src/app/services/pane-keys.service";

describe("PaneKeysService", () => {
  it("lists each open view's declared keys with its module, and forgets a view's keys once it closes", () => {
    const panes = TestBed.inject(PaneKeysService);
    const listed = (): string[] => panes.keys().map(([module, key]) => `${module} ${key.text}`);

    panes.add("1", "browser", [KeyChord.parse("Mod+L"), KeyChord.parse("F6")]);
    panes.add("2", "notes", [KeyChord.parse("Mod+Alt+N")]);
    const both = listed();
    panes.remove("1");
    panes.remove("3");

    expect([both, listed()]).toEqual([["browser Mod+L", "browser F6", "notes Mod+Alt+N"], ["notes Mod+Alt+N"]]);
  });
});
