/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { CommandRun, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName, SettingChange, SettingKey, SettingOption, SettingScope, WebViewPane } from "@noldova/desktop.protocol";
import { LinkGesture } from "@noldova/ui.components.angular";

import { DockSide } from "../../../src/app/enums/dock-side";
import { LinkPlace } from "../../../src/app/enums/link-place";
import { FileSaveOutcome } from "../../../src/app/enums/file-save-outcome";
import { WebViewClosedException } from "../../../src/app/exceptions/web-view-closed.exception";
import { WindowPartAccessException } from "../../../src/app/exceptions/window-part-access.exception";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import type { IFilePathChoiceOptions } from "../../../src/app/interfaces/i-file-path-choice-options";
import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import { DocumentContribution } from "../../../src/app/models/document-contribution";
import { IssuedFileGrant } from "../../../src/app/models/issued-file-grant";
import { IssuedFileGrants } from "../../../src/app/models/issued-file-grants";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { MenuRowContribution } from "../../../src/app/models/menu-row-contribution";
import { PlaceholderContribution } from "../../../src/app/models/placeholder-contribution";
import { SearchAnswer } from "../../../src/app/models/search-answer";
import { SearchSourceContribution } from "../../../src/app/models/search-source-contribution";
import { SettingsPageContribution } from "../../../src/app/models/settings-page-contribution";
import { SettingsRow } from "../../../src/app/models/settings/settings-row";
import { StatusBarItemContribution } from "../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";
import { TopBarActionContribution } from "../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";
import { ViewBadge } from "../../../src/app/models/view-badge";
import { ViewContribution } from "../../../src/app/models/view-contribution";
import { WindowPartContext } from "../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { WindowPartContextHostFixture } from "../../fixtures/window-part-context-host.fixture";

@Component({ template: "" })
class ListComponent {
}

describe("WindowPartContext", () => {
  const notification = (kind: string, title: string, action: string | null): NotificationPost => new NotificationPost(
    QualifiedName.parse(kind), null, title, null, NotificationSeverity.Info, null,
    Object.isNull(action) ? [] : [new NotificationAction("Show", new CommandRun(QualifiedName.parse(action), null))], null);
  const load = (): Promise<Type<unknown>> => Promise.resolve(ListComponent);
  const searchSource = (name: string): SearchSourceContribution =>
    new SearchSourceContribution(name, "Notes", "notes", "Notes", null, "description", () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([])));
  const view = (name: string): ViewContribution => new ViewContribution(name, "Notes", "sticky_note_2", DockSide.Left, true, load);
  const instanceView = (tabRowPlace?: string): ViewContribution => new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, false, load, undefined,
    Object.isUndefined(tabRowPlace) ? { hasInstances: true } : { hasInstances: true, tabRowPlace });
  let host: WindowPartContextHostFixture;
  let context: WindowPartContext;

  beforeEach(() => {
    host = new WindowPartContextHostFixture();
    const source = new WindowPartSource("notes", ["tasks"], ["notes.list"], ["notes.note"], ["notes.newNote", "notes.taken"], ["notes.count", "notes.sync"], ["notes.compose", "notes.share"], ["notes.saved"],
      () => Promise.reject<IWindowPart>(new Error("unused")));
    context = new WindowPartContext(source, host);
  });

  it("posts and dismisses its declared notifications, and dismisses the rest when withdrawn", async () => {
    const first = await context.postNotificationAsync(notification("notes.saved", "Saved", "tasks.show"));
    const second = await context.postNotificationAsync(notification("notes.saved", "Saved again", "notes.newNote"));
    first.dismiss();
    first.dismiss();
    context.withdraw();
    second.dismiss();

    expect([first.id, second.id]).toEqual(["1", "2"]);
    expect(host.calls).toEqual(["post Saved", "post Saved again", "dismiss 1", "dismiss 2", "refresh"]);
  });

  it("keeps its save steps in order until it removes one or is withdrawn, and removing a step twice changes nothing", () => {
    const first = (): Promise<void> => Promise.resolve();
    const second = (): Promise<void> => Promise.resolve();
    const third = (): Promise<void> => Promise.resolve();

    const removeFirst = context.registerSave(first);
    context.registerSave(second);
    context.registerSave(third);
    const registered = [...context.saves];
    removeFirst();
    removeFirst();
    const remaining = [...context.saves];
    context.withdraw();

    expect(registered).toEqual([first, second, third]);
    expect(remaining).toEqual([second, third]);
    expect(context.saves).toEqual([]);
  });

  it("registers a selection source with the window until it removes it or is withdrawn", () => {
    const terminal = document.createElement("div");
    const log = document.createElement("div");
    const source = { hasSelection: () => true, readSelection: () => "total 8" };

    const removeTerminal = context.registerSelectionSource(terminal, source);
    context.registerSelectionSource(log, source);
    const registered = [...host.selectionSources.keys()];
    removeTerminal();
    const remaining = [...host.selectionSources.keys()];
    context.withdraw();

    expect(registered).toEqual([terminal, log]);
    expect(remaining).toEqual([log]);
    expect(host.selectionSources.size).toBe(0);
  });

  it("provides the part's undo to the window until it withdraws it or is withdrawn", () => {
    const provider = { canUndo: () => true, undoAsync: () => Promise.resolve() };

    const withdrawUndo = context.provideUndo(provider);
    const provided = [...host.undoProviders];
    withdrawUndo();
    const withdrawnByPart = host.calls.filter(t => t === "withdrawUndo").length;
    context.provideUndo(provider);
    context.withdraw();

    expect([provided, withdrawnByPart]).toEqual([[provider], 1]);
    expect(host.calls.filter(t => t === "withdrawUndo")).toHaveLength(3);
  });

  it("refuses a notification of another module, an undeclared kind or another module's command", async () => {
    await context.postNotificationAsync(notification("notes.saved", "Saved", null));

    await expect(context.postNotificationAsync(notification("tasks.due", "Due", null))).rejects.toThrowError(WindowPartAccessException);
    await expect(context.postNotificationAsync(notification("notes.deleted", "Deleted", null)))
      .rejects.toThrowError("The module notes does not declare the notification kind notes.deleted.");
    await expect(context.postNotificationAsync(notification("notes.saved", "Saved", "calendar.show"))).rejects.toThrowError(WindowPartAccessException);
    await expect(context.postNotificationAsync(new NotificationPost(QualifiedName.parse("notes.saved"), null, "Opened", null, NotificationSeverity.Info,
      new CommandRun(QualifiedName.parse("calendar.show"), null), [], null))).rejects.toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["post Saved"]);
  });

  it("posts a notification that opens one of its own commands", async () => {
    await context.postNotificationAsync(new NotificationPost(QualifiedName.parse("notes.saved"), null, "Opened", null, NotificationSeverity.Info,
      new CommandRun(QualifiedName.parse("notes.newNote"), null), [], null));

    expect(host.calls).toEqual(["post Opened"]);
  });

  it("reads its own, its dependencies' and the shell's settings, changes only its own, and hears their changes until withdrawn", async () => {
    const folder = new SettingScope(QualifiedName.parse("notes.folder"), "f1");
    const heard: string[] = [];
    context.onSettingChanged("tasks.size", (value, scope, isSet) => heard.push(`${String(value)} ${scope?.id ?? "app"} ${String(isSet)}`));

    const read = ["notes.sortBy", "tasks.size", "desktop.mode", "notes.missing"].map(t => context.readSetting(t));
    const entries = await Promise.all([context.readSettingAsync("notes.sortBy", folder), context.readSettingAsync("tasks.size", folder), context.readSettingAsync("desktop.mode")]);
    await context.writeSettingAsync("notes.sortBy", "date");
    await context.writeSettingAsync("notes.sortBy", "title", folder);
    await context.resetSettingAsync("notes.sortBy");
    await context.resetSettingAsync("notes.sortBy", folder);
    host.changeSetting(new SettingChange(new SettingKey(QualifiedName.parse("desktop.mode")), "Dark", true));
    host.changeSetting(new SettingChange(new SettingKey(QualifiedName.parse("tasks.size"), folder), 2, true));
    host.changeSetting(new SettingChange(new SettingKey(QualifiedName.parse("tasks.size"), folder), 1, false));
    context.withdraw();
    host.changeSetting(new SettingChange(new SettingKey(QualifiedName.parse("tasks.size")), 3, true));

    expect(read).toEqual(["notes.sortBy value", "tasks.size value", "desktop.mode value", undefined]);
    expect(entries.map(t => `${t.name.text}=${String(t.value)} ${String(t.isSet)}`)).toEqual(["notes.sortBy=notes.sortBy at f1 true", "tasks.size=tasks.size at f1 true", "desktop.mode=desktop.mode at app false"]);
    expect(host.calls).toEqual(["read notes.sortBy f1", "read tasks.size f1", "read desktop.mode app", "write notes.sortBy \"date\" app", "write notes.sortBy \"title\" f1", "reset notes.sortBy app", "reset notes.sortBy f1", "refresh"]);
    expect(heard).toEqual(["2 f1 true", "1 f1 false"]);
    expect(() => context.readSetting("clock.speed")).toThrowError(WindowPartAccessException);
    await expect(context.readSettingAsync("clock.speed", folder)).rejects.toThrowError(WindowPartAccessException);
    expect(() => context.onSettingChanged("clock.speed", () => undefined)).toThrowError(WindowPartAccessException);
    await expect(context.writeSettingAsync("tasks.size", 1)).rejects.toThrowError(WindowPartAccessException);
    await expect(context.resetSettingAsync("desktop.mode")).rejects.toThrowError(WindowPartAccessException);
  });

  it("reaches its optional dependencies' names and hears them turn on or off, each listener apart, until stopped or withdrawn", () => {
    const part = new WindowPartContext(new WindowPartSource("notes", ["tasks"], [], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused")), [], ["clock"]), host);
    const heard: string[] = [];
    const failures: unknown[] = [];
    const stop = part.onDependencyChanged((moduleId, isActive) => heard.push(`first ${moduleId} ${String(isActive)}`));
    part.onDependencyChanged(() => {
      throw new Error("The face is gone.");
    });
    part.onDependencyChanged((moduleId, isActive) => heard.push(`last ${moduleId} ${String(isActive)}`));

    part.announceDependency("clock", false, t => failures.push(t));
    stop();
    part.announceDependency("clock", true, t => failures.push(t));
    part.withdraw();
    part.announceDependency("clock", false, t => failures.push(t));

    expect(["notes.list", "tasks.changed", "clock.tick", "calendar.show"].map(t => part.isAllowed(t))).toEqual([true, true, true, false]);
    expect(heard).toEqual(["first clock false", "last clock false", "last clock true"]);
    expect(failures.map(String)).toEqual(["Error: The face is gone.", "Error: The face is gone."]);
  });

  it("answers whether an optional dependency is active as its listeners were last told, in their own call too, and false before any change and once withdrawn", () => {
    const part = new WindowPartContext(new WindowPartSource("notes", ["tasks"], [], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused")), [], ["clock"]), host);
    const heard: string[] = [];
    const before = part.isDependencyActive("clock");
    part.onDependencyChanged((moduleId, isActive) => heard.push(`${moduleId} ${String(isActive)} ${String(part.isDependencyActive(moduleId))}`));

    part.announceDependency("clock", true, () => undefined);
    const on = ["clock", "tasks"].map(t => part.isDependencyActive(t));
    part.announceDependency("clock", false, () => undefined);

    const off = part.isDependencyActive("clock");
    part.announceDependency("clock", true, () => undefined);
    part.withdraw();
    const withdrawn = part.isDependencyActive("clock");
    part.announceDependency("clock", true, () => undefined);

    expect([before, on, off, withdrawn, part.isDependencyActive("clock")]).toEqual([false, [true, false], false, false, false]);
    expect(heard).toEqual(["clock true true", "clock false false", "clock true true"]);
  });

  it("tells no listener that an earlier one stopped during the same change", () => {
    const heard: string[] = [];
    const stops: (() => void)[] = [];
    context.onDependencyChanged(moduleId => {
      heard.push(`first ${moduleId}`);
      stops.forEach(t => t());
    });
    stops.push(context.onDependencyChanged(moduleId => heard.push(`last ${moduleId}`)));

    context.announceDependency("clock", true, () => undefined);
    context.announceDependency("clock", false, () => undefined);

    expect(heard).toEqual(["first clock", "first clock"]);
  });

  it("registers its module's own views and documents and has the host refresh after each", () => {
    context.registerView(view("notes.list"));
    context.registerDocument(new DocumentContribution("notes.note", load));

    expect(context.moduleId).toBe("notes");
    expect(context.views.map(t => t.name)).toEqual(["notes.list"]);
    expect(context.documents.map(t => t.name)).toEqual(["notes.note"]);
    expect(host.calls).toEqual(["refresh", "refresh"]);
    expect(() => context.registerView(view("notes.list"))).toThrowError("The view notes.list is already registered.");
    expect(() => context.registerDocument(new DocumentContribution("notes.note", load))).toThrowError("The document notes.note is already registered.");
  });

  it("registers its declared placeholder, and refuses another module's, an undeclared one, one while another is registered and its own twice", () => {
    const placeholder = (name: string): PlaceholderContribution => new PlaceholderContribution(name, load);
    const starting = new WindowPartContext(new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused")), ["notes.start"]), host);

    expect(() => starting.registerPlaceholder(placeholder("clock.start"))).toThrowError(WindowPartAccessException);
    expect(() => starting.registerPlaceholder(placeholder("notes.welcome"))).toThrowError("The module notes does not declare the placeholder notes.welcome.");
    expect(() => context.registerPlaceholder(placeholder("notes.start"))).toThrowError("The module notes does not declare the placeholder notes.start.");
    host.placeholderName = "clock.start";
    expect(() => starting.registerPlaceholder(placeholder("notes.start")))
      .toThrowError("The placeholder notes.start is refused, since the window shows one and clock.start is already registered.");
    expect([starting.placeholders, host.calls]).toEqual([[], []]);
    host.placeholderName = null;
    starting.registerPlaceholder(placeholder("notes.start"));

    expect(starting.placeholders.map(t => t.name)).toEqual(["notes.start"]);
    expect(host.calls).toEqual(["refresh"]);
    expect(() => starting.registerPlaceholder(placeholder("notes.start"))).toThrowError("The placeholder notes.start is already registered.");
  });

  it("registers its declared settings pages, and refuses another module's, an undeclared one and its own twice, and drops them when withdrawn", () => {
    const page = (name: string): SettingsPageContribution => new SettingsPageContribution(name, load);
    const part = new WindowPartContext(new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused")), [], [],
      [{ name: "notes.sync", title: "Sync" }, { name: "notes.sharing", title: "Sharing" }]), host);

    expect(() => part.registerSettingsPage(page("clock.alarms"))).toThrowError(WindowPartAccessException);
    expect(() => part.registerSettingsPage(page("notes.account"))).toThrowError("The module notes does not declare the settings page notes.account.");
    part.registerSettingsPage(page("notes.sync"));
    part.registerSettingsPage(page("notes.sharing"));
    expect(() => part.registerSettingsPage(page("notes.sync"))).toThrowError("The settings page notes.sync is already registered.");
    const registered = [part.settingsPages.map(t => t.name), [...host.calls]];
    part.withdraw();

    expect([registered, part.settingsPages, host.calls.at(-1)]).toEqual([[["notes.sync", "notes.sharing"], ["refresh", "refresh"]], [], "refresh"]);
  });

  it("keeps the rows it gives a declared page of its own, replacing them on each call, refuses another module's page or row, an undeclared page and an id given twice, and keeps none once withdrawn", () => {
    const part = new WindowPartContext(new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused")), [], [],
      [{ name: "notes.sync", title: "Sync" }, { name: "notes.sharing", title: "Sharing" }]), host);
    const server = new SettingsRow("notes.sync.server", "Sync server", "Where your notes sync to.");
    const interval = new SettingsRow("notes.sync.interval", "Sync every");
    part.setSettingsRows("notes.sync", [server, interval]);
    const first = part.settingsRowsOf("notes.sync");
    part.setSettingsRows("notes.sync", [interval]);
    const replaced = [part.settingsRowsOf("notes.sync"), part.settingsRowsOf("notes.sharing")];
    part.setSettingsRows("notes.sync", []);
    const cleared = part.settingsRowsOf("notes.sync");

    expect([first, replaced, cleared]).toEqual([[server, interval], [[interval], []], []]);
    expect(() => part.setSettingsRows("clock.alarms", [])).toThrowError(WindowPartAccessException);
    expect(() => part.setSettingsRows("notes.account", [])).toThrowError("The module notes does not declare the settings page notes.account.");
    expect(() => part.setSettingsRows("notes.sync", [new SettingsRow("clock.alarms.sound", "Sound")])).toThrowError(WindowPartAccessException);
    expect(() => part.setSettingsRows("notes.sync", [server, server])).toThrowError("A page's settings rows each have their own id.");
    part.withdraw();
    part.setSettingsRows("notes.sync", [server]);
    expect(part.settingsRowsOf("notes.sync")).toEqual([]);
  });

  it("drops its placeholder and refreshes the host when withdrawn", () => {
    const starting = new WindowPartContext(new WindowPartSource("notes", [], [], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused")), ["notes.start"]), host);
    starting.registerPlaceholder(new PlaceholderContribution("notes.start", load));

    starting.withdraw();

    expect([starting.placeholders, host.calls.at(-1)]).toEqual([[], "refresh"]);
  });

  it("registers its own search sources in order, refuses another module's and a second of one name, and drops them when withdrawn", () => {
    const notes = searchSource("notes.notes");
    const tags = searchSource("notes.tags");

    context.registerSearchSource(notes);
    context.registerSearchSource(tags);

    expect(context.searchSources).toEqual([notes, tags]);
    expect(() => context.registerSearchSource(searchSource("notes.notes"))).toThrowError("The search source notes.notes is already registered.");
    expect(() => context.registerSearchSource(searchSource("clock.alarms"))).toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["refresh", "refresh"]);
    context.withdraw();
    expect([context.searchSources, host.calls.at(-1)]).toEqual([[], "refresh"]);
  });

  it("registers its declared commands, refuses others and runs its own and its dependencies' commands, desktop.search and desktop.openSettings", async () => {
    const newNote = new CommandContribution("notes.newNote", "New note", null, "Mod+Alt+N", () => Promise.resolve(null));

    context.registerCommand(newNote);

    expect(context.commands).toEqual([newNote]);
    expect(() => context.registerCommand(new CommandContribution("notes.delete", "Delete", null, null, () => Promise.resolve(null))))
      .toThrowError("The module notes does not declare the command notes.delete.");
    expect(() => context.registerCommand(new CommandContribution("notes.taken", "Taken", null, null, () => Promise.resolve(null))))
      .toThrowError("The command notes.taken is already registered.");
    expect(() => context.registerCommand(new CommandContribution("clock.tick", "Tick", null, null, () => Promise.resolve(null))))
      .toThrowError(WindowPartAccessException);
    expect(await context.runCommandAsync("tasks.add", { title: "Write" })).toEqual({ name: "tasks.add", commandArguments: { title: "Write" } });
    expect(await context.runCommandAsync("notes.newNote")).toEqual({ name: "notes.newNote", commandArguments: null });
    expect(await context.runCommandAsync("desktop.search", { source: "notes.notes" })).toEqual({ name: "desktop.search", commandArguments: { source: "notes.notes" } });
    expect(await context.runCommandAsync("desktop.openSettings", { page: "notes.hosts" })).toEqual({ name: "desktop.openSettings", commandArguments: { page: "notes.hosts" } });
    expect(() => context.runCommandAsync("clock.tick")).toThrowError(WindowPartAccessException);
    expect(() => context.runCommandAsync("desktop.showCommands")).toThrowError(WindowPartAccessException);
    expect(() => context.runCommandAsync("desktop.showShortcuts")).toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["refresh", "run tasks.add", "run notes.newNote", "run desktop.search", "run desktop.openSettings"]);
  });

  it("registers its declared status bar items in declared order and lets them change within its own and its dependencies' commands", () => {
    const sync = context.registerStatusBarItem(new StatusBarItemContribution("notes.sync", StatusBarSide.Right, new StatusBarItemState("Synced", { command: "tasks.sync" })));
    const count = context.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes")));

    count.update(new StatusBarItemState("3 notes", { command: "notes.newNote" }));

    expect(context.statusBarItems).toEqual([count, sync]);
    expect([count.name, count.side, count.state().text, sync.side]).toEqual(["notes.count", StatusBarSide.Left, "3 notes", StatusBarSide.Right]);
    expect(() => count.update(new StatusBarItemState("4 notes", { command: "clock.tick" }))).toThrowError(WindowPartAccessException);
    expect(count.state().text).toBe("3 notes");
    expect(host.calls).toEqual(["refresh", "refresh"]);
  });

  it("refuses a status bar item it does not declare, owns twice or another module owns, or one whose command it may not run", () => {
    const item = (name: string, command?: string): StatusBarItemContribution =>
      new StatusBarItemContribution(name, StatusBarSide.Left, new StatusBarItemState("Notes", Object.isUndefined(command) ? {} : { command }));
    context.registerStatusBarItem(item("notes.count"));

    expect(() => context.registerStatusBarItem(item("notes.words"))).toThrowError("The module notes does not declare the status bar item notes.words.");
    expect(() => context.registerStatusBarItem(item("notes.count"))).toThrowError("The status bar item notes.count is already registered.");
    expect(() => context.registerStatusBarItem(item("clock.ticks"))).toThrowError(WindowPartAccessException);
    expect(() => context.registerStatusBarItem(item("notes.sync", "clock.tick"))).toThrowError(WindowPartAccessException);
    expect(context.statusBarItems.map(t => t.name)).toEqual(["notes.count"]);
  });

  it("registers its declared top bar actions in declared order and refuses others and other modules' commands", () => {
    const share = context.registerTopBarAction(new TopBarActionContribution("notes.share", new TopBarActionState("share", "Share", "tasks.share")));
    const compose = context.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote")));

    compose.update(new TopBarActionState("note_add", "New note", "notes.newNote", { isHidden: true }));

    expect(context.topBarActions).toEqual([compose, share]);
    expect([compose.name, compose.state().isHidden]).toEqual(["notes.compose", true]);
    expect(() => compose.update(new TopBarActionState("timer", "Tick", "clock.tick"))).toThrowError(WindowPartAccessException);
    expect(() => context.registerTopBarAction(new TopBarActionContribution("notes.print", new TopBarActionState("print", "Print", "notes.newNote"))))
      .toThrowError("The module notes does not declare the top bar action notes.print.");
    expect(() => context.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote"))))
      .toThrowError("The top bar action notes.compose is already registered.");
    expect(host.calls).toEqual(["refresh", "refresh"]);
  });

  it("refuses another module's views, documents and documents to open, and its own that it does not declare or registers twice", () => {
    expect(() => context.registerView(view("clock.face"))).toThrowError(WindowPartAccessException);
    expect(() => context.registerDocument(new DocumentContribution("notesx.note", load))).toThrowError(WindowPartAccessException);
    expect(() => context.registerView(view("notes.outline"))).toThrowError("The module notes does not declare the view notes.outline.");
    expect(() => context.registerDocument(new DocumentContribution("notes.page", load))).toThrowError("The module notes does not declare the document notes.page.");
    expect(() => context.openDocument("clock.page", "1", "Page")).toThrowError(WindowPartAccessException);
    expect(() => context.keepDocument("clock.page", "1")).toThrowError(WindowPartAccessException);
    expect(() => context.closeDocument("clock.page", "1")).toThrowError(WindowPartAccessException);
    expect(() => context.forgetDocument("clock.page", "1")).toThrowError(WindowPartAccessException);
    expect(() => context.updateDocument("clock.page", "1", { title: "Page" })).toThrowError(WindowPartAccessException);
    expect(context.views).toEqual([]);
    expect(host.calls).toEqual([]);
  });

  it("gives the host the look a document opens or updates with, and refuses a look its tab can't show", () => {
    context.openDocument("notes.note", "1", "Note 1", { image: "data:image/png;base64,AA==", imageGlyph: "public" });
    context.updateDocument("notes.note", "1", { title: "Note one" });
    context.updateDocument("notes.note", "1", { status: { glyph: "error", description: "Gone" } });

    expect(() => context.openDocument("notes.note", "2", "Note 2", { image: "https://example.com/a.png" })).toThrowError(ArgumentException);
    expect(() => context.updateDocument("notes.note", "1", { imageGlyph: " " })).toThrowError(ArgumentException);
    expect(host.looks.map(([call]) => call)).toEqual(["open notes notes.note 1", "update notes.note 1"]);
    expect(host.looks[0]?.[1]).toEqual({ image: "data:image/png;base64,AA==", imageGlyph: "public" });
    expect(host.looks[1]?.[1]).toEqual({ status: { glyph: "error", description: "Gone" } });
    expect(host.calls.filter(t => t.startsWith("open"))).toEqual(["open notes notes.note 1 Note 1"]);
  });

  it("takes an older module's underline, even a blank one or null, and gives the host no look change for it", () => {
    expect(() => {
      context.openDocument("notes.note", "1", "Note 1", { underline: " " });
      context.updateDocument("notes.note", "1", { underline: null });
      context.updateDocument("notes.note", "1", { underline: " " });
    }).not.toThrow();

    expect(host.looks.map(([call]) => call)).toEqual(["open notes notes.note 1"]);
    expect(host.calls.filter(t => t.startsWith("open"))).toEqual(["open notes notes.note 1 Note 1"]);
  });

  it("gives the host the instance a document opens after, and none when left out", () => {
    context.openDocument("notes.note", "2", "Note 2", { after: "1" });
    context.openDocument("notes.note", "3", "Note 3", { preview: true, after: "2" });
    context.openDocument("notes.note", "4", "Note 4", {});

    expect(host.calls).toEqual(["open notes notes.note 2 Note 2 after 1", "open notes notes.note 3 Note 3 as a preview after 2", "open notes notes.note 4 Note 4"]);
  });

  it("asks the host to activate a document unless its options say not to", () => {
    context.openDocument("notes.note", "1", "Note 1", { activate: false });
    context.openDocument("notes.note", "2", "Note 2", { activate: true, preview: true });
    context.openDocument("notes.note", "3", "Note 3", { activate: false, after: "1" });

    expect(host.calls).toEqual(["open notes notes.note 1 Note 1 inactive", "open notes notes.note 2 Note 2 as a preview", "open notes notes.note 3 Note 3 after 1 inactive"]);
  });

  it("gives the host no look once withdrawn", () => {
    context.withdraw();
    context.openDocument("notes.note", "1", "Note 1", { imageGlyph: "public" });
    context.updateDocument("notes.note", "1", { imageGlyph: null });

    expect(host.looks).toEqual([]);
  });

  it("opens its own documents through the host, as previews when asked, keeps them, closes them and forgets them until withdrawn", () => {
    context.openDocument("notes.note", "1", "Note 1");
    context.openDocument("notes.note", "2", "Note 2", { preview: true });
    context.openDocument("notes.note", "3", "Note 3", { preview: false, breadcrumb: ["Notes", "Drafts"] });
    context.openDocument("notes.note", "4", "Note 4", { breadcrumb: ["Notes"], breadcrumbIcon: "folder" });
    context.keepDocument("notes.note", "2");
    context.closeDocument("notes.note", "1");
    context.forgetDocument("notes.note", "3");
    context.withdraw();
    context.forgetDocument("notes.note", "4");

    expect(host.calls).toEqual(["open notes notes.note 1 Note 1", "open notes notes.note 2 Note 2 as a preview", "open notes notes.note 3 Notes / Drafts / Note 3",
      "open notes notes.note 4 Notes / Note 4 folder", "keep notes notes.note 2", "close notes notes.note 1", "forget notes notes.note 3", "refresh"]);
  });

  it("changes its own documents' titles and breadcrumbs through the host, passing on only what changes", () => {
    context.updateDocument("notes.note", "1", { title: "Plan" });
    context.updateDocument("notes.note", "1", { breadcrumb: ["Notes"] });
    context.updateDocument("notes.note", "2", { title: "Todo", breadcrumb: [] });
    context.updateDocument("notes.note", "3", {});
    context.updateDocument("notes.note", "3", { breadcrumb: ["Notes"], breadcrumbIcon: "folder" });

    expect(host.calls).toEqual(["update notes notes.note 1 Plan -", "update notes notes.note 1 - [Notes]", "update notes notes.note 2 Todo []", "update notes notes.note 3 - -",
      "update notes notes.note 3 - [Notes] folder"]);
  });

  it("refuses a blank title, breadcrumb segment or breadcrumb glyph before it reaches the host", () => {
    expect(() => context.openDocument("notes.note", "1", " ")).toThrowError(ArgumentException);
    expect(() => context.openDocument("notes.note", "1", "Note 1", { breadcrumbIcon: " " })).toThrowError(ArgumentException);
    expect(() => context.updateDocument("notes.note", "1", { breadcrumb: ["Notes"], breadcrumbIcon: String.empty })).toThrowError(ArgumentException);
    expect(() => context.updateDocument("notes.note", "1", { title: "Plan", breadcrumbIcon: "folder" })).toThrowError("A breadcrumb's glyph comes with the breadcrumb it goes before.");
    expect(() => context.openDocument("notes.note", "1", "Note 1", { breadcrumb: ["Notes", String.empty] })).toThrowError("A breadcrumb is a list of segments that are not blank.");
    expect(() => context.updateDocument("notes.note", "1", { title: String.empty })).toThrowError(ArgumentException);
    expect(() => context.updateDocument("notes.note", "1", { breadcrumb: [" "] })).toThrowError(ArgumentException);
    expect(host.calls).toEqual([]);
  });

  it("opens, changes, gives back the front of and closes instances of its own view with instances through the host, passing on only what changes", () => {
    context.registerView(instanceView());
    context.openView("notes.list", "1", "Inbox");
    context.openView("notes.list", "2", "Archive", { icon: "archive", tabGroup: "3", breadcrumb: ["Mail", "2026"], breadcrumbIcon: "inbox" });
    context.openView("notes.list", "3", "Drafts", { revealDock: false });
    context.openView("notes.list", "4", "Sent", { revealDock: true });
    context.updateView("notes.list", "1", { title: "Mail" });
    context.updateView("notes.list", "1", { icon: "mail" });
    context.updateView("notes.list", "1", { breadcrumb: ["Accounts", "Work"] });
    context.updateView("notes.list", "1", { breadcrumb: [] });
    context.updateView("notes.list", "1", {});
    context.updateView("notes.list", "1", { breadcrumb: ["Accounts"], breadcrumbIcon: "person" });
    context.returnView("notes.list", "2");
    context.closeView("notes.list", "2");

    expect(host.calls).toEqual(["refresh", "openView notes notes.list 1 Inbox - -", "openView notes notes.list 2 Mail / 2026 / Archive inbox archive 3",
      "openView notes notes.list 3 Drafts - - quiet", "openView notes notes.list 4 Sent - -", "updateView notes notes.list 1 Mail - -",
      "updateView notes notes.list 1 - mail -", "updateView notes notes.list 1 - - [Accounts, Work]", "updateView notes notes.list 1 - - []", "updateView notes notes.list 1 - - -",
      "updateView notes notes.list 1 - - [Accounts] person",
      "returnView notes notes.list 2", "closeView notes notes.list 2"]);
  });

  it("refuses instances of another module's view, of a view it has not registered and of one without instances", () => {
    expect(() => context.openView("notes.list", "1", "Inbox")).toThrowError("The module notes does not declare the view with instances notes.list.");
    context.registerView(view("notes.list"));

    expect(() => context.openView("clock.face", "1", "Clock")).toThrowError(WindowPartAccessException);
    expect(() => context.openView("notes.list", "1", "Inbox")).toThrowError(WindowPartAccessException);
    expect(() => context.updateView("notes.list", "1", { title: "Mail" })).toThrowError(WindowPartAccessException);
    expect(() => context.closeView("notes.list", "1")).toThrowError(WindowPartAccessException);
    expect(() => context.returnView("notes.list", "1")).toThrowError(WindowPartAccessException);
    expect(() => context.returnView("clock.face", "1")).toThrowError(WindowPartAccessException);
    expect(() => context.onViewClosed("notes.list", () => undefined)).toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["refresh"]);
    expect(host.viewListeners.size).toBe(0);
  });

  it("closes the dialog showing its own view or document through the host, with or without an instance, refusing another module's name, an undeclared one and a blank instance, and not once withdrawn", () => {
    context.closeDialog("notes.list");
    context.closeDialog("notes.note", "2");

    expect(() => context.closeDialog("clock.face")).toThrowError(WindowPartAccessException);
    expect(() => context.closeDialog("notes.other")).toThrowError("The module notes does not declare the view or document notes.other.");
    expect(() => context.closeDialog("notes.list", " ")).toThrowError(ArgumentException);
    const asked = [...host.calls];
    context.withdraw();
    const withdrawn = host.calls.length;
    context.closeDialog("notes.list");
    expect([asked, host.calls.length]).toEqual([["closeDialog notes.list -", "closeDialog notes.note 2"], withdrawn]);
  });

  it("shows its own view without instances and hides its dock through the host, refusing an instance for it and another module's view", () => {
    context.registerView(view("notes.list"));

    context.showView("notes.list");
    context.hideViewDock("notes.list");

    expect(() => context.hideViewDock("notes.list", "1")).toThrowError("The module notes does not declare the view with instances notes.list.");
    expect(() => context.showView("clock.face")).toThrowError(WindowPartAccessException);
    expect(() => context.hideViewDock("clock.face")).toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["refresh", "showView notes notes.list", "hideViewDock notes notes.list -"]);
  });

  it("hides the dock of its own view's instance through the host, and neither shows that view nor hides it without an instance that is not blank", () => {
    context.registerView(instanceView());

    context.hideViewDock("notes.list", "1");

    expect(() => context.showView("notes.list")).toThrowError("The module notes does not declare the view without instances notes.list.");
    expect(() => context.hideViewDock("notes.list")).toThrowError(WindowPartAccessException);
    expect(() => context.hideViewDock("notes.list", " ")).toThrowError("An instance is a string that is not blank.");
    expect(host.calls).toEqual(["refresh", "hideViewDock notes notes.list 1"]);
  });

  it("grows the dock of its own view's tab without instances through the host until it releases it, refusing an instance for it", () => {
    context.registerView(view("notes.list"));

    const release = context.growViewDock("notes.list", 12.5);
    release();

    expect(() => context.growViewDock("notes.list", 20, "1")).toThrowError("The module notes does not declare the view with instances notes.list.");
    expect(host.calls).toEqual(["refresh", "growViewDock notes.list - 12.5", "releaseViewDock notes.list -"]);
  });

  it("grows the dock of its own view's instance through the host until it releases it, refusing no instance or a blank one for it", () => {
    context.registerView(instanceView());

    const release = context.growViewDock("notes.list", 20, "1");
    release();

    expect(() => context.growViewDock("notes.list", 20)).toThrowError("The module notes does not declare the view without instances notes.list.");
    expect(() => context.growViewDock("notes.list", 20, " ")).toThrowError("An instance is a string that is not blank.");
    expect(host.calls).toEqual(["refresh", "growViewDock notes.list 1 20", "releaseViewDock notes.list 1"]);
  });

  it("reads the dock of its own view's tab without instances through the host, refusing an instance for it", () => {
    context.registerView(view("notes.list"));
    host.docks.set(DockSide.Right);

    const dock = context.viewDockOf("notes.list");

    expect(() => context.viewDockOf("notes.list", "1")).toThrowError("The module notes does not declare the view with instances notes.list.");
    expect(() => context.viewDockOf("clock.face")).toThrowError(WindowPartAccessException);
    expect([dock(), host.calls]).toEqual([DockSide.Right, ["refresh", "viewDockOf notes.list -"]]);
  });

  it("reads the dock of its own view's instance through the host as it changes, refusing no instance or a blank one for it", () => {
    context.registerView(instanceView());

    const dock = context.viewDockOf("notes.list", "1");
    const before = dock();
    host.docks.set(DockSide.Bottom);

    expect(() => context.viewDockOf("notes.list")).toThrowError("The module notes does not declare the view without instances notes.list.");
    expect(() => context.viewDockOf("notes.list", " ")).toThrowError("An instance is a string that is not blank.");
    expect([before, dock(), host.calls]).toEqual([null, DockSide.Bottom, ["refresh", "viewDockOf notes.list 1"]]);
  });

  it("reads no dock once withdrawn, without asking the host", () => {
    context.registerView(instanceView());
    host.docks.set(DockSide.Left);

    context.withdraw();
    const dock = context.viewDockOf("notes.list", "1");

    expect([dock(), host.calls.filter(t => t.startsWith("viewDockOf"))]).toEqual([null, []]);
  });

  it("releases the dock growths it still holds when withdrawn, and grows nothing once withdrawn", () => {
    context.registerView(instanceView());
    context.growViewDock("notes.list", 20, "1");
    context.growViewDock("notes.list", 30, "2");

    context.withdraw();
    context.growViewDock("notes.list", 40, "3")();

    expect(host.calls.filter(t => t.includes("ViewDock"))).toEqual(["growViewDock notes.list 1 20", "growViewDock notes.list 2 30",
      "releaseViewDock notes.list 1", "releaseViewDock notes.list 2"]);
  });

  it.each<[string, (context: WindowPartContext) => unknown, string]>([
    ["another module's view", t => t.growViewDock("clock.face", 20), "The module notes may contribute only names of its own, not clock.face."],
    ["a minimum of 0", t => t.growViewDock("notes.list", 0, "1"), "A dock growth's minimum is a finite number of rem above 0."],
    ["a negative minimum", t => t.growViewDock("notes.list", -1, "1"), "A dock growth's minimum is a finite number of rem above 0."],
    ["a minimum that is not finite", t => t.growViewDock("notes.list", Number.POSITIVE_INFINITY, "1"), "A dock growth's minimum is a finite number of rem above 0."],
    ["a minimum that is not a number", t => t.growViewDock("notes.list", Number.NaN, "1"), "A dock growth's minimum is a finite number of rem above 0."]
  ])("grows no dock for %s", (_, call, message) => {
    context.registerView(instanceView());

    expect(() => call(context)).toThrowError(message);
    expect(host.calls).toEqual(["refresh"]);
  });

  it("neither shows nor hides a view it has not registered", () => {
    expect(() => context.showView("notes.list")).toThrowError(WindowPartAccessException);
    expect(() => context.hideViewDock("notes.list")).toThrowError(WindowPartAccessException);
    expect(() => context.hideViewDock("notes.list", "1")).toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual([]);
  });

  it("refuses a blank instance, title or breadcrumb segment before it reaches the host", () => {
    context.registerView(instanceView());

    expect(() => context.openView("notes.list", " ", "Inbox")).toThrowError("An instance is a string that is not blank.");
    expect(() => context.openView("notes.list", "1", String.empty)).toThrowError(ArgumentException);
    expect(() => context.updateView("notes.list", String.empty, { icon: "mail" })).toThrowError(ArgumentException);
    expect(() => context.updateView("notes.list", "1", { title: " " })).toThrowError(ArgumentException);
    expect(() => context.openView("notes.list", "1", "Inbox", { breadcrumb: ["Mail", String.empty] })).toThrowError("A breadcrumb is a list of segments that are not blank.");
    expect(() => context.updateView("notes.list", "1", { breadcrumb: [" "] })).toThrowError(ArgumentException);
    expect(() => context.openView("notes.list", "1", "Inbox", { breadcrumbIcon: String.empty })).toThrowError(ArgumentException);
    expect(() => context.updateView("notes.list", "1", { breadcrumb: ["Mail"], breadcrumbIcon: " " })).toThrowError(ArgumentException);
    expect(() => context.updateView("notes.list", "1", { breadcrumbIcon: "mail" })).toThrowError("A breadcrumb's glyph comes with the breadcrumb it goes before.");
    expect(() => context.closeView("notes.list", String.empty)).toThrowError(ArgumentException);
    expect(() => context.returnView("notes.list", " ")).toThrowError(ArgumentException);
    expect(host.calls).toEqual(["refresh"]);
  });

  it("hears the person closing its own view's instances until it stops listening or is withdrawn", () => {
    const heard: string[] = [];
    const tell = (name: string, instance: string): void => {
      for (const [view, listener] of [...host.viewListeners])
        if (view === name)
          listener(instance);
    };
    context.registerView(instanceView());
    const stop = context.onViewClosed("notes.list", t => heard.push(t));
    context.onViewClosed("notes.list", t => heard.push(`still ${t}`));
    tell("notes.list", "1");
    stop();
    tell("notes.list", "3");
    context.withdraw();
    tell("notes.list", "4");

    expect(heard).toEqual(["1", "still 1", "still 3"]);
    expect(host.viewListeners.size).toBe(0);
  });

  describe("with places", () => {
    let part: WindowPartContext;

    beforeEach(() => {
      part = new WindowPartContext(new WindowPartSource("notes", [], ["notes.list", "notes.panel"], [], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused"))), host);
      part.registerView(instanceView());
      part.registerView(view("notes.panel"));
      host.calls.length = 0;
    });

    it("records and forgets its own views' places through the host, with the instance only for a view with instances", () => {
      part.recordPlace("notes.panel", "note-1");
      part.recordPlace("notes.list", "/home", "1");
      part.forgetPlace("notes.panel", "note-1");
      part.forgetPlace("notes.list", "/home", "1");

      expect(host.calls).toEqual(["place notes.panel - note-1", "place notes.list 1 /home", "forget place notes.panel - note-1", "forget place notes.list 1 /home"]);
    });

    it("hears Back and Forward reach its own views' places until it stops listening or is withdrawn", () => {
      const heard: string[] = [];
      const tell = (name: string, place: string, instance: string | null): void => {
        for (const [view, listener] of [...host.placeListeners])
          if (view === name)
            listener(place, instance);
      };
      const stop = part.onPlaceShown("notes.panel", (place, instance) => heard.push(`${place} ${instance ?? "-"}`));
      part.onPlaceShown("notes.list", (place, instance) => heard.push(`list ${place} ${instance ?? "-"}`));
      tell("notes.panel", "note-1", null);
      tell("notes.list", "/home", "1");
      stop();
      tell("notes.panel", "note-2", null);
      part.withdraw();
      tell("notes.list", "/tmp", "1");

      expect(heard).toEqual(["note-1 -", "list /home 1"]);
      expect(host.placeListeners.size).toBe(0);
    });

    it("refuses a place of another module's view, of a view it has not registered, with a wrong instance or blank", () => {
      const listen = (name: string): (() => void) => part.onPlaceShown(name, () => undefined);

      expect(() => context.recordPlace("notes.list", "note-1")).toThrowError("The module notes does not declare the view without instances notes.list.");
      expect(() => part.recordPlace("clock.face", "note-1")).toThrowError(WindowPartAccessException);
      expect(() => part.recordPlace("notes.panel", "note-1", "1")).toThrowError("The module notes does not declare the view with instances notes.panel.");
      expect(() => part.recordPlace("notes.list", "/home")).toThrowError("The module notes does not declare the view without instances notes.list.");
      expect(() => part.recordPlace("notes.list", "/home", " ")).toThrowError("An instance is a string that is not blank.");
      expect(() => part.recordPlace("notes.panel", " ")).toThrowError("A place is a string that is not blank.");
      expect(() => part.forgetPlace("notes.list", String.empty, "1")).toThrowError("A place is a string that is not blank.");
      expect(() => part.forgetPlace("clock.face", "note-1")).toThrowError(WindowPartAccessException);
      expect(() => listen("clock.face")).toThrowError(WindowPartAccessException);
      expect(() => context.onPlaceShown("notes.list", () => undefined)).toThrowError("The module notes does not declare the view notes.list.");
      expect([host.calls, host.placeListeners.size]).toEqual([[], 0]);
    });
  });

  it("hears the person closing its own document's tabs until it stops listening or is withdrawn, and refuses another module's or an undeclared document", () => {
    const heard: string[] = [];
    const tell = (name: string, instance: string): void => {
      for (const [document, listener] of [...host.documentListeners])
        if (document === name)
          listener(instance);
    };
    const stop = context.onDocumentClosed("notes.note", t => heard.push(t));
    context.onDocumentClosed("notes.note", t => heard.push(`still ${t}`));
    tell("notes.note", "1");
    stop();
    tell("notes.note", "3");
    const refusals = [() => context.onDocumentClosed("clock.alarm", () => undefined), () => context.onDocumentClosed("notes.draft", () => undefined)];
    refusals.forEach(t => expect(t).toThrowError(WindowPartAccessException));
    context.withdraw();
    tell("notes.note", "4");

    expect(heard).toEqual(["1", "still 1", "still 3"]);
    expect(host.documentListeners.size).toBe(0);
  });

  it("hears the person renaming its own renamable view's or document's tabs until it stops listening or is withdrawn", () => {
    const heard: string[] = [];
    const tell = (name: string, instance: string, title: string): void => {
      for (const [renamed, listener] of [...host.renameListeners])
        if (renamed === name)
          listener(instance, title);
    };
    context.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, false, load, undefined, { hasInstances: true, isRenamable: true }));
    context.registerDocument(new DocumentContribution("notes.note", load, undefined, { isRenamable: true }));
    const stop = context.onTabRenamed("notes.list", (instance, title) => heard.push(`list ${instance} ${title}`));
    context.onTabRenamed("notes.note", (instance, title) => heard.push(`note ${instance} ${title}`));
    tell("notes.list", "1", "Inbox");
    tell("notes.note", "2", String.empty);
    stop();
    tell("notes.list", "3", "Later");
    context.withdraw();
    tell("notes.note", "4", "Gone");

    expect(heard).toEqual(["list 1 Inbox", "note 2 "]);
    expect(host.renameListeners.size).toBe(0);
  });

  it("refuses to hear renames of another module's tabs, or of a view or document it does not register as renamable", () => {
    context.registerView(instanceView());
    context.registerDocument(new DocumentContribution("notes.note", load));

    for (const name of ["clock.alarm", "notes.list", "notes.note"])
      expect(() => context.onTabRenamed(name, () => undefined)).toThrowError(WindowPartAccessException);
    expect(() => context.onTabRenamed("notes.note", () => undefined)).toThrowError("The module notes does not declare the renamable view or document notes.note.");
    expect(host.renameListeners.size).toBe(0);
  });

  it("lists its own document's open instances through the host, refuses another module's or an undeclared document, and lists nothing once withdrawn", async () => {
    host.openDocuments = ["1", "2"];
    const open = await context.listOpenDocumentsAsync("notes.note");

    await expect(context.listOpenDocumentsAsync("clock.alarm")).rejects.toThrowError(WindowPartAccessException);
    await expect(context.listOpenDocumentsAsync("notes.draft")).rejects.toThrowError("The module notes does not declare the document notes.draft.");
    context.withdraw();
    const withdrawn = await context.listOpenDocumentsAsync("notes.note");

    expect([open, withdrawn]).toEqual([["1", "2"], null]);
    expect(host.calls).toEqual(["list notes notes.note", "refresh"]);
  });

  it("registers a view whose tab-row place is its own, and refuses one whose place is another module's", () => {
    expect(() => context.registerView(instanceView("clock.tabRow"))).toThrowError(WindowPartAccessException);
    context.registerView(instanceView("notes.tabRow"));

    expect(context.views.map(t => t.tabRowPlace)).toEqual(["notes.tabRow"]);
  });

  it("registers a document whose tab-row place is its own, and refuses one whose place is another module's", () => {
    expect(() => context.registerDocument(new DocumentContribution("notes.note", load, undefined, { tabRowPlace: "clock.tabRow" }))).toThrowError(WindowPartAccessException);
    context.registerDocument(new DocumentContribution("notes.note", load, undefined, { tabRowPlace: "notes.tabRow" }));

    expect(context.documents.map(t => t.tabRowPlace)).toEqual(["notes.tabRow"]);
  });

  it("shows its own, its dependencies' and the shell's views and documents in a dialog through the host, and refuses another module's", async () => {
    await context.showInDialogAsync("notes.list");
    await context.showInDialogAsync("notes.note", { instance: "1", title: "Note 1" });
    await context.showInDialogAsync("tasks.board", { title: "Board" });
    await context.showInDialogAsync("desktop.settings");

    await expect(context.showInDialogAsync("clock.face")).rejects.toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["show notes.list - -", "show notes.note 1 Note 1", "show tasks.board - Board", "show desktop.settings - -"]);
  });

  it("opens a palette below the window row through the host as its context, and closes those still open when withdrawn", async () => {
    const first = await context.openBelowWindowRowAsync(() => Promise.resolve(ListComponent));
    const second = await context.openBelowWindowRowAsync(() => Promise.resolve(ListComponent));
    first?.close();
    host.isPaletteRefused = true;
    const refused = await context.openBelowWindowRowAsync(() => Promise.resolve(ListComponent));
    context.withdraw();

    expect([second?.componentRef.instance instanceof ListComponent, refused, host.paletteContexts.every(t => t === context)]).toEqual([true, null, true]);
    expect(host.calls).toEqual(["palette 1", "palette 2", "close palette 1", "palette 3", "close palette 2", "refresh"]);
  });

  it("creates no palette whose component loads after its part is withdrawn, and answers null", async () => {
    let release: () => void = () => undefined;
    const late = context.openBelowWindowRowAsync(() => new Promise<typeof ListComponent>(resolve => {
      release = () => resolve(ListComponent);
    }));
    context.withdraw();
    release();

    expect(await late).toBeNull();
    expect(host.calls).toEqual(["refresh"]);
  });

  it("rejects with what a palette's loading throws, asking the host for nothing", async () => {
    await expect(context.openBelowWindowRowAsync(() => Promise.reject(new Error("no palette")))).rejects.toThrowError("no palette");

    expect(host.calls).toEqual([]);
  });

  it("writes its log lines through the host under its module's id", () => {
    context.log("Opened the list");

    expect(host.calls).toEqual(["log notes Opened the list"]);
  });

  it("opens a link through the host, with no options or with the gesture and place the part gives", async () => {
    await context.openLinkAsync("https://example.com/help");
    await context.openLinkAsync("https://example.com/docs", { gesture: LinkGesture.Middle, place: LinkPlace.System });

    expect(host.calls).toEqual(["openLink https://example.com/help {}", "openLink https://example.com/docs {\"gesture\":\"Middle\",\"place\":\"System\"}"]);
  });

  it("shows a link's menu through the host", () => {
    context.showLinkMenu("https://example.com/help", new MouseEvent("contextmenu"));

    expect(host.calls).toEqual(["linkMenu https://example.com/help contextmenu"]);
  });

  it("registers the part as the in-app browser, logging in its module's name, and unregisters it when the part is withdrawn", () => {
    const browser = { placeFor: () => LinkPlace.InApp, openAsync: () => Promise.resolve() };
    context.registerInAppBrowser(browser);
    const [registered, log] = host.inAppBrowsers[0] ?? [];
    log?.("The in-app browser failed.");
    context.withdraw();

    expect([registered, host.calls[0], host.calls.filter(t => t === "unregisterInAppBrowser").length]).toEqual([browser, "log notes The in-app browser failed.", 1]);
  });

  it("shows a file in its folder through the host", async () => {
    await context.showInFolderAsync("/home/ada/report.pdf");

    expect(host.calls).toEqual(["showInFolder /home/ada/report.pdf"]);
  });

  it("opens a file in its default app through the host", async () => {
    await context.openFileAsync("/home/ada/notes.md");

    expect(host.calls).toEqual(["openFile /home/ada/notes.md"]);
  });

  it("opens web views for its own views and documents through the host, refuses another module's or an undeclared pane, and closes the ones it holds when withdrawn", async () => {
    const list = await context.webViews.openAsync(new WebViewPane(QualifiedName.parse("notes.list")), "workspace-1");
    await context.webViews.openAsync(new WebViewPane(QualifiedName.parse("notes.note"), "plan"), "workspace-2", { name: "Notes' browser" });
    list.close();
    await context.webViews.openAsync(new WebViewPane(QualifiedName.parse("notes.list")), "workspace-3");
    const foreign = await context.webViews.openAsync(new WebViewPane(QualifiedName.parse("tasks.list")), "workspace-1").catch((error: unknown) => error);
    const undeclared = await context.webViews.openAsync(new WebViewPane(QualifiedName.parse("notes.other")), "workspace-1").catch((error: unknown) => error);
    context.withdraw();

    expect(host.calls.filter(t => t.startsWith("openWebView"))).toEqual([
      `openWebView notes ${new ViewTab("notes.list").key} workspace-1`, `openWebView notes ${new DocumentTab("notes.note", "plan").key} workspace-2 as Notes' browser`,
      `openWebView notes ${new ViewTab("notes.list").key} workspace-3`
    ]);
    expect([foreign, undeclared].map(t => t instanceof WindowPartAccessException)).toEqual([true, true]);
    expect(host.webViews.map(t => t.calls.join(","))).toEqual(["close", "close", "close"]);
  });

  it("closes a web view that opens after it was withdrawn, and rejects the open", async () => {
    const opening = context.webViews.openAsync(new WebViewPane(QualifiedName.parse("notes.list")), "workspace-1");
    context.withdraw();
    const error = await opening.catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(WebViewClosedException);
    expect(host.webViews.map(t => t.calls.join(","))).toEqual(["close"]);
  });

  it("asks for a folder through the host", async () => {
    expect(await context.chooseFolderAsync()).toBe("/home/person/notes");
    expect(host.calls).toEqual(["chooseFolder"]);
  });

  it("asks for a file's path through the host with the options given, and any file without them", async () => {
    const answers = [await context.chooseFilePathAsync({ extensions: ["exe", "CMD"], folder: "/opt/tools" }), await context.chooseFilePathAsync()];

    expect(answers).toEqual(["/opt/tools/agent", "/opt/tools/agent"]);
    expect(host.calls).toEqual(["chooseFilePath {\"extensions\":[\"exe\",\"CMD\"],\"folder\":\"/opt/tools\"}", "chooseFilePath {}"]);
  });

  it.each<[string, IFilePathChoiceOptions, string]>([
    ["no extensions", { extensions: [] }, "extensions"],
    ["an extension with a dot", { extensions: [".exe"] }, "extensions"],
    ["an extension of 17 characters", { extensions: ["e".repeat(17)] }, "extensions"],
    ["33 extensions", { extensions: Array.from({ length: 33 }, (_, index) => `e${index}`) }, "extensions"],
    ["a blank folder", { folder: " " }, "folder"],
    ["a relative folder", { folder: "opt/tools" }, "folder"],
    ["a Windows folder on Linux", { folder: "C:/Tools" }, "folder"],
    ["a folder with a control character", { folder: "/opt/tools\u0007" }, "folder"]
  ])("refuses %s before asking the host", async (_, options, parameter) => {
    const error = await context.chooseFilePathAsync(options).catch((reason: unknown) => reason);

    expect([error instanceof ArgumentException, error instanceof ArgumentException ? error.parameterName : null, host.calls]).toEqual([true, parameter, []]);
  });

  it("takes a folder absolute on Windows there, from a drive, a share or the drive's root, and refuses one relative to a drive or the current folder", async () => {
    host.platform = "win32";
    const folders = ["C:/Tools", "D:\\Tools", "\\\\server\\tools", "/tools", "C:tools", "tools"];

    const answers = await Promise.all(folders.map(t => context.chooseFilePathAsync({ folder: t }).catch((reason: unknown) => reason instanceof ArgumentException ? reason.parameterName : reason)));

    expect(answers).toEqual(["/opt/tools/agent", "/opt/tools/agent", "/opt/tools/agent", "/opt/tools/agent", "folder", "folder"]);
  });

  it("asks for files through the host for its module, keeps their grants and discards only its own, once each", async () => {
    const chosen = await context.chooseFilesAsync({ multiple: true });
    const offered = await context.grantFilesAsync([new File(["notes"], "notes.txt", { type: "text/plain" }), new File(["plan"], "plan.md")], { lifetime: 60_000 });
    const none = await context.grantFilesAsync([]);
    context.discardFileGrants(["a".repeat(32), "1".repeat(32), "a".repeat(32), "f".repeat(32)]);
    context.discardFileGrants(["a".repeat(32), "f".repeat(32)]);

    expect([chosen.files.map(t => t.name), offered.files.map(t => `${t.name} ${t.mediaType} ${t.size}`), none]).toEqual([
      ["report.pdf"], ["notes.txt text/plain 5", "plan.md  4"], IssuedFileGrants.none
    ]);
    expect(host.calls).toEqual([
      "chooseFiles notes {\"multiple\":true}",
      "grantFiles notes notes.txt,plan.md {\"lifetime\":60000}",
      "discardFileGrants a,1"
    ]);
  });

  it("turns a shared file's grant into its address and holds the share until it discards it, once", () => {
    const address = context.fileAddressOf("c".repeat(32));
    context.discardFileGrants(["c".repeat(32)]);
    context.discardFileGrants(["c".repeat(32)]);

    expect(address).toBe(`desktop-file://${"c".repeat(32)}/`);
    expect(host.calls).toEqual(["discardFileGrants c"]);
  });

  it("ends its shares when withdrawn, and a share it is given after at once", () => {
    context.fileAddressOf("c".repeat(32));
    context.withdraw();
    const late = context.fileAddressOf("d".repeat(32));

    expect(late).toBe(`desktop-file://${"d".repeat(32)}/`);
    expect(host.calls.filter(t => t.startsWith("discardFileGrants"))).toEqual(["discardFileGrants c", "discardFileGrants d"]);
  });

  it.each<[string, string]>([
    ["nothing", String.empty],
    ["capital letters", "C".repeat(32)],
    ["31 digits", "c".repeat(31)],
    ["a path", `${"c".repeat(31)}/`],
    ["another address", `desktop-file://${"c".repeat(32)}/`]
  ])("refuses %s as a shared file's grant", (_, grant) => {
    expect(() => context.fileAddressOf(grant)).toThrow(ArgumentException);
    expect(host.calls).toEqual([]);
  });

  it("discards the grants it keeps when withdrawn and those that arrive after", async () => {
    let answer: (issued: IssuedFileGrants) => void = () => undefined;
    await context.grantFilesAsync([new File(["notes"], "notes.txt")]);
    host.fileAnswer = new Promise(resolve => answer = resolve);
    const choosing = context.chooseFilesAsync();

    context.withdraw();
    answer(new IssuedFileGrants([new IssuedFileGrant("b".repeat(32), "late.txt", "text/plain", 1)], []));

    expect(await choosing).toBe(IssuedFileGrants.none);
    expect(host.calls.filter(t => t.startsWith("discardFileGrants"))).toEqual(["discardFileGrants 1", "discardFileGrants b"]);
  });

  it.each<[string, number]>([["no time", 0], ["a part of a millisecond", 1.5], ["more than ten minutes", 600_001]])(
    "refuses a grant's lifetime of %s",
    async (_, lifetime) => {
      await expect(context.chooseFilesAsync({ lifetime })).rejects.toThrowError(ArgumentOutOfRangeException);
      await expect(context.grantFilesAsync([], { lifetime })).rejects.toThrowError("A file grant's lifetime is a whole number of milliseconds from 1 to 600 000.");
      expect(host.calls).toEqual([]);
    });

  it("refuses more than 256 files at once", async () => {
    const files = Array.from({ length: 257 }, () => new File([], "empty.txt"));

    await expect(context.grantFilesAsync(files)).rejects.toThrowError("A window part offers at most 256 files at once.");
    expect(host.calls).toEqual([]);
  });

  it("saves a file through the host", async () => {
    expect(await context.saveFileAsync("note.txt", new Uint8Array([1, 2, 3]))).toBe(FileSaveOutcome.Saved);
    expect(host.calls).toEqual(["saveFile note.txt 3"]);
  });

  it("calls its own module's and its dependencies' methods and refuses others", async () => {
    expect(await context.requestAsync("notes.read", { id: 1 })).toEqual({ method: "notes.read", payload: { id: 1 } });
    expect(await context.requestAsync("tasks.list", null)).toEqual({ method: "tasks.list", payload: null });
    await expect(context.requestAsync("clock.time", null)).rejects.toThrowError(WindowPartAccessException);
    await expect(context.requestAsync("desktop.stop", null)).rejects.toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["request notes.read", "request tasks.list"]);
  });

  it("sends its own module's secrets to Noldova Desktop's methods, which its requests may not call, and refuses a dependency's", async () => {
    await context.secrets.saveAsync("notes.syncToken", "s3cret");

    await expect(context.secrets.saveAsync("tasks.token", "s3cret")).rejects.toThrowError(WindowPartAccessException);
    await expect(context.requestAsync("desktop.saveSecret", { name: "notes.syncToken", value: "s3cret" })).rejects.toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["request desktop.saveSecret"]);
  });

  it("hears only the event it listens for, from its module or a dependency, until it stops listening", () => {
    const heard: JsonValue[] = [];
    const stop = context.onEvent("tasks.changed", t => heard.push(t));

    host.publish("tasks.changed", 1);
    host.publish("notes.changed", 2);
    stop();
    host.publish("tasks.changed", 3);

    expect(heard).toEqual([1]);
    expect(() => context.onEvent("clock.ticked", () => undefined)).toThrowError(WindowPartAccessException);
  });

  it("hands the host each icon name it is given, by its module, so the host can log a name the kit doesn't know", () => {
    context.registerView(instanceView());
    context.registerCommand(new CommandContribution("notes.newNote", "New note", "edit_note", null, () => Promise.resolve(null)));
    context.registerSearchSource(new SearchSourceContribution("notes.notes", "Notes", "notes", "Notes", null, "unknown_search", () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([]))));
    const share = context.registerTopBarAction(new TopBarActionContribution("notes.share", new TopBarActionState("unknown_share", "Share", "tasks.share")));
    share.update(new TopBarActionState("unknown_shared", "Shared", "tasks.share"));
    context.provideMenuGroup("notes.recent", () => [new MenuRowContribution("notes.newNote", {}, "New", "unknown_row")]);
    host.providers.get("notes.recent")?.({});
    context.openDocument("notes.note", "1", "Note 1", { imageGlyph: "unknown_image", status: { glyph: "unknown_status", description: "Gone" }, marker: { glyph: "unknown_marker", label: "From" } });
    context.updateDocument("notes.note", "1", { title: "Note one" });
    context.updateDocument("notes.note", "1", { imageGlyph: "unknown_glyph" });
    context.openView("notes.list", "1", "Inbox", { icon: "unknown_view" });
    context.updateView("notes.list", "1", { icon: "unknown_icon" });

    expect(host.icons).toEqual(["notes sticky_note_2", "notes edit_note", "notes unknown_search", "notes unknown_share", "notes unknown_shared", "notes unknown_row",
      "notes unknown_image", "notes unknown_status", "notes unknown_marker", "notes unknown_glyph", "notes -", "notes -", "notes unknown_view", "notes unknown_icon"]);
  });

  it("supplies the rows of its own dynamic groups, keeps only the commands it may run and stops supplying them when withdrawn", () => {
    const withdraw = context.provideMenuGroup("notes.recent", t => [new MenuRowContribution("notes.newNote", t, "New", "note_add"), new MenuRowContribution("tasks.show"), new MenuRowContribution("other.show")]);
    const items = host.providers.get("notes.recent")?.({ tab: "a" }) ?? [];

    expect(items.map(t => [t.command, t.commandArguments, t.label, t.icon])).toEqual([["notes.newNote", { tab: "a" }, "New", "note_add"], ["tasks.show", {}, null, null]]);
    withdraw();
    expect(host.providers.has("notes.recent")).toBe(false);
    context.provideMenuGroup("notes.recent", () => []);
    context.withdraw();
    expect(host.providers.has("notes.recent")).toBe(false);
  });

  it("refuses to supply another module's group and a group that it does not declare as dynamic", () => {
    expect(() => context.provideMenuGroup("tasks.recent", () => [])).toThrowError(WindowPartAccessException);
    expect(() => context.provideMenuGroup("notes.sorting", () => [])).toThrowError(WindowPartAccessException);
  });

  it("supplies and refreshes the options of its own dynamic choice settings and stops supplying them when withdrawn", () => {
    const provider = (): readonly SettingOption[] => [new SettingOption(String.empty, "Provider default")];

    const stop = context.provideSettingOptions("notes.model", provider);
    context.refreshSettingOptions("notes.model");

    expect(host.optionProviders.get("notes.model")).toBe(provider);
    expect(host.calls).toEqual(["refresh notes.model"]);
    stop();
    expect(host.optionProviders.has("notes.model")).toBe(false);
    context.provideSettingOptions("notes.model", provider);
    context.withdraw();
    expect(host.optionProviders.has("notes.model")).toBe(false);
  });

  it("refuses to supply or refresh another module's setting and a setting that is not a dynamic choice", () => {
    host.dynamicSettings.add("tasks.model");

    for (const setting of ["tasks.model", "notes.wrapLines"]) {
      expect(() => context.provideSettingOptions(setting, () => [])).toThrowError(WindowPartAccessException);
      expect(() => context.refreshSettingOptions(setting)).toThrowError(WindowPartAccessException);
    }
    expect(host.optionProviders.size).toBe(0);
    expect(host.calls).toEqual([]);
  });

  it("supplies a check of its own checked text setting, logs a check that throws without the value, and stops supplying it when withdrawn", () => {
    const stop = context.provideSettingCheck("notes.sites", t => t.includes(" ") ? "Enter hosts only." : null);
    const check = host.checks.get("notes.sites");

    expect([check?.("github.com"), check?.("git hub.com")]).toEqual([null, "Enter hosts only."]);
    stop();
    expect(host.checks.has("notes.sites")).toBe(false);
    context.provideSettingCheck("notes.sites", () => {
      throw new TypeError("secret.example");
    });
    expect(host.checks.get("notes.sites")?.("secret.example")).toBeNull();
    context.provideSettingCheck("notes.sites", value => {
      throw `The entry ${value} has no host.`;
    });
    expect(host.checks.get("notes.sites")?.("secret.example")).toBeNull();
    expect(host.calls).toEqual([
      "log notes The check of the setting notes.sites failed, so Settings accepted its value unchecked: TypeError.",
      "log notes The check of the setting notes.sites failed, so Settings accepted its value unchecked: string."
    ]);
    context.withdraw();
    expect(host.checks.has("notes.sites")).toBe(false);
  });

  it("refuses to supply a check for another module's setting and a setting that is not a checked text", () => {
    host.checkedSettings.add("tasks.sites");

    for (const setting of ["tasks.sites", "notes.wrapLines"])
      expect(() => context.provideSettingCheck(setting, () => null)).toThrowError(WindowPartAccessException);
    expect(host.checks.size).toBe(0);
  });

  it("sets and clears a badge on its own declared views only, and clears what it set when withdrawn", () => {
    context.setViewBadge("notes.list", new ViewBadge(3, "3 unread"));
    context.setViewBadge("notes.list", null);
    context.setViewBadge("notes.list", new ViewBadge(null, "Changed"));

    expect(() => context.setViewBadge("tasks.list", null)).toThrowError(WindowPartAccessException);
    expect(() => context.setViewBadge("notes.outline", null)).toThrowError("The module notes does not declare the view notes.outline.");
    context.withdraw();
    context.withdraw();
    expect(host.calls).toEqual(["badge notes.list 3 3 unread", "badge notes.list dot none", "badge notes.list dot Changed", "badge notes.list dot none", "refresh", "refresh"]);
  });

  it("marks its own declared views' and documents' tabs as working until every mark on a tab is cleared, and clears the rest when withdrawn", () => {
    const list = context.markWorking("notes.list");
    const first = context.markWorking("notes.note", "1");
    const second = context.markWorking("notes.note", "1");
    context.markWorking("notes.note", "2");
    first();
    first();
    list();
    const before = [...host.calls];
    second();
    const late = context.markWorking("notes.list");
    context.withdraw();
    late();

    expect(() => context.markWorking("tasks.list")).toThrowError(WindowPartAccessException);
    expect(() => context.markWorking("notes.outline")).toThrowError("The module notes does not declare the view or document notes.outline.");
    expect(() => context.markWorking("notes.note", String.empty)).toThrowError(ArgumentException);
    expect(before).toEqual(["working view/notes.list true", "working document/notes.note/1 true", "working document/notes.note/2 true", "working view/notes.list false"]);
    expect(host.calls.slice(before.length)).toEqual([
      "working document/notes.note/1 false", "working view/notes.list true", "working document/notes.note/2 false", "working view/notes.list false", "refresh"
    ]);
  });

  it("marks its own declared views' and documents' tabs as waiting until every mark on a tab is cleared, apart from working, and clears both when withdrawn", () => {
    const list = context.markWaiting("notes.list");
    const first = context.markWaiting("notes.note", "1");
    const second = context.markWaiting("notes.note", "1");
    const working = context.markWorking("notes.note", "1");
    first();
    list();
    list();
    const before = [...host.calls];
    second();
    working();
    const late = context.markWaiting("notes.list");
    context.markWorking("notes.list");
    context.withdraw();
    late();

    expect(() => context.markWaiting("tasks.list")).toThrowError(WindowPartAccessException);
    expect(() => context.markWaiting("notes.outline")).toThrowError("The module notes does not declare the view or document notes.outline.");
    expect(() => context.markWaiting("notes.note", String.empty)).toThrowError(ArgumentException);
    expect(before).toEqual(["waiting view/notes.list true", "waiting document/notes.note/1 true", "working document/notes.note/1 true", "waiting view/notes.list false"]);
    expect(host.calls.slice(before.length)).toEqual([
      "waiting document/notes.note/1 false", "working document/notes.note/1 false", "waiting view/notes.list true", "working view/notes.list true",
      "working view/notes.list false", "waiting view/notes.list false", "refresh"
    ]);
  });

  it("keeps one instance's waiting mark when another instance of the same document clears its own", () => {
    const first = context.markWaiting("notes.note", "1");
    const second = context.markWaiting("notes.note", "2");
    second();
    const kept = [...host.calls];
    first();

    expect(kept).toEqual(["waiting document/notes.note/1 true", "waiting document/notes.note/2 true", "waiting document/notes.note/2 false"]);
    expect(host.calls.slice(kept.length)).toEqual(["waiting document/notes.note/1 false"]);
  });

  it("keeps a tab that its part's next context marks working when a mark from before the withdraw is cleared", () => {
    const old = context.markWorking("notes.note", "1");
    context.withdraw();
    const next = new WindowPartContext(new WindowPartSource("notes", [], [], ["notes.note"], [], [], [], [], () => Promise.reject<IWindowPart>(new Error("unused"))), host);
    const current = next.markWorking("notes.note", "1");
    old();
    const before = [...host.calls];
    current();

    expect(before).toEqual(["working document/notes.note/1 true", "working document/notes.note/1 false", "refresh", "working document/notes.note/1 true"]);
    expect(host.calls.slice(before.length)).toEqual(["working document/notes.note/1 false"]);
  });

  it.each<[string, (part: WindowPartContext) => unknown, (part: WindowPartContext) => number]>([
    ["registerView", t => t.registerView(view("notes.list")), t => t.views.length],
    ["registerDocument", t => t.registerDocument(new DocumentContribution("notes.note", load)), t => t.documents.length],
    ["registerPlaceholder", t => t.registerPlaceholder(new PlaceholderContribution("notes.start", load)), t => t.placeholders.length],
    ["registerSettingsPage", t => t.registerSettingsPage(new SettingsPageContribution("notes.sync", load)), t => t.settingsPages.length],
    ["registerCommand", t => t.registerCommand(new CommandContribution("notes.newNote", "New note", null, null, () => Promise.resolve(null))), t => t.commands.length],
    ["registerSearchSource", t => t.registerSearchSource(searchSource("notes.notes")), t => t.searchSources.length],
    ["registerStatusBarItem", t => t.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes"))), t => t.statusBarItems.length],
    ["registerTopBarAction", t => t.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote"))),
      t => t.topBarActions.length],
    ["registerSave", t => t.registerSave(() => Promise.resolve()), t => t.saves.length],
    ["registerSelectionSource", t => t.registerSelectionSource(document.createElement("div"), { hasSelection: () => true, readSelection: () => "total 8" }),
      () => host.selectionSources.size],
    ["provideUndo", t => t.provideUndo({ canUndo: () => true, undoAsync: () => Promise.resolve() }), () => host.undoProviders.length],
    ["provideMenuGroup", t => t.provideMenuGroup("notes.recent", () => []), () => host.providers.size],
    ["provideSettingOptions", t => t.provideSettingOptions("notes.model", () => []), () => host.optionProviders.size],
    ["provideSettingCheck", t => t.provideSettingCheck("notes.sites", () => null), () => host.checks.size],
    ["setViewBadge", t => t.setViewBadge("notes.list", new ViewBadge(3, "3 unread")), () => 0],
    ["markWorking", t => t.markWorking("notes.note", "1"), () => 0],
    ["markWaiting", t => t.markWaiting("notes.note", "1"), () => 0],
    ["onViewClosed", t => t.onViewClosed("notes.list", () => undefined), () => host.viewListeners.size],
    ["onPlaceShown", t => t.onPlaceShown("notes.list", () => undefined), () => host.placeListeners.size],
    ["onDocumentClosed", t => t.onDocumentClosed("notes.note", () => undefined), () => host.documentListeners.size],
    ["onTabRenamed", t => t.onTabRenamed("notes.note", () => undefined), () => host.renameListeners.size],
    ["onEvent", t => t.onEvent("tasks.changed", () => undefined), () => host.listeners.size],
    ["onSettingChanged", t => t.onSettingChanged("tasks.size", () => undefined), () => host.settingListeners.size],
    ["onDependencyChanged", t => t.onDependencyChanged(() => {
      throw new Error("heard");
    }), t => {
      const failures: unknown[] = [];
      t.announceDependency("clock", true, u => failures.push(u));
      return failures.length;
    }]
  ])("ignores %s once withdrawn, so the window holds nothing for it and its remover does nothing", (_, register, count) => {
    const part = new WindowPartContext(new WindowPartSource("notes", ["tasks"], ["notes.list"], ["notes.note"], ["notes.newNote"], ["notes.count"], ["notes.compose"], ["notes.saved"],
      () => Promise.reject<IWindowPart>(new Error("unused")), ["notes.start"], [], [{ name: "notes.sync", title: "Sync" }]), host);
    part.registerView(instanceView());
    part.withdraw();
    host.calls.length = 0;

    const registered = register(part);
    const held = count(part);
    if (Object.isFunction(registered))
      registered();

    expect([held, host.calls]).toEqual([0, []]);
  });

  describe("once withdrawn", () => {
    let part: WindowPartContext;

    beforeEach(() => {
      part = new WindowPartContext(new WindowPartSource("notes", ["tasks"], ["notes.list", "notes.panel"], ["notes.note"], [], [], [], [],
        () => Promise.reject<IWindowPart>(new Error("unused"))), host);
      part.registerView(instanceView());
      part.registerView(view("notes.panel"));
      part.withdraw();
      host.calls.length = 0;
    });

    it.each<[string, (withdrawn: WindowPartContext) => unknown]>([
      ["openDocument", t => t.openDocument("notes.note", "1", "Note 1", { preview: true })],
      ["keepDocument", t => t.keepDocument("notes.note", "1")],
      ["closeDocument", t => t.closeDocument("notes.note", "1")],
      ["updateDocument", t => t.updateDocument("notes.note", "1", { title: "Note 2" })],
      ["openView", t => t.openView("notes.list", "1", "Shell 1")],
      ["updateView", t => t.updateView("notes.list", "1", { title: "Shell 2" })],
      ["closeView", t => t.closeView("notes.list", "1")],
      ["returnView", t => t.returnView("notes.list", "1")],
      ["showView", t => t.showView("notes.panel")],
      ["recordPlace", t => t.recordPlace("notes.panel", "note-1")],
      ["forgetPlace with an instance", t => t.forgetPlace("notes.list", "/home", "1")],
      ["hideViewDock", t => t.hideViewDock("notes.panel")],
      ["hideViewDock with an instance", t => t.hideViewDock("notes.list", "1")],
      ["growViewDock and its release", t => t.growViewDock("notes.list", 20, "1")()],
      ["showInDialogAsync", t => t.showInDialogAsync("tasks.board", { title: "Board" })],
      ["openLinkAsync", t => t.openLinkAsync("https://example.com/help")],
      ["showLinkMenu", t => t.showLinkMenu("https://example.com/help", new MouseEvent("contextmenu"))],
      ["registerInAppBrowser and its release", t => t.registerInAppBrowser({ placeFor: () => LinkPlace.InApp, openAsync: () => Promise.resolve() })()],
      ["showInFolderAsync", t => t.showInFolderAsync("/home/person/notes/note.txt")],
      ["openFileAsync", t => t.openFileAsync("/home/person/notes/note.txt")]
    ])("does nothing for %s", async (_, call) => {
      await call(part);

      expect(host.calls).toEqual([]);
    });

    it("shows no system dialog: the folder chooser answers no folder and the save dialog answers cancelled", async () => {
      const answers = [await part.chooseFolderAsync(), await part.saveFileAsync("note.txt", new Uint8Array([1, 2, 3]))];

      expect([answers, host.calls]).toEqual([[null, FileSaveOutcome.Cancelled], []]);
    });

    it("shows no file chooser and answers no path, still refusing options a live context refuses", async () => {
      const answer = await part.chooseFilePathAsync({ extensions: ["exe"], folder: "/opt/tools" });

      expect([answer, host.calls]).toEqual([null, []]);
      await expect(part.chooseFilePathAsync({ extensions: [".exe"] })).rejects.toThrowError(ArgumentException);
    });

    it("grants no file and discards nothing", async () => {
      const answers = [await part.chooseFilesAsync(), await part.grantFilesAsync([new File(["notes"], "notes.txt")])];
      part.discardFileGrants(["a".repeat(32)]);

      expect([answers, host.calls]).toEqual([[IssuedFileGrants.none, IssuedFileGrants.none], []]);
      await expect(part.chooseFilesAsync({ lifetime: 0 })).rejects.toThrowError(ArgumentOutOfRangeException);
    });

    it("still refuses the names and values a live context refuses", async () => {
      expect(() => part.onViewClosed("notes.panel", () => undefined)).toThrowError("The module notes does not declare the view with instances notes.panel.");
      expect(() => part.onViewClosed("notes.outline", () => undefined)).toThrowError(WindowPartAccessException);
      expect(() => part.showView("notes.list")).toThrowError(WindowPartAccessException);
      expect(() => part.openView("notes.list", " ", "Shell")).toThrowError(ArgumentException);
      expect(() => part.openDocument("tasks.note", "1", "Task")).toThrowError(WindowPartAccessException);
      expect(() => part.updateDocument("notes.note", "1", { title: " " })).toThrowError(ArgumentException);
      await expect(part.showInDialogAsync("clock.face")).rejects.toThrowError(WindowPartAccessException);
      expect(host.calls).toEqual([]);
    });
  });

  it("posts nothing once withdrawn, and its handle dismisses nothing", async () => {
    context.withdraw();
    host.calls.length = 0;

    const handle = await context.postNotificationAsync(notification("notes.saved", "Saved", null));
    handle.dismiss();

    expect([handle.id, host.calls]).toEqual([String.empty, []]);
  });

  it("dismisses a notification the window posts after its part is withdrawn, and its handle does not dismiss it again", async () => {
    const posting = context.postNotificationAsync(notification("notes.saved", "Saved", null));
    context.withdraw();

    const handle = await posting;
    handle.dismiss();

    expect([handle.id, host.calls]).toEqual(["1", ["post Saved", "refresh", "dismiss 1"]]);
  });

  it("withdraws its contributions and listeners and has the host refresh", () => {
    const heard: JsonValue[] = [];
    context.registerView(view("notes.list"));
    context.registerDocument(new DocumentContribution("notes.note", load));
    context.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes")));
    context.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote")));
    context.onEvent("notes.changed", t => heard.push(t));

    context.withdraw();
    host.publish("notes.changed", 1);

    expect([context.views, context.documents, context.statusBarItems, context.topBarActions, heard, host.listeners.size]).toEqual([[], [], [], [], [], 0]);
    expect(host.calls).toEqual(["refresh", "refresh", "refresh", "refresh", "refresh"]);
  });

  it("asks the host which command the window would run for a key", () => {
    const answers = ["k", "x"].map(t => context.findWindowCommand(new KeyboardEvent("keydown", { key: t, ctrlKey: true })));

    expect(answers).toEqual(["notes.find", null]);
    expect(host.calls).toEqual(["findWindowCommand k", "findWindowCommand x"]);
  });

  it("reads a command's key from the host", () => {
    const key = context.keyOf("notes.find");
    host.keys.set({ label: "F6", ariaKeyShortcuts: "F6" });

    expect(key()).toEqual({ label: "F6", ariaKeyShortcuts: "F6" });
    expect(host.calls).toEqual(["keyOf notes.find"]);
  });
});
