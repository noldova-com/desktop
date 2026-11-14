/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IWindowPart } from "../../../../src/app/interfaces/i-window-part";
import { SettingsPageEntry } from "../../../../src/app/models/settings/settings-page-entry";
import { SettingsRow } from "../../../../src/app/models/settings/settings-row";
import { WindowPartContext } from "../../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { WindowPartContextHostFixture } from "../../../fixtures/window-part-context-host.fixture";

describe("SettingsPageEntry", () => {
  it("reads its page's rows from its part's context, and has none without a context", () => {
    const context = new WindowPartContext(new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused")), [], [],
      [{ name: "notes.sync", title: "Sync" }]), new WindowPartContextHostFixture());
    const server = new SettingsRow("notes.sync.server", "Sync server");
    context.setSettingsRows("notes.sync", [server]);

    expect([new SettingsPageEntry("notes.sync", "Sync", "notes", null, context, null).rows, new SettingsPageEntry("notes.sync", "Sync", "notes", null, null, null).rows])
      .toEqual([[server], []]);
  });
});
