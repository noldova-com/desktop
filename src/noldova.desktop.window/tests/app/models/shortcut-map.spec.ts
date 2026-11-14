/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KeyChord } from "@noldova/desktop.protocol";

import { CommandContribution } from "../../../src/app/models/command-contribution";
import { ShortcutBinding } from "../../../src/app/models/shortcut-binding";
import { ShortcutMap } from "../../../src/app/models/shortcut-map";

describe("ShortcutMap", () => {
  const command = (name: string, key: string | null): CommandContribution => new CommandContribution(name, name, null, key, () => Promise.resolve(null));
  const press = (key: string, code: string, modifiers: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>>): KeyboardEventInit & { key: string; code: string } =>
    ({ key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers });

  it("finds the command a key runs, by the platform's modifiers", () => {
    const commands = [command("notes.newNote", "Mod+Alt+N"), command("clock.tick", "Ctrl+Alt+T")];

    const windows = new ShortcutMap([], commands, [], "win32");
    const mac = new ShortcutMap([], commands, [], "darwin");

    expect(windows.find(new KeyboardEvent("keydown", press("n", "KeyN", { ctrlKey: true, altKey: true })))).toBe("notes.newNote");
    expect(mac.find(new KeyboardEvent("keydown", press("n", "KeyN", { metaKey: true, altKey: true })))).toBe("notes.newNote");
    expect(mac.find(new KeyboardEvent("keydown", press("t", "KeyT", { ctrlKey: true, altKey: true })))).toBe("clock.tick");
    expect(windows.find(new KeyboardEvent("keydown", press("n", "KeyN", { ctrlKey: true })))).toBeUndefined();
    expect(windows.keyOf("clock.tick")?.text).toBe("Ctrl+Alt+T");
    expect(windows.keyOf("notes.open")).toBeNull();
    expect(windows.collisions).toEqual([]);
  });

  it("lets the first command keep a contested key and records each collision", () => {
    const commands = [command("clock.tick", "Mod+Alt+T"), command("notes.toggle", "Ctrl+Alt+T"), command("tasks.today", "Mod+Alt+T")];

    const windows = new ShortcutMap([], commands, [], "linux");
    const mac = new ShortcutMap([], commands, [], "darwin");

    expect(windows.collisions.map(t => [t.key.text, t.keptBy, t.refused])).toEqual([["Ctrl+Alt+T", "clock.tick", "notes.toggle"], ["Mod+Alt+T", "clock.tick", "tasks.today"]]);
    expect(mac.collisions.map(t => [t.key.text, t.keptBy, t.refused])).toEqual([["Mod+Alt+T", "clock.tick", "tasks.today"]]);
    expect(windows.keyOf("notes.toggle")).toBeNull();
    expect(mac.keyOf("notes.toggle")?.text).toBe("Ctrl+Alt+T");
  });

  it("gives the shell's keys before modules' defaults, several per command with the first shown, and only to commands that exist", () => {
    const commands = [command("desktop.nextTab", null), command("notes.next", "Ctrl+PageDown"), command("notes.newNote", "Mod+Alt+N")];
    const shellKeys = [[KeyChord.parse("Ctrl+Tab"), "desktop.nextTab"], [KeyChord.parse("Ctrl+PageDown"), "desktop.nextTab"], [KeyChord.parse("Mod+W"), "desktop.closeTab"]] as const;

    const map = new ShortcutMap(shellKeys, commands, [new ShortcutBinding("notes.newNote", KeyChord.parse("Mod+W"))], "win32");

    expect(map.keyOf("desktop.nextTab")?.text).toBe("Ctrl+Tab");
    expect(map.find(new KeyboardEvent("keydown", press("PageDown", "PageDown", { ctrlKey: true })))).toBe("desktop.nextTab");
    expect(map.keyOf("notes.newNote")?.text).toBe("Mod+W");
    expect(map.collisions.map(t => [t.key.text, t.keptBy, t.refused])).toEqual([["Ctrl+PageDown", "desktop.nextTab", "notes.next"]]);
  });

  it("lists each key it gives with its command, every key of a command among them and no refused key", () => {
    const commands = [command("desktop.nextTab", null), command("notes.next", "Ctrl+PageDown"), command("notes.newNote", "Mod+Alt+N")];
    const shellKeys = [[KeyChord.parse("Ctrl+Tab"), "desktop.nextTab"], [KeyChord.parse("Ctrl+PageDown"), "desktop.nextTab"]] as const;

    const map = new ShortcutMap(shellKeys, commands, [], "linux");

    expect(map.pairs.map(([key, name]) => [key.text, name])).toEqual([["Ctrl+Tab", "desktop.nextTab"], ["Ctrl+PageDown", "desktop.nextTab"], ["Mod+Alt+N", "notes.newNote"]]);
  });

  it("keeps a shell key a focused page keeps off the web views' keys, unless the person bound it", () => {
    const commands = [command("desktop.showShortcuts", null), command("desktop.closeTab", null), command("editor.comment", null)];
    const shellKeys = [[KeyChord.parse("Mod+Slash"), "desktop.showShortcuts"], [KeyChord.parse("Mod+W"), "desktop.closeTab"]] as const;
    const texts = (keys: readonly KeyChord[]): readonly string[] => keys.map(t => t.text);

    const kept = new ShortcutMap(shellKeys, commands, [], "darwin", [KeyChord.parse("Mod+Slash")]);
    const bound = new ShortcutMap(shellKeys, commands, [new ShortcutBinding("editor.comment", KeyChord.parse("Mod+Slash"))], "win32", [KeyChord.parse("Mod+Slash")]);

    expect([texts(kept.keys), texts(kept.viewKeys), kept.keyOf("desktop.showShortcuts")?.text]).toEqual([["Mod+Slash", "Mod+W"], ["Mod+W"], "Mod+Slash"]);
    expect([texts(bound.keys), texts(bound.viewKeys), bound.keyOf("editor.comment")?.text]).toEqual([["Mod+Slash", "Mod+W"], ["Mod+Slash", "Mod+W"], "Mod+Slash"]);
  });

  it("drops the shell's keys for a command the person bound", () => {
    const map = new ShortcutMap([[KeyChord.parse("Mod+B"), "desktop.toggleLeftDock"]], [command("desktop.toggleLeftDock", null)], [new ShortcutBinding("desktop.toggleLeftDock", null)], "linux");

    expect(map.keyOf("desktop.toggleLeftDock")).toBeNull();
  });

  it("puts the person's bindings before the defaults and unbinds a command bound to no key", () => {
    const commands = [command("clock.tick", "Mod+Alt+T"), command("notes.newNote", "Mod+Alt+N"), command("tasks.today", null)];
    const bindings = [
      new ShortcutBinding("tasks.today", KeyChord.parse("Mod+Alt+T")),
      new ShortcutBinding("notes.newNote", null),
      new ShortcutBinding("weather.refresh", KeyChord.parse("F5")),
      new ShortcutBinding("clock.tick", KeyChord.parse("Mod+Alt+T"))
    ];

    const map = new ShortcutMap([], commands, bindings, "win32");

    expect(map.keyOf("tasks.today")?.text).toBe("Mod+Alt+T");
    expect(map.keyOf("notes.newNote")).toBeNull();
    expect(map.keyOf("clock.tick")).toBeNull();
    expect(map.find(new KeyboardEvent("keydown", press("F5", "F5", {})))).toBeUndefined();
    expect(map.collisions.map(t => [t.keptBy, t.refused])).toEqual([["tasks.today", "clock.tick"]]);
    expect([map.holderOf(KeyChord.parse("Ctrl+Alt+T")), map.holderOf(KeyChord.parse("F5"))]).toEqual(["tasks.today", undefined]);
  });
});
