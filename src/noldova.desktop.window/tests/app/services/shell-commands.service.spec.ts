/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/context.json";

import { BottomDockSpan } from "../../../src/app/enums/bottom-dock-span";
import { DockSide } from "../../../src/app/enums/dock-side";
import { LinkPlace } from "../../../src/app/enums/link-place";
import { ToolbarMove } from "../../../src/app/enums/toolbar-move";
import type { CommandContribution } from "../../../src/app/models/command-contribution";
import { ModuleState, ModuleStatus } from "@noldova/desktop.protocol";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewType } from "../../../src/app/models/layout/view-type";
import type { LayoutService } from "../../../src/app/services/layout.service";
import { LinkService } from "../../../src/app/services/link.service";
import { EditTargetService } from "../../../src/app/services/edit-target.service";
import { ModuleStatusService } from "../../../src/app/services/module-status.service";
import { SearchPaletteService } from "../../../src/app/services/search-palette.service";
import { SettingsPageService } from "../../../src/app/services/settings-page.service";
import { ShellCommandsService } from "../../../src/app/services/shell-commands.service";
import { TabRenameService } from "../../../src/app/services/tab-rename.service";
import { TabStripService } from "../../../src/app/services/tab-strip.service";
import { ToolbarService } from "../../../src/app/services/toolbar.service";
import { UpdateService } from "../../../src/app/services/update.service";
import { ViewDialogService } from "../../../src/app/services/view-dialog.service";
import { DomFixture } from "../../fixtures/dom.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";

describe("ShellCommandsService", () => {
  const { files, search, changes, plan, todo, settings } = LayoutFixture;
  const registry = LayoutFixture.createRegistry();
  const prepared = Layout.createDefault(registry).openView(search, registry).openDocument(plan).openDocument(todo).openDocument(settings, true);
  let layout: LayoutService;
  let service: ShellCommandsService;
  let bridge: PreloadBridgeFixture;

  beforeEach(async () => {
    bridge = PreloadBridgeFixture.install();
    layout = await LayoutServiceFixture.prepareAsync(registry, prepared);
    service = TestBed.inject(ShellCommandsService);
  });

  afterEach(() => PreloadBridgeFixture.remove());

  function command(name: string): CommandContribution {
    const found = service.commands.find(t => t.name === name);
    if (Object.isUndefined(found))
      throw new Error(`No ${name} command.`);
    return found;
  }

  async function runAsync(name: string, commandArguments: JsonValue = null): Promise<void> {
    expect(await command(name).runAsync(commandArguments)).toBeNull();
    TestBed.tick();
  }

  function enabled(name: string, commandArguments: JsonValue = null): boolean {
    return command(name).isEnabled(commandArguments);
  }

  function checked(name: string, commandArguments: JsonValue): boolean {
    return command(name).isChecked?.(commandArguments) ?? false;
  }

  const tab = (key: string): JsonValue => ({ tab: key });

  it("replaces the misspelled word in the field that had focus and adds a word to the dictionary, each enabled only with its word", async () => {
    const host = document.createElement("div");
    host.innerHTML = "<input type=\"text\" value=\"Meetng notes\"><div class=\"cdk-overlay-container\"><button type=\"button\">Meeting</button></div>";
    document.body.append(host);
    const field = DomFixture.oneOf(host, "input", HTMLInputElement);
    const row = DomFixture.oneOf(host, "button", HTMLButtonElement);
    field.focus();
    row.focus();

    const replaceEnabled = [null, {}, { text: String.empty }, { text: "Meeting" }].map(t => enabled("desktop.replaceMisspelling", t));
    const addEnabled = [null, {}, { word: String.empty }, { word: "Meetng" }].map(t => enabled("desktop.addToDictionary", t));
    await runAsync("desktop.replaceMisspelling", { text: "Meeting" });
    const focusAfterReplace = document.activeElement;
    await runAsync("desktop.replaceMisspelling", {});
    row.focus();
    await runAsync("desktop.addToDictionary", { word: "Meetng" });
    const focusAfterAdd = document.activeElement;
    await runAsync("desktop.addToDictionary", null);
    host.remove();
    await runAsync("desktop.replaceMisspelling", { text: "Meeting" });

    expect(replaceEnabled).toEqual([false, false, false, true]);
    expect(addEnabled).toEqual([false, false, false, true]);
    expect([focusAfterReplace, focusAfterAdd]).toEqual([field, field]);
    expect(bridge.replacements).toEqual(["Meeting"]);
    expect(bridge.addedWords).toEqual(["Meetng"]);
  });

  it("opens a web link from the link menu in the in-app browser or the system's browser, offering the in-app one only while a part is that browser", async () => {
    const links = TestBed.inject(LinkService);
    const docs = { url: "https://example.com/docs" };
    const mail = { url: "mailto:ada@example.com" };
    const applies = (name: string, commandArguments: JsonValue): boolean => command(name).isApplicable(commandArguments);
    const before = [applies("desktop.openLinkInApp", docs), applies("desktop.openLinkInBrowser", docs), applies("desktop.openLinkInBrowser", mail), enabled("desktop.openLinkInBrowser", null)];
    const opened: string[] = [];
    links.register({ placeFor: () => LinkPlace.System, openAsync: t => Promise.resolve(void opened.push(t)) }, () => undefined);
    const registered = [applies("desktop.openLinkInApp", docs), enabled("desktop.openLinkInApp", docs), applies("desktop.openLinkInApp", mail)];
    await runAsync("desktop.openLinkInApp", docs);
    await runAsync("desktop.openLinkInBrowser", docs);
    await command("desktop.openLinkInApp").runAsync(mail);

    expect([before, registered, opened, bridge.links]).toEqual([[false, true, false, false], [true, true, false], ["https://example.com/docs"], ["https://example.com/docs"]]);
    expect([command("desktop.openLinkInApp").title, command("desktop.openLinkInBrowser").title]).toEqual(["Open in Noldova Desktop Sample", "Open in your browser"]);
  });

  it("offers neither open command for a link the system would refuse, one with credentials or over 32768 characters, while a part is the in-app browser", () => {
    const links = TestBed.inject(LinkService);
    links.register({ placeFor: () => LinkPlace.System, openAsync: () => Promise.resolve() }, () => undefined);
    const refused = ["https://ada:secret@example.com/", "https://ada@example.com/", `https://example.com/${"a".repeat(32769 - "https://example.com/".length)}`];
    const offered = refused.map(t => ["desktop.openLinkInApp", "desktop.openLinkInBrowser"].flatMap(u => [command(u).isApplicable({ url: t }), enabled(u, { url: t })]));

    expect(offered).toEqual(refused.map(() => [false, false, false, false]));
    expect(enabled("desktop.openLinkInApp", { url: "https://example.com/" })).toBe(true);
  });

  it("offers the shell's tab and layout commands, each with a title and an icon and none with a default key", () => {
    expect(service.commands.map(t => t.name)).toEqual([
      "desktop.closeTab", "desktop.keepTab", "desktop.renameTab", "desktop.closeOtherTabs", "desktop.closeTabsToTheRight", "desktop.closeAllTabs", "desktop.moveTabLeft", "desktop.moveTabRight",
      "desktop.nextTab", "desktop.previousTab", "desktop.splitTabLeft", "desktop.splitTabRight", "desktop.splitTabUp", "desktop.splitTabDown", "desktop.dockTabLeft", "desktop.dockTabRight",
      "desktop.dockTabBottom", "desktop.moveTabToGroup", "desktop.moveTabToNextGroup", "desktop.moveTabToPreviousGroup", "desktop.focusNextGroup", "desktop.focusPreviousGroup", "desktop.focusNextRegion", "desktop.focusPreviousRegion",
      "desktop.toggleLeftDock", "desktop.toggleRightDock", "desktop.toggleBottomDock", "desktop.undo", "desktop.redo", "desktop.cut",
      "desktop.copy", "desktop.paste", "desktop.selectAll", "desktop.replaceMisspelling", "desktop.addToDictionary", "desktop.openLinkInApp", "desktop.openLinkInBrowser", "desktop.search", "desktop.showCommands", "desktop.openSettings", "desktop.showShortcuts", "desktop.installCommand", "desktop.checkForUpdates",
      "desktop.restartToUpdate", "desktop.openLogFolder", "desktop.copyDetails", "desktop.openModules", "desktop.showInDialog", "desktop.toggleToolbar", "desktop.moveToolbarLeft",
      "desktop.moveToolbarRight", "desktop.moveToolbarUp", "desktop.moveToolbarDown", "desktop.hideToolbar",
      "desktop.focusToolbars", "desktop.goBack", "desktop.goForward", "desktop.toggleView", "desktop.resetLayout", "desktop.spanBottomDock", "desktop.fitBottomDockBetween", "desktop.showAllTabs"
    ]);
    expect(service.commands.every(t => t.title.length > 0)).toBe(true);
    expect(service.commands.filter(t => Object.isNull(t.icon)).map(t => t.name)).toEqual(["desktop.replaceMisspelling"]);
    expect(service.commands.filter(t => !Object.isNull(t.defaultKey))).toEqual([]);
    expect(command("desktop.keepTab").title).toBe("Keep the tab open");
  });

  it("opens Settings as a kept document, or reveals the open one, and is enabled only while the document is registered", async () => {
    await runAsync("desktop.openSettings");
    const opened = layout.layout().documents;
    layout.setRegistry(new ViewRegistry([], ["notes.note"]));

    expect([opened.active?.key, opened.preview]).toEqual([settings.key, null]);
    expect(opened.tabs.filter(t => t.equals(settings)).length).toBe(1);
    expect(enabled("desktop.openSettings")).toBe(false);
  });

  it("opens Settings at the page its arguments name, and at its last page without one", async () => {
    const pages = TestBed.inject(SettingsPageService);

    await runAsync("desktop.openSettings", { page: "About" });
    const requested = pages.requested();
    pages.take();
    await runAsync("desktop.openSettings", {});

    expect([requested, pages.requested(), layout.layout().documents.active?.key]).toEqual(["About", null, settings.key]);
  });

  it("shows the keyboard shortcuts on Settings' Keyboard shortcuts page, enabled only while Settings is registered", async () => {
    const pages = TestBed.inject(SettingsPageService);

    await runAsync("desktop.showShortcuts");
    const requested = pages.requested();
    layout.setRegistry(new ViewRegistry([], ["notes.note"]));

    expect([requested, command("desktop.showShortcuts").title, command("desktop.showShortcuts").icon]).toEqual(["Keyboard shortcuts", "Show keyboard shortcuts", "keyboard"]);
    expect(enabled("desktop.showShortcuts")).toBe(false);
  });

  it("checks for and restarts to install an update through the main process, each offered and enabled only in its state", async () => {
    const updates = TestBed.inject(UpdateService);
    const names = ["desktop.checkForUpdates", "desktop.restartToUpdate"];
    const offers = (): readonly string[] => names.map(t => `${command(t).isApplicable(null)}/${enabled(t)}`);
    const update = (kind: string, version: string | null = null, mustMove: boolean = false): object => ({ kind, version, progress: null, checkedAt: null, reason: null, mustMove });
    const seen: (readonly string[])[] = [offers()];
    for (const state of [update("UpToDate"), update("Checking"), update("Available", "1.3.0", true), update("Downloading", "1.3.0"),
      update("Ready", "1.3.0"), update("Failed", "1.3.0")]) {
      bridge.publishUpdate(state);
      seen.push(offers());
    }

    for (const name of names)
      await runAsync(name);
    await vi.waitFor(() => expect(bridge.updateActions.length).toBe(2));

    expect(updates.state().kind).toBe("Failed");
    expect(seen).toEqual([
      ["false/false", "false/false"],
      ["true/true", "false/false"],
      ["true/false", "false/false"],
      ["true/true", "false/false"],
      ["true/false", "false/false"],
      ["true/false", "true/true"],
      ["true/true", "false/false"]
    ]);
    expect(bridge.updateActions).toEqual(["Check", "Restart"]);
    expect(names.map(t => command(t).title)).toEqual(["Check for updates", "Restart to update"]);
  });

  it("opens the log folder and copies the details of every module through the main process, from Help, saying when the details are copied", async () => {
    bridge.responses.set("desktop.postNotification", { payload: { id: "n1" } });
    TestBed.inject(ModuleStatusService).set([
      new ModuleStatus("clock", "0.0.1", "Clock", "Tells the time.", [], new Map(), ModuleState.Failed, "Its runtime part failed to activate."),
      new ModuleStatus("notes", "1.0.0", "Notes", "Keeps notes.", [], new Map(), ModuleState.Active, null)
    ]);

    const opened = await command("desktop.openLogFolder").runAsync(null);
    const copied = await command("desktop.copyDetails").runAsync(null);

    expect([opened, copied, bridge.logFolderOpens]).toEqual([true, true, 1]);
    expect(bridge.requests.filter(t => t[0] === "desktop.postNotification").map(t => JSON.stringify(t[1]))).toEqual([expect.stringContaining("\"title\":\"Details copied\"")]);
    expect(bridge.copiedDetails).toEqual(["Platform: win32 x64\nclock 0.0.1: Failed: Its runtime part failed to activate.\nnotes 1.0.0: Active"]);
    expect([enabled("desktop.openLogFolder"), enabled("desktop.copyDetails")]).toEqual([true, true]);
    expect([command("desktop.openLogFolder").title, command("desktop.copyDetails").title]).toEqual(["Open log folder", "Copy details"]);
  });

  it("opens Modules as one kept document, revealing the open one, and is enabled only while the document is registered", async () => {
    const modules = new DocumentTab("desktop.modules");
    const unregistered = enabled("desktop.openModules");
    layout.setRegistry(new ViewRegistry(registry.views, ["notes.note", "desktop.settings", "desktop.modules"]));

    await runAsync("desktop.openModules");
    layout.activate(plan);
    await runAsync("desktop.openModules");
    const opened = layout.layout().documents;

    expect([unregistered, enabled("desktop.openModules")]).toEqual([false, true]);
    expect([opened.active?.key, opened.preview?.key]).toEqual([modules.key, settings.key]);
    expect(opened.tabs.filter(t => t.equals(modules)).length).toBe(1);
    expect(command("desktop.openModules").title).toBe("Modules…");
  });

  it("installs the command in PATH through the main process, offered and enabled only on macOS", async () => {
    const offered = [command("desktop.installCommand").isApplicable(null), enabled("desktop.installCommand")];
    bridge.platform = "darwin";

    const isInstalled = await command("desktop.installCommand").runAsync(null);

    expect(offered).toEqual([false, false]);
    expect([command("desktop.installCommand").isApplicable(null), enabled("desktop.installCommand"), isInstalled, bridge.commandInstalls]).toEqual([true, true, true, 1]);
    expect(command("desktop.installCommand").title).toBe("Install command in PATH");
  });

  it("shows a registered view or document named by its tab key in a dialog, and is enabled only for one while no dialog is shown", async () => {
    const dialogs = TestBed.inject(ViewDialogService);
    const before = layout.layout().documents.tabs.map(t => t.key);
    const refused = [null, {}, tab("view"), tab("view/Files"), tab("view/files.missing"), tab("panel/files.search"), tab("document/notes.note/ "), tab("document/notes.page/1")]
      .map(t => enabled("desktop.showInDialog", t));
    const accepted = [tab("view/files.search"), tab("view/terminal.shell/3"), tab("document/notes.note/a/b"), tab("document/desktop.settings")].map(t => enabled("desktop.showInDialog", t));

    const running = command("desktop.showInDialog").runAsync(tab("document/notes.note/a/b"));
    const shown = dialogs.shown()?.key;
    const whileShown = enabled("desktop.showInDialog", tab("view/files.search"));
    const ignored = await command("desktop.showInDialog").runAsync(tab("view/files.search"));
    dialogs.close();

    expect(refused.some(t => t)).toBe(false);
    expect(accepted.every(t => t)).toBe(true);
    expect([shown, whileShown, ignored, await running]).toEqual(["document/notes.note/a/b", false, null, null]);
    expect(dialogs.shown()).toBeNull();
    expect(layout.layout().documents.tabs.map(t => t.key)).toEqual(before);
  });

  it("edits the field that had focus before a menu took it, restoring the field and its selection first, and only when the field allows the edit", async () => {
    const host = document.createElement("div");
    host.innerHTML = "<input type=\"text\" value=\"Meeting notes\"><div class=\"cdk-overlay-container\"><button type=\"button\">Copy</button></div>";
    document.body.append(host);
    const field = DomFixture.oneOf(host, "input", HTMLInputElement);
    const row = DomFixture.oneOf(host, "button", HTMLButtonElement);
    const disabledBefore = enabled("desktop.copy");
    field.focus();
    field.setSelectionRange(0, 7);
    row.focus();

    const enabledInMenu = ["desktop.copy", "desktop.cut", "desktop.paste", "desktop.selectAll", "desktop.undo", "desktop.redo"].map(t => enabled(t));
    await runAsync("desktop.copy");
    const restored = [document.activeElement === field, field.selectionStart, field.selectionEnd];
    field.setSelectionRange(2, 2);
    row.focus();
    await runAsync("desktop.cut");
    host.remove();

    expect(disabledBefore).toBe(false);
    expect(enabledInMenu).toEqual([true, true, true, true, true, true]);
    expect(restored).toEqual([true, 0, 7]);
    expect(bridge.edits).toEqual(["Copy"]);
  });

  it("copies a part's own selection through the window's clipboard channel while focus is in its element, from the menus, and only while something is selected", async () => {
    const host = document.createElement("div");
    host.innerHTML = "<div class=\"terminal\"><textarea></textarea></div><div class=\"cdk-overlay-container\"><button type=\"button\">Copy</button></div>";
    document.body.append(host);
    const terminal = DomFixture.one(host, ".terminal");
    const helper = DomFixture.oneOf(host, "textarea", HTMLTextAreaElement);
    const row = DomFixture.oneOf(host, "button", HTMLButtonElement);
    let selected = false;
    const unregister = TestBed.inject(EditTargetService).registerSource(terminal, { hasSelection: () => selected, readSelection: () => "total 8" });
    helper.focus();
    row.focus();

    const unselected = enabled("desktop.copy");
    await runAsync("desktop.copy");
    selected = true;
    const selectedInMenu = [enabled("desktop.copy"), enabled("desktop.cut")];
    await runAsync("desktop.copy");
    const restored = document.activeElement === helper;
    unregister();
    row.focus();
    const afterRemoval = enabled("desktop.copy");
    host.remove();

    expect(unselected).toBe(false);
    expect(selectedInMenu).toEqual([true, false]);
    expect(restored).toBe(true);
    expect(afterRemoval).toBe(false);
    expect(bridge.copied).toEqual(["total 8"]);
    expect(bridge.edits).toEqual([]);
    expect(bridge.errorsLogged).toEqual([]);
  });

  it("logs a part's selection the main process refuses to copy, or whose copy fails, without its text", async () => {
    const host = document.createElement("div");
    host.innerHTML = "<div class=\"terminal\"><textarea></textarea></div>";
    document.body.append(host);
    const terminal = DomFixture.one(host, ".terminal");
    TestBed.inject(EditTargetService).registerSource(terminal, { hasSelection: () => true, readSelection: () => "total 8" });
    host.querySelector("textarea")?.focus();

    bridge.isCopyAccepted = false;
    await runAsync("desktop.copy");
    bridge.copyFailure = new Error("The main process is gone.");
    await runAsync("desktop.copy");
    bridge.copyFailure = "offline";
    await runAsync("desktop.copy");
    host.remove();

    expect(bridge.errorsLogged).toEqual([
      [null, "The selection was not copied: the main process refused it, and its log says why."],
      [null, "The selection was not copied: The main process is gone."],
      [null, "The selection was not copied: offline"]
    ]);
    expect(bridge.copied).toEqual([]);
  });

  it("acts on the current tab without arguments: the active tab of the group last focused or activated, else the documents' active tab", async () => {
    expect(enabled("desktop.keepTab")).toBe(true);
    layout.activate(files);
    await runAsync("desktop.closeTab");
    expect(layout.layout().isOpen(files)).toBe(false);

    layout.focusGroup(layout.layout().documents.id);
    await runAsync("desktop.moveTabLeft");
    expect(layout.layout().documents.tabs).toEqual([plan, settings, todo]);

    layout.focusGroup(999);
    expect(layout.currentGroup()).toBe(layout.layout().documents);
  });

  it("acts on the tab its arguments name, and is disabled for a tab that is not open", async () => {
    await runAsync("desktop.closeTab", tab(plan.key));

    expect(layout.layout().documents.tabs).toEqual([todo, settings]);
    expect(enabled("desktop.closeTab", tab("document/notes.note/gone"))).toBe(false);
    await runAsync("desktop.closeTab", tab("document/notes.note/gone"));
    expect(layout.layout().documents.tabs).toEqual([todo, settings]);
  });

  it("keeps a preview, and only a preview", async () => {
    expect([enabled("desktop.keepTab", tab(settings.key)), enabled("desktop.keepTab", tab(plan.key))]).toEqual([true, false]);

    await runAsync("desktop.keepTab", tab(settings.key));

    expect(layout.layout().documents.preview).toBeNull();
  });

  it("closes the other tabs, the tabs to the right and all tabs of a group, when there are any to close", async () => {
    expect([enabled("desktop.closeOtherTabs", tab(files.key)), enabled("desktop.closeTabsToTheRight", tab(settings.key))]).toEqual([true, false]);
    await runAsync("desktop.closeTabsToTheRight", tab(plan.key));
    expect(layout.layout().documents.tabs).toEqual([plan]);
    expect(enabled("desktop.closeOtherTabs", tab(plan.key))).toBe(false);

    await runAsync("desktop.closeOtherTabs", tab(files.key));
    expect(layout.layout().groupOf(files)?.tabs).toEqual([files]);
    await runAsync("desktop.closeAllTabs", tab(plan.key));
    expect(layout.layout().documents.tabs).toEqual([]);
  });

  it("moves a tab left and right within its group, and does nothing at either end", async () => {
    expect([enabled("desktop.moveTabLeft", tab(plan.key)), enabled("desktop.moveTabRight", tab(settings.key))]).toEqual([false, false]);
    await runAsync("desktop.moveTabLeft", tab(plan.key));
    await runAsync("desktop.moveTabRight", tab(plan.key));

    expect(layout.layout().documents.tabs).toEqual([todo, plan, settings]);
  });

  it("splits a tab off on any edge when its group keeps a tab, and docks a movable tab on any side", async () => {
    expect([enabled("desktop.splitTabRight", tab(changes.key)), enabled("desktop.splitTabRight", tab(search.key))]).toEqual([false, true]);
    expect(enabled("desktop.dockTabBottom", tab(plan.key))).toBe(false);

    await runAsync("desktop.splitTabDown", tab(search.key));
    expect(layout.layout().groupOf(search)?.tabs).toEqual([search]);
    await runAsync("desktop.dockTabBottom", tab(search.key));
    expect(layout.layout().sideOf(layout.layout().groupOf(search)?.id ?? -1)).toBe(DockSide.Bottom);
  });

  it("renames a tab only where its part declares it renamable, and leaves Rename out elsewhere", async () => {
    const applies = (commandArguments: JsonValue): boolean => command("desktop.renameTab").isApplicable(commandArguments);
    const before = [applies(tab(plan.key)), enabled("desktop.renameTab", tab(plan.key))];
    layout.setRegistry(new ViewRegistry(registry.views, ["notes.note", "desktop.settings"], new Map(), new Set(["notes.note"])));

    await runAsync("desktop.renameTab", tab(plan.key));

    expect([before, applies(tab(plan.key)), applies(tab(settings.key)), command("desktop.renameTab").title, command("desktop.renameTab").icon])
      .toEqual([[false, false], true, false, "Rename the tab", "edit"]);
    expect(TestBed.inject(TabRenameService).editing()).toEqual(plan);
  });

  it("leaves Rename out for a tab its collapsed dock hides, or a header on a side set to icons stands for", async () => {
    const terminal = LayoutFixture.terminal;
    const applies = (): boolean => command("desktop.renameTab").isApplicable(tab(terminal.key));
    layout.setRegistry(new ViewRegistry([
      new ViewType("files.tree", DockSide.Left, true),
      new ViewType("files.search", DockSide.Left, false),
      new ViewType("git.changes", DockSide.Right, true),
      new ViewType("terminal.shell", DockSide.Bottom, false, true, null, true)
    ], ["notes.note", "desktop.settings"]));
    layout.openView(terminal);
    const shown = applies();
    layout.toggleDock(DockSide.Bottom);
    const collapsed = applies();
    layout.toggleDock(DockSide.Bottom);
    await runAsync("desktop.dockTabLeft", tab(terminal.key));
    const inStrip = applies();
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.leftDockStyle", value: "Icons", isSet: true });

    expect([shown, collapsed, inStrip, applies()]).toEqual([true, false, true, false]);
  });

  it("leaves out what can never apply to a tab: Keep open on a kept tab, and docking a document", () => {
    const applies = (name: string, commandArguments: JsonValue): boolean => command(name).isApplicable(commandArguments);

    expect([applies("desktop.keepTab", tab(settings.key)), applies("desktop.keepTab", tab(plan.key))]).toEqual([true, false]);
    expect(["desktop.splitTabLeft", "desktop.dockTabLeft", "desktop.moveTabToGroup"].map(t => [applies(t, tab(plan.key)), applies(t, tab(search.key))]))
      .toEqual([[true, true], [false, true], [true, true]]);
    expect([applies("desktop.closeTab", tab(plan.key)), applies("desktop.closeTab", tab("missing")), applies("desktop.moveTabToGroup", tab("missing"))])
      .toEqual([true, false, false]);
  });

  it("closes a group's only tab, which closes the group and leaves no tab of it to focus", async () => {
    const group = layout.layout().groupOf(changes)?.id ?? -1;

    await runAsync("desktop.closeTab", tab(changes.key));

    expect([layout.layout().isOpen(changes), layout.layout().group(group)]).toEqual([false, null]);
  });

  it("passes the focus to the group that remains when a closed tab was the last of its group, and has none to focus when no tab remains", async () => {
    await runAsync("desktop.splitTabRight", tab(todo.key));
    const remaining = layout.layout().documentGroups[0];

    await runAsync("desktop.closeTab", tab(todo.key));

    expect([layout.layout().documentGroups.map(t => t.id), layout.currentGroup().id, layout.currentGroup().active]).toEqual([[remaining?.id], remaining?.id, remaining?.active]);
    await runAsync("desktop.closeTab", tab(plan.key));
    await runAsync("desktop.closeTab", tab(settings.key));
    expect([layout.layout().documents.tabs, layout.currentGroup().active]).toEqual([[], null]);
  });

  it("moves a tab to another group that accepts it, and to no other", async () => {
    const other = layout.layout().groupOf(changes)?.id ?? -1;
    const own = layout.layout().groupOf(search)?.id ?? -1;
    const documents = layout.layout().documents.id;
    const move = (key: string, group?: number): JsonValue => Object.isUndefined(group) ? { tab: key } : { tab: key, group };

    expect([move(search.key, other), move(search.key, own), move(search.key, documents), move(plan.key, other), move(search.key), move(search.key, 999), null]
      .map(t => enabled("desktop.moveTabToGroup", t))).toEqual([true, false, true, false, false, false, false]);
    await runAsync("desktop.moveTabToGroup", move(search.key, other));
    await runAsync("desktop.moveTabToGroup", move(search.key, other));

    expect(layout.layout().groupOf(search)?.id).toBe(other);
    expect(layout.layout().groupOf(search)?.tabs.at(-1)).toEqual(search);
  });

  it("splits a document into a documents group, moves a tab between the groups it can join and focuses the next or previous group, wrapping at either end", async () => {
    const names = ["desktop.moveTabToNextGroup", "desktop.moveTabToPreviousGroup", "desktop.focusNextGroup", "desktop.focusPreviousGroup"];
    const before = names.map(t => enabled(t, t.includes("focus") ? null : tab(plan.key)));

    await runAsync("desktop.splitTabRight", tab(todo.key));
    const [first, second] = layout.layout().documentGroups;
    const contents = (): number[] => layout.layout().documentGroups.map(t => t.tabs.length);

    expect(before).toEqual([false, false, true, true]);
    expect([first?.tabs, second?.tabs, layout.layout().documents.id]).toEqual([[plan, settings], [todo], second?.id]);
    expect([enabled("desktop.splitTabRight", tab(todo.key)), enabled("desktop.splitTabRight", tab(plan.key))]).toEqual([false, true]);
    const frames = layout.geometry().frames.filter(t => !Object.isNull(t.group.active)).length;
    const visited = new Set<number>();
    for (let step = 0; step < frames; step++) {
      await runAsync("desktop.focusNextGroup");
      visited.add(layout.currentGroup().id);
    }
    expect([visited.size, visited.has(first?.id ?? -1), visited.has(second?.id ?? -1), layout.currentGroup().id]).toEqual([frames, true, true, second?.id]);
    await runAsync("desktop.focusPreviousGroup");
    await runAsync("desktop.focusNextGroup");
    expect(layout.currentGroup().id).toBe(second?.id);
    layout.focusGroup(first?.id ?? -1);
    await runAsync("desktop.moveTabToNextGroup", tab(plan.key));
    expect([contents(), layout.layout().documents.id]).toEqual([[1, 2], second?.id]);
    await runAsync("desktop.moveTabToPreviousGroup", tab(plan.key));
    await runAsync("desktop.moveTabToPreviousGroup", tab(todo.key));
    expect(contents()).toEqual([3]);
    expect(names.map(t => enabled(t, t.includes("focus") ? null : tab(plan.key)))).toEqual([false, false, true, true]);
  });

  it("moves the focus to the next and previous region with F6 and Shift+F6, enabled only while a region has an element in the tab order", async () => {
    const region = document.body.appendChild(document.createElement("nol-status-bar"));
    const names = ["desktop.focusNextRegion", "desktop.focusPreviousRegion"];
    const keys = service.keys("linux").filter(t => names.includes(t[1])).map(([key, name]) => `${key.text} ${name}`);
    const before = names.map(t => enabled(t));
    const button = region.appendChild(document.createElement("button"));
    button.textContent = "Status";
    const after = names.map(t => enabled(t));
    await runAsync("desktop.focusPreviousRegion");
    const focused = document.activeElement;
    region.remove();

    expect(keys).toEqual(["F6 desktop.focusNextRegion", "Shift+F6 desktop.focusPreviousRegion"]);
    expect([before, after, focused]).toEqual([[false, false], [true, true], button]);
  });

  it("moves a view to the next or previous group, which may be a documents group, wrapping around every group", async () => {
    const groups = layout.layout().groups;
    const own = layout.layout().groupOf(search);
    const next = groups[(groups.findIndex(t => t.id === own?.id) + 1) % groups.length];

    await runAsync("desktop.moveTabToNextGroup", tab(search.key));

    expect(layout.layout().groupOf(search)?.id).toBe(next?.id);
    await runAsync("desktop.moveTabToPreviousGroup", tab(search.key));
    expect(layout.layout().groupOf(search)?.id).toBe(own?.id);
  });

  it("keys the most-used commands by the platform's conventions, each key once and each command one of its own", () => {
    const labels = (platform: string): string[][] => service.keys(platform).map(([key, name]) => [name, key.label(platform)]);
    const names = new Set(service.commands.map(t => t.name));

    expect(labels("win32")).toEqual([
      ["desktop.search", "Ctrl+K"], ["desktop.showCommands", "Ctrl+Shift+P"], ["desktop.goBack", "Alt+Left"], ["desktop.goForward", "Alt+Right"], ["desktop.openSettings", "Ctrl+,"], ["desktop.closeTab", "Ctrl+W"], ["desktop.nextTab", "Ctrl+Tab"], ["desktop.nextTab", "Ctrl+PageDown"],
      ["desktop.previousTab", "Ctrl+Shift+Tab"], ["desktop.previousTab", "Ctrl+PageUp"], ["desktop.toggleLeftDock", "Ctrl+B"], ["desktop.toggleBottomDock", "Ctrl+J"],
      ["desktop.toggleRightDock", "Ctrl+Alt+B"], ["desktop.focusNextRegion", "F6"], ["desktop.focusPreviousRegion", "Shift+F6"], ["desktop.showShortcuts", "Ctrl+/"]
    ]);
    expect(labels("darwin")).toEqual([
      ["desktop.search", "⌘K"], ["desktop.showCommands", "⇧⌘P"], ["desktop.goBack", "⌘["], ["desktop.goForward", "⌘]"], ["desktop.openSettings", "⌘,"], ["desktop.closeTab", "⌘W"], ["desktop.nextTab", "⌃⇥"], ["desktop.nextTab", "⌥⌘→"],
      ["desktop.previousTab", "⌃⇧⇥"], ["desktop.previousTab", "⌥⌘←"], ["desktop.toggleLeftDock", "⌘B"], ["desktop.toggleBottomDock", "⌘J"],
      ["desktop.toggleRightDock", "⌥⌘B"], ["desktop.focusNextRegion", "F6"], ["desktop.focusPreviousRegion", "⇧F6"], ["desktop.showShortcuts", "⌘/"]
    ]);
    for (const platform of ["linux", "darwin"]) {
      const keys = service.keys(platform);
      expect(keys.every(([key], index) => keys.findIndex(([other]) => other.isSameOn(key, platform)) === index)).toBe(true);
      expect(keys.every(([, name]) => names.has(name))).toBe(true);
    }
  });

  it("shows the next or previous tab of the current group, wrapping at either end, when the group has another", async () => {
    layout.activate(settings);
    await runAsync("desktop.nextTab");
    expect(layout.layout().documents.active).toEqual(plan);
    await runAsync("desktop.previousTab");
    expect(layout.layout().documents.active).toEqual(settings);
    await runAsync("desktop.previousTab", tab(plan.key));
    expect(layout.layout().documents.active).toEqual(settings);

    expect([enabled("desktop.nextTab", tab(changes.key)), enabled("desktop.previousTab", tab(files.key))]).toEqual([false, true]);
  });

  it("opens search with no filter, at the source it names, or at the commands alone with >, and refuses a source that isn't text", async () => {
    const open = vi.spyOn(TestBed.inject(SearchPaletteService), "open").mockImplementation(() => undefined);

    await runAsync("desktop.search");
    await runAsync("desktop.search", { source: "chat.chats" });
    expect(() => command("desktop.search").runAsync({ source: 3 })).toThrow("$.source: Expected a string.");
    await runAsync("desktop.showCommands");

    expect(open.mock.calls.map(([request]) => [request?.query, request?.source])).toEqual([[String.empty, null], [String.empty, "chat.chats"], [">", null]]);
  });

  it("shows or hides the toolbar it names, checked while shown, and is enabled only for a toolbar that exists", async () => {
    const toolbars = TestBed.inject(ToolbarService);
    const known = vi.spyOn(toolbars, "isKnown").mockImplementation(name => name === "notes.main");
    const shown = vi.spyOn(toolbars, "isShown").mockReturnValue(true);
    const setShown = vi.spyOn(toolbars, "setShown").mockImplementation(() => undefined);
    const main = { toolbar: "notes.main" };
    const missing = { toolbar: "notes.none" };

    expect([enabled("desktop.toggleToolbar", main), enabled("desktop.toggleToolbar", missing), enabled("desktop.toggleToolbar"), enabled("desktop.toggleToolbar", {})]).toEqual([true, false, false, false]);
    expect([checked("desktop.toggleToolbar", main), checked("desktop.toggleToolbar", missing), checked("desktop.toggleToolbar", null)]).toEqual([true, false, false]);
    await runAsync("desktop.toggleToolbar", main);
    expect(setShown).toHaveBeenLastCalledWith("notes.main", false);
    shown.mockReturnValue(false);
    await runAsync("desktop.toggleToolbar", main);
    expect(setShown).toHaveBeenLastCalledWith("notes.main", true);
    setShown.mockClear();
    await runAsync("desktop.toggleToolbar", missing);
    expect(setShown).not.toHaveBeenCalled();
    expect(known).toHaveBeenCalled();
  });

  it("moves the toolbar it names one step and returns the focus to its grip, enabled only where that step is possible, and hides it", async () => {
    const toolbars = TestBed.inject(ToolbarService);
    vi.spyOn(toolbars, "isKnown").mockImplementation(name => name === "notes.main");
    const canMove = vi.spyOn(toolbars, "canMove").mockImplementation((_, move) => move === ToolbarMove.Left);
    const moveBy = vi.spyOn(toolbars, "moveBy").mockImplementation(() => undefined);
    const setShown = vi.spyOn(toolbars, "setShown").mockImplementation(() => undefined);
    const main = { toolbar: "notes.main" };
    const missing = { toolbar: "notes.none" };
    const frame = document.createElement("div");
    frame.className = "nol-toolbar";
    frame.dataset["toolbar"] = "notes.main";
    const grip = document.createElement("button");
    grip.className = "nol-toolbar-grip";
    frame.append(grip);
    document.body.append(frame);

    expect(Object.values(ToolbarMove).map(t => enabled(`desktop.moveToolbar${t[0]?.toUpperCase()}${t.slice(1)}`, main))).toEqual([true, false, false, false]);
    expect([enabled("desktop.moveToolbarLeft", missing), enabled("desktop.moveToolbarLeft"), enabled("desktop.hideToolbar", main), enabled("desktop.hideToolbar", missing)]).toEqual([false, false, true, false]);
    await runAsync("desktop.moveToolbarLeft", main);
    await vi.waitFor(() => expect(document.activeElement).toBe(grip));
    expect(moveBy).toHaveBeenLastCalledWith("notes.main", ToolbarMove.Left);
    moveBy.mockClear();
    await runAsync("desktop.moveToolbarLeft", missing);
    expect(moveBy).not.toHaveBeenCalled();
    await runAsync("desktop.hideToolbar", main);
    expect(setShown).toHaveBeenLastCalledWith("notes.main", false);
    setShown.mockClear();
    await runAsync("desktop.hideToolbar", missing);
    expect(setShown).not.toHaveBeenCalled();
    frame.remove();
    await runAsync("desktop.moveToolbarLeft", main);
    expect(canMove).toHaveBeenCalled();
  });

  it("moves the focus to the next toolbar's grip, else the previous one's, else the search field, after hiding a toolbar", async () => {
    const toolbars = TestBed.inject(ToolbarService);
    vi.spyOn(toolbars, "isKnown").mockReturnValue(true);
    const frames = ["notes.first", "notes.second"].map(name => {
      const frame = document.createElement("div");
      frame.className = "nol-toolbar";
      frame.dataset["toolbar"] = name;
      const grip = document.createElement("button");
      grip.className = "nol-toolbar-grip";
      frame.append(grip);
      document.body.append(frame);
      return frame;
    });
    const search = document.createElement("button");
    search.className = "nol-window-row-search";
    document.body.append(search);
    vi.spyOn(toolbars, "setShown").mockImplementation(name => frames.find(t => t.dataset["toolbar"] === name)?.remove());

    await runAsync("desktop.hideToolbar", { toolbar: "notes.first" });
    await vi.waitFor(() => expect(document.activeElement).toBe(frames[1]?.querySelector("button")));
    await runAsync("desktop.hideToolbar", { toolbar: "notes.second" });
    await vi.waitFor(() => expect(document.activeElement).toBe(search));
    search.remove();
  });

  it("focuses the first toolbar item, and is enabled only while a toolbar is shown", async () => {
    const hasContent = vi.spyOn(TestBed.inject(ToolbarService), "hasContent");
    const item = document.createElement("button");
    item.className = "nol-toolbar-item";
    item.tabIndex = 0;
    document.body.append(item);

    expect(enabled("desktop.focusToolbars")).toBe(false);
    hasContent.mockReturnValue(true);
    expect(enabled("desktop.focusToolbars")).toBe(true);
    await runAsync("desktop.focusToolbars");
    expect(document.activeElement).toBe(item);
    item.remove();
    await runAsync("desktop.focusToolbars");
  });

  it("shows and hides each dock and resets the layout", async () => {
    await runAsync("desktop.toggleLeftDock");
    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(true);
    await runAsync("desktop.toggleBottomDock");
    await runAsync("desktop.toggleRightDock");
    expect([DockSide.Right, DockSide.Bottom].map(t => layout.layout().dock(t).isCollapsed)).toEqual([true, true]);

    await runAsync("desktop.resetLayout");
    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(false);
  });

  it("checks a side dock's command only while the dock shows, and opens a dock the narrow window closed instead of hiding it", async () => {
    const shown = (): boolean[] => ["desktop.toggleLeftDock", "desktop.toggleRightDock"].map(t => checked(t, null));
    layout.setViewport(120, 60);
    const wide = shown();

    layout.setViewport(40, 40);
    const narrow = shown();
    await runAsync("desktop.toggleRightDock");

    expect([wide, narrow]).toEqual([[true, true], [false, false]]);
    expect(shown()).toEqual([false, true]);
    expect(layout.layout().dock(DockSide.Right).isExpanded).toBe(true);
  });

  it("checks the bottom dock's command only while the dock shows, and opens a bottom dock the short window closed at what the document's minimum leaves", async () => {
    layout.openView(LayoutFixture.terminal);
    layout.setViewport(120, 60);
    const tall = checked("desktop.toggleBottomDock", null);
    layout.setViewport(120, 21.25);
    const short = checked("desktop.toggleBottomDock", null);

    await runAsync("desktop.toggleBottomDock");

    expect([tall, short, checked("desktop.toggleBottomDock", null)]).toEqual([true, false, true]);
    expect([layout.layout().dock(DockSide.Bottom).isExpanded, layout.geometry().dock(DockSide.Bottom).height]).toEqual([true, 7]);
  });

  it("goes back and forward over the documents shown, enabled only while there is a document that way", async () => {
    TestBed.tick();
    layout.activate(plan);
    TestBed.tick();
    const first = [enabled("desktop.goBack"), enabled("desktop.goForward")];

    await runAsync("desktop.goBack");
    const back = [layout.layout().documents.active?.key, enabled("desktop.goBack"), enabled("desktop.goForward")];
    await runAsync("desktop.goForward");

    expect(first).toEqual([true, false]);
    expect(back).toEqual([settings.key, false, true]);
    expect(layout.layout().documents.active?.key).toBe(plan.key);
  });

  it("shows a closed view in its dock and closes an open one, checked while it is open and doing nothing for a view the window doesn't list or a view with instances", async () => {
    layout.setRegistry(new ViewRegistry([...registry.views, new ViewType("terminal.session", DockSide.Bottom, false, true)], ["notes.note", "desktop.settings"]));
    const view = (name: string): JsonValue => ({ view: name });
    const states = (name: string): boolean[] => [enabled("desktop.toggleView", view(name)), checked("desktop.toggleView", view(name))];
    const invalid = [null, {}, { view: String.empty }, { view: "notes.note" }, { view: "missing.view" }, { view: "terminal.session" }].flatMap(t => [enabled("desktop.toggleView", t), checked("desktop.toggleView", t)]);
    const before = layout.layout();
    await runAsync("desktop.toggleView", { view: "missing.view" });
    const isUnchanged = layout.layout() === before;
    const open = states(changes.name);

    await runAsync("desktop.toggleView", view(changes.name));
    const closed = [layout.layout().isOpen(changes), ...states(changes.name)];
    await runAsync("desktop.toggleView", view(changes.name));

    expect(invalid).toEqual([false, false, false, false, false, false, false, false, false, false, false, false]);
    expect(isUnchanged).toBe(true);
    expect([open, closed]).toEqual([[true, true], [false, true, false]]);
    expect([layout.layout().isOpen(changes), layout.layout().groupOf(changes)?.active?.key, layout.layout().sideOf(layout.layout().groupOf(changes)?.id ?? -1)])
      .toEqual([true, changes.key, DockSide.Right]);
  });

  it("opens the dock of a view it shows even when the narrow window closed that dock", async () => {
    await runAsync("desktop.toggleView", { view: search.name });
    layout.setViewport(40, 40);
    const narrow = checked("desktop.toggleLeftDock", null);

    await runAsync("desktop.toggleView", { view: search.name });

    expect([narrow, checked("desktop.toggleLeftDock", null), layout.layout().groupOf(search)?.active?.key]).toEqual([false, true, search.key]);
  });

  it("keeps the bottom dock between the side docks or spans it across the window, both always enabled and the current one changing nothing", async () => {
    const enabled = (): boolean[] => ["desktop.spanBottomDock", "desktop.fitBottomDockBetween"].map(t => command(t).isEnabled(null));
    const initial = layout.layout();

    await runAsync("desktop.spanBottomDock");
    expect(layout.layout()).toBe(initial);
    await runAsync("desktop.fitBottomDockBetween");
    expect([layout.layout().bottomSpan, ...enabled()]).toEqual([BottomDockSpan.Between, true, true]);
    await runAsync("desktop.spanBottomDock");

    expect(layout.layout().bottomSpan).toBe(BottomDockSpan.Full);
  });

  it("shows all tabs of a group whose tabs overflow, the current group by default", async () => {
    const strips = TestBed.inject(TabStripService);
    const documents = layout.layout().documents.id;
    expect(enabled("desktop.showAllTabs")).toBe(false);
    await runAsync("desktop.showAllTabs");
    expect(layout.layout().groups.map(t => strips.takeListRequest(t.id))).not.toContain(true);
    strips.setOverflowing(documents, true);
    expect(enabled("desktop.showAllTabs", tab("document/notes.note/gone"))).toBe(false);
    layout.focusGroup(documents);

    expect([enabled("desktop.showAllTabs"), enabled("desktop.showAllTabs", tab(files.key))]).toEqual([true, false]);
    await runAsync("desktop.showAllTabs");
    expect(strips.takeListRequest(documents)).toBe(true);
  });
});
