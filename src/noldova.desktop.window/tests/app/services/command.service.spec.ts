/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DialogService } from "@noldova/ui.components.angular";
import { JsonReader, type JsonObject } from "@noldova/context.json";
import { KeyChord } from "@noldova/desktop.protocol";

import { ActionNotConfirmedException } from "../../../src/app/exceptions/action-not-confirmed.exception";
import { CommandNotFoundException } from "../../../src/app/exceptions/command-not-found.exception";
import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { CommandService } from "../../../src/app/services/command.service";
import { PaneKeysService } from "../../../src/app/services/pane-keys.service";
import { ShellCommandsService } from "../../../src/app/services/shell-commands.service";
import { StartupService } from "../../../src/app/services/startup.service";
import { DomFixture } from "../../fixtures/dom.fixture";
import { FailureFixture } from "../../fixtures/failure.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { ModuleStatusFixture } from "../../fixtures/module-status.fixture";
import { ViewDialogFixture } from "../../fixtures/view-dialog.fixture";

describe("CommandService", () => {
  let errors: unknown[];
  let runs: string[];

  const command = (name: string, key: string | null, failure: Error | null = null): CommandContribution =>
    new CommandContribution(name, name, null, key, async t => {
      runs.push(`${name} ${JSON.stringify(t)}`);
      if (!Object.isNull(failure))
        throw failure;
      return name;
    });

  let bridge: PreloadBridgeFixture;
  let added: Element[];

  function start(platform: string, isDialogOpen: boolean = false, viewModule: string | null = null): CommandService {
    bridge = PreloadBridgeFixture.install(platform);
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: DialogService, useValue: { isOpen: isDialogOpen } },
        ViewDialogFixture.provideShowing(viewModule)
      ]
    });
    return TestBed.inject(CommandService);
  }

  function press(init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    document.body.dispatchEvent(event);
    return event;
  }

  function keeper(): HTMLInputElement {
    const element = document.createElement("div");
    element.setAttribute("data-nol-keeps-ctrl-keys", String.empty);
    const input = document.createElement("input");
    element.append(input);
    document.body.append(element);
    added.push(element);
    return input;
  }

  function pressIn(target: Element, init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    errors = [];
    runs = [];
    added = [];
  });

  afterEach(() => {
    added.forEach(t => t.remove());
    PreloadBridgeFixture.remove();
  });

  it("runs a command by name with its arguments and refuses one that is not registered", async () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", null)]);

    expect(await service.runAsync("notes.newNote", { folder: "inbox" })).toBe("notes.newNote");
    expect(await service.runAsync("notes.newNote")).toBe("notes.newNote");
    await expect(service.runAsync("clock.tick")).rejects.toThrowError(CommandNotFoundException);
    expect(runs).toEqual(["notes.newNote {\"folder\":\"inbox\"}", "notes.newNote null"]);
    const shell = TestBed.inject(ShellCommandsService).commands;
    expect(service.commands().slice(0, shell.length)).toEqual(shell);
    expect(service.commands().slice(shell.length).map(t => t.name)).toEqual(["notes.newNote"]);
  });

  it("runs the command a key press is bound to and keeps the browser from handling it", async () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);

    const pressed = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    const other = press({ key: "n", code: "KeyN", ctrlKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote null"]));
    expect(pressed.defaultPrevented).toBe(true);
    expect(other.defaultPrevented).toBe(false);
  });

  it("offers no command and runs none for a key while the runtime starts again", async () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);
    await vi.waitFor(() => expect(TestBed.inject(StartupService).hasStarted()).toBe(true));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    const whileStarting = [service.isEnabled("notes.newNote"), press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true }).defaultPrevented];
    bridge.publishStartup({ kind: "Ready", details: [] });

    expect(whileStarting).toEqual([false, false]);
    expect(service.isEnabled("notes.newNote")).toBe(true);
    expect(runs).toEqual([]);
  });

  it("runs no command from anywhere while the runtime starts again, but keeps the edit commands", async () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", null)]);
    await vi.waitFor(() => expect(TestBed.inject(StartupService).hasStarted()).toBe(true));
    const input = document.createElement("input");
    input.value = "draft";
    document.body.append(input);
    input.focus();

    bridge.publishStartup({ kind: "Connecting", details: [] });
    const ran = await service.runAsync("notes.newNote");
    service.run("notes.newNote");
    const whileStarting = [service.isAvailable("notes.newNote"), service.isAvailable("desktop.selectAll")];
    bridge.publishStartup({ kind: "Ready", details: [] });
    input.remove();

    expect(ran).toBeNull();
    expect(whileStarting).toEqual([false, true]);
    expect([service.isAvailable("notes.newNote"), service.isAvailable("clock.tick")]).toEqual([true, false]);
    expect(runs).toEqual([]);
  });

  it("uses Cmd for Mod on macOS", async () => {
    const service = start("darwin");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);

    press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    press({ key: "n", code: "KeyN", metaKey: true, altKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote null"]));
  });

  it("runs only the edit commands' keys while a modal dialog is open, leaving the rest to the page", async () => {
    const service = start("win32", true);
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.keyBindings", value: { "desktop.selectAll": "F7" }, isSet: true });
    const input = document.createElement("input");
    input.value = "draft";
    document.body.append(input);
    input.focus();

    const module = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    const shell = press({ key: ",", code: "Comma", ctrlKey: true });
    const edit = new KeyboardEvent("keydown", { key: "F7", code: "F7", bubbles: true, cancelable: true });
    input.dispatchEvent(edit);
    input.remove();

    expect(runs).toEqual([]);
    expect([module.defaultPrevented, shell.defaultPrevented, edit.defaultPrevented]).toEqual([false, false, true]);
  });

  it("runs the keys of the module whose view a dialog shows, as in its tab, but still leaves the shell's to the page", async () => {
    const service = start("win32", true, "notes");
    service.setCommands([command("notes.newNote", "Mod+Alt+N"), command("clock.tick", "Mod+Alt+T")]);

    const module = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    const other = press({ key: "t", code: "KeyT", ctrlKey: true, altKey: true });
    const closeTab = press({ key: "w", code: "KeyW", ctrlKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote null"]));
    expect([module.defaultPrevented, other.defaultPrevented, closeTab.defaultPrevented]).toEqual([true, false, false]);
    expect(["notes.newNote", "clock.tick", "desktop.closeTab", "desktop.selectAll"].map(t => service.isHeldByDialog(t))).toEqual([false, true, true, false]);
  });

  it("leaves keys an input or editor handled, composed text and repeats alone", () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);
    const input = document.createElement("input");
    document.body.append(input);
    input.addEventListener("keydown", t => t.preventDefault());

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "n", code: "KeyN", ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    const composing = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true, isComposing: true });
    const repeated = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true, repeat: true });
    input.remove();

    expect(runs).toEqual([]);
    expect([composing.defaultPrevented, repeated.defaultPrevented]).toEqual([false, false]);
  });

  it("runs the command bound to a key an open view's pane declares when the key is pressed in the pane's toolbar, outside its view", async () => {
    const service = start("linux");
    service.setCommands([command("notes.newNote", null)]);
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.keyBindings", value: { "notes.newNote": "F7" }, isSet: true });
    TestBed.inject(PaneKeysService).add("1", "pages", [KeyChord.parse("F7")]);
    const group = document.body.appendChild(document.createElement("nol-tab-group"));
    added.push(group);
    group.innerHTML = "<nol-tab-slot><button id='reload'>Reload</button><div class='nol-web-view'><webview class='nol-web-view-guest'></webview></div></nol-tab-slot>";

    const pressed = pressIn(DomFixture.one(group, "#reload"), { key: "F7", code: "F7" });

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote null"]));
    expect(pressed.defaultPrevented).toBe(true);
  });

  it("applies the person's bindings as the setting changes and reports a command that fails", async () => {
    const service = start("linux");
    service.setCommands([command("notes.newNote", "Mod+Alt+N", new Error("notes.newNote failed"))]);
    const before = service.keyLabel("notes.newNote");
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.keyBindings", value: { "notes.newNote": "F6" }, isSet: true });

    press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    press({ key: "F6", code: "F6" });

    await vi.waitFor(() => expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual(["notes.newNote failed"]));
    expect(runs).toEqual(["notes.newNote null"]);
    expect(service.shortcuts().keyOf("notes.newNote")?.text).toBe("F6");
    expect([before, service.keyLabel("notes.newNote"), service.bindings().has("notes.newNote")]).toEqual(["Ctrl+Alt+N", "F6", true]);
  });

  it("logs each binding it skips with its command and reason, and keeps the rest", () => {
    const service = start("linux");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);
    TestBed.tick();
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.keyBindings", value: { "notes.newNote": "F6", "notes": "F7", "clock.stop": 5 }, isSet: true });
    TestBed.tick();

    expect(bridge.errorsLogged).toEqual([
      [null, "The key binding of \"notes\" was skipped: it doesn't name a command as module.command."],
      [null, "The key binding of \"clock.stop\" was skipped: its key is neither text nor null."]
    ]);
    expect(service.keyLabel("notes.newNote")).toBe("F6");
  });

  it("tells the main process the window's keys with their commands, and again as a binding changes", () => {
    const service = start("linux");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);
    TestBed.tick();
    const before = bridge.appShortcuts.at(-1);
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.keyBindings", value: { "notes.newNote": "F6" }, isSet: true });
    TestBed.tick();
    const listed = (list: JsonObject | undefined): JsonObject[] => JsonReader.fromValue(list).readObjectArray("shortcuts").filter(t => t.readString("command") === "notes.newNote").map(t => t.toJson());

    expect(listed(before)).toEqual([{ key: "Mod+Alt+N", command: "notes.newNote", isGlobal: false }]);
    expect(listed(bridge.appShortcuts.at(-1))).toEqual([{ key: "F6", command: "notes.newNote", isGlobal: false }]);
    expect(bridge.appShortcuts.at(-1)?.["shortcuts"]).toHaveLength(service.shortcuts().pairs.length);
  });

  it("names a command's owner: the product for the shell's, the name the runtime reports for its module, or else its id", () => {
    const service = start("win32");
    ModuleStatusFixture.report(ModuleStatusFixture.create("notes", "Notes"));

    expect(["desktop.closeTab", "notes.newNote", "clock.tick"].map(t => service.ownerOf(t))).toEqual(["Noldova Desktop Sample", "Notes", "clock"]);
  });

  it("leaves the key of a disabled command to the page, and says which commands are enabled for given arguments", async () => {
    const service = start("win32");
    let isOn = false;
    service.setCommands([new CommandContribution("notes.archive", "Archive", null, "Mod+Alt+A", async () => {
      runs.push("notes.archive");
      return null;
    }, t => isOn || !Object.isNull(t))]);

    const off = press({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    isOn = true;
    const on = press({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.archive"]));
    expect([off.defaultPrevented, on.defaultPrevented]).toEqual([false, true]);
    expect([service.isEnabled("notes.archive"), service.isEnabled("notes.archive", { id: 1 })]).toEqual([true, true]);
    expect(() => service.isEnabled("notes.gone")).toThrowError(CommandNotFoundException);
  });

  it("counts a command whose enabled check throws as disabled, reports the failure and leaves its key to the page", () => {
    const service = start("linux");
    service.setCommands([new CommandContribution("notes.openNote", "Open note", null, "Mod+Alt+O", async () => {
      runs.push("notes.openNote");
      return null;
    }, () => {
      throw new Error("The arguments name no note.");
    })]);

    const pressed = press({ key: "o", code: "KeyO", ctrlKey: true, altKey: true });

    expect([service.isEnabled("notes.openNote"), pressed.defaultPrevented, runs.length]).toEqual([false, false, 0]);
    expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual(["The arguments name no note.", "The arguments name no note."]);
  });

  it("asks a command whether it is checked, counts one with no check or whose check throws as unchecked and reports the failure", () => {
    const service = start("win32");
    service.setCommands([
      new CommandContribution("notes.wrapLines", "Wrap lines", null, null, () => Promise.resolve(null), () => true, t => !Object.isNull(t)),
      new CommandContribution("notes.newNote", "New note", null, null, () => Promise.resolve(null)),
      new CommandContribution("notes.sorting", "Sorting", null, null, () => Promise.resolve(null), () => true, () => {
        throw new Error("No sorting.");
      })
    ]);

    expect([service.isChecked("notes.wrapLines"), service.isChecked("notes.wrapLines", { on: true }), service.isChecked("notes.newNote"), service.isChecked("notes.sorting")])
      .toEqual([false, true, false, false]);
    expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual(["No sorting."]);
    expect(service.isChecked("notes.gone")).toBe(false);
    expect(errors.map(t => t instanceof CommandNotFoundException)).toEqual([false, true]);
  });

  it("labels a command's key for the platform, and has none for a command without one", () => {
    const service = start("darwin");
    service.setCommands([command("notes.newNote", "Mod+Alt+N"), command("notes.sync", null)]);

    expect([service.keyLabel("notes.newNote"), service.keyLabel("notes.sync")]).toEqual(["⌥⌘N", null]);
    expect([service.keyOf("notes.newNote"), service.keyOf("notes.sync"), service.keyOf("notes.gone")]).toEqual([{ label: "⌥⌘N", ariaKeyShortcuts: "Alt+Meta+N" }, null, null]);
    expect(service.titleOf("notes.sync")).toBe("notes.sync");
    expect(() => service.titleOf("notes.gone")).toThrowError(CommandNotFoundException);
  });

  it("lists a command's default keys on the platform, the shell's own and a module's", () => {
    const service = start("darwin");
    service.setCommands([command("notes.newNote", "Mod+Alt+N"), command("notes.sync", null)]);

    expect(["desktop.nextTab", "notes.newNote", "notes.sync"].map(t => service.defaultKeysOf(t).map(u => u.text))).toEqual([["Ctrl+Tab", "Mod+Alt+ArrowRight"], ["Mod+Alt+N"], []]);
  });

  it("runs a command by name and reports its failure", async () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", null, new Error("notes.newNote failed"))]);

    service.run("notes.newNote", { folder: "inbox" });
    service.run("notes.gone");

    await vi.waitFor(() => expect(errors.map(t => FailureFixture.of(t, Error).constructor.name).sort()).toEqual(["CommandNotFoundException", "Error"]));
    expect(runs).toEqual(["notes.newNote {\"folder\":\"inbox\"}"]);
  });

  it("reports a command that did not finish because the connection to the runtime ended as an action not confirmed, whether run by name or by its key", async () => {
    const service = start("win32");
    const disconnected = new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime.");
    service.setCommands([command("notes.save", "Mod+Alt+S", new Error("The note was not saved.", { cause: disconnected }))]);

    const run = await service.runAsync("notes.save").catch((error: unknown) => error);
    press({ key: "s", code: "KeyS", ctrlKey: true, altKey: true });

    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect([run, errors[0]].map(t => [t instanceof ActionNotConfirmedException, FailureFixture.of(t, Error).message])).toEqual([
      [true, "The command notes.save did not finish because the connection to the runtime ended."],
      [true, "The command notes.save did not finish because the connection to the runtime ended."]
    ]);
  });

  it("runs a Ctrl+key command for its Ctrl+Shift+key inside an element that keeps Ctrl keys, and only there", async () => {
    const service = start("win32");
    service.setCommands([command("notes.find", "Mod+U")]);
    const input = keeper();

    const shifted = pressIn(input, { key: "U", code: "KeyU", ctrlKey: true, shiftKey: true });
    const plain = pressIn(input, { key: "u", code: "KeyU", ctrlKey: true });
    const outside = press({ key: "U", code: "KeyU", ctrlKey: true, shiftKey: true });
    const withAlt = pressIn(input, { key: "U", code: "KeyU", ctrlKey: true, shiftKey: true, altKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.find null", "notes.find null"]));
    expect([shifted.defaultPrevented, plain.defaultPrevented, outside.defaultPrevented, withAlt.defaultPrevented]).toEqual([true, true, false, false]);
  });

  it("runs a key's own Ctrl+Shift binding inside an element that keeps Ctrl keys", async () => {
    const service = start("linux");
    service.setCommands([command("notes.find", "Mod+U"), command("notes.findAll", "Mod+Shift+U")]);
    const input = keeper();

    const shifted = pressIn(input, { key: "U", code: "KeyU", ctrlKey: true, shiftKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.findAll null"]));
    expect(shifted.defaultPrevented).toBe(true);
  });

  it("runs nothing for a Ctrl+Shift+key whose own command is disabled or held by a dialog inside an element that keeps Ctrl keys, rather than its Ctrl+key command", async () => {
    const service = start("win32", true, "notes");
    const findAll = (name: string, isEnabled: boolean): CommandContribution => new CommandContribution(name, name, null, "Mod+Shift+U", async () => {
      runs.push(name);
      return null;
    }, () => isEnabled);
    const input = keeper();
    const answers: (string | null)[] = [];
    input.addEventListener("keydown", t => answers.push(service.findWindowCommand(t)));
    const shifted = (): KeyboardEvent => pressIn(input, { key: "U", code: "KeyU", ctrlKey: true, shiftKey: true });

    service.setCommands([command("notes.find", "Mod+U"), findAll("notes.findAll", false)]);
    const disabled = shifted();
    service.setCommands([command("notes.find", "Mod+U"), findAll("tasks.findAll", true)]);
    const held = shifted();
    const plain = pressIn(input, { key: "u", code: "KeyU", ctrlKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.find null"]));
    expect([disabled.defaultPrevented, held.defaultPrevented, plain.defaultPrevented]).toEqual([false, false, true]);
    expect(answers).toEqual([null, null, "notes.find"]);
  });

  it("leaves the editing keys to an element that keeps Ctrl keys, with or without Shift, but not to the rest of the window", () => {
    const service = start("win32");
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.keyBindings", value: { "desktop.selectAll": "Mod+E", "desktop.redo": "Mod+Shift+R" }, isSet: true });
    const input = keeper();
    const other = document.createElement("input");
    document.body.append(other);
    added.push(other);

    input.focus();
    const inside = [
      pressIn(input, { key: "e", code: "KeyE", ctrlKey: true }),
      pressIn(input, { key: "E", code: "KeyE", ctrlKey: true, shiftKey: true }),
      pressIn(input, { key: "R", code: "KeyR", ctrlKey: true, shiftKey: true })
    ];
    other.focus();
    const outside = pressIn(other, { key: "e", code: "KeyE", ctrlKey: true });

    expect([...inside.map(t => t.defaultPrevented), outside.defaultPrevented]).toEqual([false, false, false, true]);
    expect(service.isAvailable("desktop.selectAll")).toBe(true);
  });

  it("keeps the keys as they are on macOS inside an element that keeps Ctrl keys", async () => {
    const service = start("darwin");
    service.setCommands([command("notes.find", "Mod+U")]);
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.keyBindings", value: { "desktop.selectAll": "Mod+E" }, isSet: true });
    const input = keeper();
    input.focus();

    const ctrlShifted = pressIn(input, { key: "U", code: "KeyU", ctrlKey: true, shiftKey: true });
    const cmdShifted = pressIn(input, { key: "U", code: "KeyU", metaKey: true, shiftKey: true });
    const cmd = pressIn(input, { key: "u", code: "KeyU", metaKey: true });
    const selectAll = pressIn(input, { key: "e", code: "KeyE", metaKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.find null"]));
    expect([ctrlShifted.defaultPrevented, cmdShifted.defaultPrevented, cmd.defaultPrevented, selectAll.defaultPrevented]).toEqual([false, false, true, true]);
  });

  it("names the command the window would run for a key, so an element that keeps Ctrl keys can leave it only its own module's and Ctrl+Shift keys", async () => {
    const service = start("win32");
    service.setCommands([command("notes.find", "Mod+U"), command("notes.toggle", "Mod+L"), command("tasks.add", "Mod+G")]);
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.keyBindings", value: { "notes.find": "F6", "desktop.selectAll": "Mod+E" }, isSet: true });
    const input = keeper();
    input.focus();
    const answers: (string | null)[] = [];
    input.addEventListener("keydown", t => {
      const name = service.findWindowCommand(t);
      answers.push(name);
      if (!Object.isNull(name) && !name.startsWith("notes.") && !t.shiftKey)
        t.preventDefault();
    });

    pressIn(input, { key: "F6", code: "F6" });
    pressIn(input, { key: "u", code: "KeyU", ctrlKey: true });
    pressIn(input, { key: "l", code: "KeyL", ctrlKey: true });
    pressIn(input, { key: "G", code: "KeyG", ctrlKey: true, shiftKey: true });
    pressIn(input, { key: "g", code: "KeyG", ctrlKey: true });
    pressIn(input, { key: "b", code: "KeyB", ctrlKey: true });
    pressIn(input, { key: "e", code: "KeyE", ctrlKey: true });
    pressIn(input, { key: "x", code: "KeyX", ctrlKey: true });
    pressIn(input, { key: "l", code: "KeyL", ctrlKey: true, isComposing: true });

    expect(answers).toEqual(["notes.find", null, "notes.toggle", "tasks.add", "tasks.add", "desktop.toggleLeftDock", null, null, null]);
    await vi.waitFor(() => expect(runs).toEqual(["notes.find null", "notes.toggle null", "tasks.add null"]));
  });

  it("stops listening when the window closes", () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);

    TestBed.resetTestingModule();
    const event = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });

    expect(event.defaultPrevented).toBe(false);
  });
});
