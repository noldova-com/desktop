/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModuleState } from "@noldova/desktop.protocol";

import { ModuleFailure } from "../../../src/app/models/module-failure";

describe("ModuleFailure", () => {
  it("holds a failed module, its state, the cause and a copy of its view names", () => {
    const views = ["notes.list"];
    const failure = new ModuleFailure("notes", "Notes", ModuleState.Failed, "Its window part failed to activate.", views);
    views.push("notes.other");

    expect([failure.moduleId, failure.displayName, failure.state, failure.cause, failure.viewNames, failure.documentNames, failure.switchSetting, failure.isTurnedOff])
      .toEqual(["notes", "Notes", ModuleState.Failed, "Its window part failed to activate.", ["notes.list"], [], null, false]);
  });

  it("holds an off module's document names, as a copy, the setting that turns it on, and that it was turned off", () => {
    const documents = ["notes.note"];
    const failure = new ModuleFailure("notes", "Notes", ModuleState.Off, null, [], documents, "notes.enabled", true);
    documents.push("notes.other");

    expect([failure.state, failure.cause, failure.documentNames, failure.switchSetting, failure.isTurnedOff]).toEqual([ModuleState.Off, null, ["notes.note"], "notes.enabled", true]);
  });
});
