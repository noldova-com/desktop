/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KeyChord } from "@noldova/desktop.protocol";

import { KeyBindings } from "../../../src/app/models/key-bindings";

describe("KeyBindings", () => {
  it("reads the setting's commands and keys, a removed key as none", () => {
    const bindings = KeyBindings.fromJson({ "notes.newNote": "Shift+Alt+N", "desktop.closeTab": null, "desktop.openSettings": "Mod+Comma" });

    expect(bindings.list.map(t => [t.command, t.key?.text ?? null])).toEqual([["notes.newNote", "Alt+Shift+N"], ["desktop.closeTab", null], ["desktop.openSettings", "Mod+Comma"]]);
    expect([bindings.has("desktop.closeTab"), bindings.has("clock.tick")]).toEqual([true, false]);
  });

  it("holds nothing and skips nothing before the settings load", () => {
    const bindings = KeyBindings.fromJson(undefined);

    expect([bindings.list, [...bindings.skipped]]).toEqual([[], []]);
  });

  it("skips a setting that is not an object of commands and keys, and says why", () => {
    const bindings = KeyBindings.fromJson(["notes.newNote"]);

    expect([bindings.list, [...bindings.skipped]]).toEqual([[], [["desktop.keyBindings", "the setting is not an object of commands and keys, so no key is changed"]]]);
  });

  it("skips an entry it cannot read, says why, and keeps the rest", () => {
    const bindings = KeyBindings.fromJson({ "notes.newNote": "Mod+W", "notes.open": "Shift+K", "notes": "F6", "clock.tick": "Mod+Plus", "clock.stop": 5, "clock.reset": "Hyper+K", "desktop.closeTab": "F7", "clock.pause": null });

    expect(bindings.toJson()).toEqual({ "desktop.closeTab": "F7", "clock.pause": null });
    expect([...bindings.skipped.keys()]).toEqual(["notes.newNote", "notes.open", "notes", "clock.tick", "clock.stop", "clock.reset"]);
    expect(["notes.newNote", "notes.open", "notes", "clock.stop", "clock.reset"].map(t => bindings.skipped.get(t))).toEqual([
      "its key is a typing key or one the shell keeps",
      "its key is a typing key or one the shell keeps",
      "it doesn't name a command as module.command",
      "its key is neither text nor null",
      "its key is not a key chord"
    ]);
  });

  it("adds, replaces and removes a command's entry without changing the original, and writes the setting's value", () => {
    const empty = KeyBindings.fromJson({});
    const bound = empty.with("notes.newNote", KeyChord.parse("F6")).with("clock.tick", null);
    const moved = bound.with("notes.newNote", KeyChord.parse("Mod+Alt+K")).without("clock.tick");

    expect([empty.toJson(), bound.toJson(), moved.toJson()]).toEqual([{}, { "notes.newNote": "F6", "clock.tick": null }, { "notes.newNote": "Mod+Alt+K" }]);
  });

  it("is the same as bindings with the same keys in any order", () => {
    const bindings = KeyBindings.fromJson({ "notes.newNote": "F6", "clock.tick": null });

    expect([
      bindings.isSameAs(KeyBindings.fromJson({ "clock.tick": null, "notes.newNote": "F6" })),
      bindings.isSameAs(KeyBindings.fromJson({ "notes.newNote": "F6", "clock.stop": null })),
      bindings.isSameAs(KeyBindings.fromJson({ "notes.newNote": "F7", "clock.tick": null })),
      bindings.isSameAs(KeyBindings.fromJson({ "notes.newNote": "F6" }))
    ]).toEqual([true, false, false, false]);
  });
});
