/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, ElementRef, ErrorHandler, type Injector, type Type, afterNextRender, inject } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { ModuleState, type ModuleStatus, NotificationPost, NotificationSeverity, QualifiedName, type SettingOption, SettingScope, WebViewPane } from "@noldova/desktop.protocol";
import { FileNotOpenedException as ExportedFileNotOpenedException, FileNotShownException as ExportedFileNotShownException } from "@noldova/desktop.window";
import { LinkGesture } from "@noldova/ui.components.angular";

import { ModulesComponent } from "../../../src/app/components/modules/modules.component";
import { SettingsComponent } from "../../../src/app/components/settings/settings.component";
import { ContentPadding } from "../../../src/app/enums/content-padding";
import { DockSide } from "../../../src/app/enums/dock-side";
import { LinkPlace } from "../../../src/app/enums/link-place";
import { FileSaveOutcome } from "../../../src/app/enums/file-save-outcome";
import { FileNotOpenedException } from "../../../src/app/exceptions/file-not-opened.exception";
import { FileNotShownException } from "../../../src/app/exceptions/file-not-shown.exception";
import { LinkNotOpenedException } from "../../../src/app/exceptions/link-not-opened.exception";
import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { WebViewNotOpenedException } from "../../../src/app/exceptions/web-view-not-opened.exception";
import { WindowPartFailureException } from "../../../src/app/exceptions/window-part-failure.exception";
import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import type { IWindowPartContext } from "../../../src/app/interfaces/i-window-part-context";
import { BuildTokens } from "../../../src/app/models/build-tokens";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { DocumentContribution } from "../../../src/app/models/document-contribution";
import { PlaceholderContribution } from "../../../src/app/models/placeholder-contribution";
import { SearchAnswer } from "../../../src/app/models/search-answer";
import { SearchSourceContribution } from "../../../src/app/models/search-source-contribution";
import { SettingsPageContribution } from "../../../src/app/models/settings-page-contribution";
import { DocumentHeading } from "../../../src/app/models/document-heading";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { SideDropTarget } from "../../../src/app/models/layout/side-drop-target";
import { TabDropTarget } from "../../../src/app/models/layout/tab-drop-target";
import { TabLabel } from "../../../src/app/models/layout/tab-label";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../src/app/models/layout/view-type";
import type { MenuItem } from "../../../src/app/models/menu-item";
import type { NotificationHandle } from "../../../src/app/models/notification-handle";
import { ShellDocuments } from "../../../src/app/models/shell-documents";
import { StatusBarItemContribution } from "../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";
import { TopBarActionContribution } from "../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";
import { ViewBadge } from "../../../src/app/models/view-badge";
import { ViewContribution } from "../../../src/app/models/view-contribution";
import type { WindowPartContext } from "../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";
import { BarItemsService } from "../../../src/app/services/bar-items.service";
import { CommandService } from "../../../src/app/services/command.service";
import { DockGrowthService } from "../../../src/app/services/dock-growth.service";
import { DocumentHistoryService } from "../../../src/app/services/document-history.service";
import { DocumentOpenerService } from "../../../src/app/services/document-opener.service";
import { EditTargetService } from "../../../src/app/services/edit-target.service";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { LinkService } from "../../../src/app/services/link.service";
import { LiveViewService } from "../../../src/app/services/live-view.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { ModuleStatusService } from "../../../src/app/services/module-status.service";
import { SettingCheckService } from "../../../src/app/services/setting-check.service";
import { SettingOptionsService } from "../../../src/app/services/setting-options.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { TabRenameService } from "../../../src/app/services/tab-rename.service";
import { ViewDialogService } from "../../../src/app/services/view-dialog.service";
import { SettingsService } from "../../../src/app/services/settings.service";
import { WebViewService } from "../../../src/app/services/web-view.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { FailureFixture } from "../../fixtures/failure.fixture";
import { LayoutMetricsFixture } from "../../fixtures/layout-metrics.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { WindowPartFixture } from "../../fixtures/window-part.fixture";
import { DomFixture } from "../../fixtures/dom.fixture";

@Component({ selector: "nol-test-content", template: "" })
class ContentComponent {
}

@Component({ selector: "nol-test-palette", template: "" })
class PaletteComponent {
  public readonly context = inject(WindowPartTokens.context);
  public readonly padding = inject(WindowPartTokens.contentPadding);
  public readonly shown = inject(WindowPartTokens.shown);
  public readonly activeDocument = inject(WindowPartTokens.activeDocument);
}

@Component({ template: "<input class=\"palette-field\" aria-label=\"Find\" />" })
class FocusingPaletteComponent {
  public constructor() {
    const host: HTMLElement = DomFixture.host(inject(ElementRef));
    afterNextRender(() => host.querySelector("input")?.focus());
  }
}

describe("WindowPartHostService", () => {
  const load = (): Promise<Type<unknown>> => Promise.resolve(ContentComponent);
  const status = (id: string, state: ModuleState = ModuleState.Active, cause: string | null = null, dependencies: readonly string[] = []): object => ({
    id, version: "0.0.1", displayName: `${id[0]?.toUpperCase()}${id.slice(1)}`, description: "Used by the tests.", dependencies, contributes: {}, state, ...(Object.isNull(cause) ? {} : { cause })
  });
  const source = (
    moduleId: string,
    part: IWindowPart | Error,
    dependencies: readonly string[] = [],
    views: readonly string[] = [`${moduleId}.list`],
    commands: readonly string[] = [],
    statusBarItems: readonly string[] = [],
    topBarActions: readonly string[] = [],
    notifications: readonly string[] = [],
    documents: readonly string[] = [`${moduleId}.note`]): WindowPartSource =>
    new WindowPartSource(moduleId, dependencies, views, documents, commands, statusBarItems, topBarActions, notifications,
      () => part instanceof Error ? Promise.reject(part) : Promise.resolve(part));
  const notesPart = (log: string[]): WindowPartFixture => new WindowPartFixture("notes", log, t => {
    t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
    t.registerDocument(new DocumentContribution("notes.note", load, undefined, { tabRowPlace: "notes.tabRow" }));
    t.openDocument("notes.note", "1", "Note 1");
  });
  const placeholderPart = (padding?: ContentPadding): WindowPartFixture => new WindowPartFixture("notes", log, t => {
    t.registerPlaceholder(new PlaceholderContribution("notes.start", load, padding));
    t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
  });
  const placeholderSource = (part: IWindowPart): WindowPartSource =>
    new WindowPartSource("notes", [], ["notes.list"], [], [], [], [], [], () => Promise.resolve(part), ["notes.start"]);
  const pagesSource = (moduleId: string, part: IWindowPart | Error, pages: readonly string[]): WindowPartSource =>
    new WindowPartSource(moduleId, [], [`${moduleId}.list`], [], [], [], [], [], () => part instanceof Error ? Promise.reject(part) : Promise.resolve(part), [], [],
      pages.map(t => ({ name: `${moduleId}.${t}`, title: `${t[0]?.toUpperCase()}${t.slice(1)}` })));
  const listedPages = (): readonly (readonly (string | null)[])[] =>
    TestBed.inject(WindowPartHostService).settingsPages().map(t => [t.name, t.title, t.moduleId, t.page?.name ?? null, t.context?.moduleId ?? null, t.failure?.cause ?? null]);
  const clockPart = (log: string[]): WindowPartFixture =>
    new WindowPartFixture("clock", log, t => t.registerView(new ViewContribution("clock.list", "Clock", "schedule", DockSide.Right, true, load)));
  let bridge: PreloadBridgeFixture;
  let errors: unknown[];
  let log: string[];

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
    errors = [];
    log = [];
  });

  afterEach(() => PreloadBridgeFixture.remove());

  function start(sources: readonly WindowPartSource[], modules: readonly object[]): { host: WindowPartHostService; layout: LayoutService; loads: string[] } {
    bridge.responses.set("desktop.modules", { payload: { modules } });
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: BuildTokens.sources, useValue: sources }
      ]
    });
    const layout = TestBed.inject(LayoutService);
    const loads: string[] = [];
    const loadAsync = layout.loadAsync.bind(layout);
    vi.spyOn(layout, "loadAsync").mockImplementation(async () => {
      loads.push(layout.registry().views.map(t => t.name).join(","));
      return loadAsync();
    });
    return { host: TestBed.inject(WindowPartHostService), layout, loads };
  }

  async function startWithPalette(): Promise<{ context: WindowPartContext; row: HTMLElement; button: HTMLButtonElement }> {
    const row = document.body.appendChild(document.createElement("nol-window-row"));
    Object.assign(row.style, { position: "fixed", top: "0", left: "0", right: "0", height: "2rem", display: "block" });
    const button = document.body.appendChild(document.createElement("button"));
    const { host } = start([source("notes", notesPart(log))], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const context = host.findContribution(new ViewTab("notes.list"))?.context;
    if (Object.isNullOrUndefined(context))
      throw new Error("The notes part has no context.");
    return { context, row, button };
  }

  function holdRead(): { read: ReturnType<typeof vi.spyOn>; release: (outcome: JsonValue | null | Error) => void } {
    let settle: (outcome: JsonValue | null | Error) => void = () => undefined;
    const held = new Promise<JsonValue | null>((resolve, reject) => {
      settle = t => t instanceof Error ? reject(t) : resolve(t);
    });
    const read = vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockReturnValueOnce(held);
    return { read, release: settle };
  }

  it("asks the runtime for its modules once it is ready and loads the layout even with none", async () => {
    const { host, layout, loads } = start([], []);

    await vi.waitFor(() => expect(loads).toEqual([String.empty]));

    expect(bridge.requests).toEqual([["desktop.settings", {}], ["desktop.modules", null], ["desktop.commands", null]]);
    expect([TestBed.inject(ModuleStatusService).modules(), host.failures()]).toEqual([[], []]);
    expect(host.generation()).toBe(1);
    expect(layout.layout().documents.tabs).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("registers the shell's Settings and Modules documents before any module's, finds them without a part's context and labels them", async () => {
    const { host, layout, loads } = start([], []);
    await vi.waitFor(() => expect(loads).toEqual([String.empty]));
    const labels = TestBed.inject(TabLabelService);

    const settings = host.findContribution(new DocumentTab("desktop.settings"));
    const modules = host.findContribution(new DocumentTab("desktop.modules"));

    expect(["desktop.settings", "desktop.modules"].map(t => layout.registry().hasDocument(t))).toEqual([true, true]);
    expect([settings?.context, await settings?.loadComponent(), modules?.context, await modules?.loadComponent()]).toEqual([null, SettingsComponent, null, ModulesComponent]);
    expect(["desktop.settings", "desktop.modules"].map(t => labels.of(new DocumentTab(t))).map(t => [t.title, t.icon])).toEqual([["Settings", "settings"], ["Modules", "extension"]]);
  });

  it("lists the save steps of the active parts that registered any, by module", async () => {
    const save = (): Promise<void> => Promise.resolve();
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerSave(save);
    });
    const { host } = start([source("notes", notes), source("clock", clockPart(log))], [status("notes"), status("clock")]);

    await vi.waitFor(() => expect(log).toEqual(["activate notes", "activate clock"]));

    await vi.waitFor(() => expect([...host.listSaves()]).toEqual([["notes", [save]]]));
  });

  it("reads, sets, resets and follows settings through the settings service", async () => {
    bridge.responses.set("desktop.settings", { payload: { definitions: [], entries: [] } });
    const { host, loads } = start([], []);
    const settings = TestBed.inject(SettingsService);
    const heard: string[] = [];
    await vi.waitFor(() => expect(loads).toEqual([String.empty]));
    const stop = host.onSettingChanged(t => heard.push(t.key.name.text));

    bridge.responses.set("desktop.readSetting", { payload: { name: "desktop.mode", value: "Dark", isSet: false } });
    const entry = await host.readSettingAsync("desktop.mode", new SettingScope(QualifiedName.parse("notes.note"), "n1"));
    await host.writeSettingAsync("desktop.mode", "Dark", null);
    await host.resetSettingAsync("desktop.mode", null);
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.mode", value: "Dark", isSet: true });
    stop();
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.mode", value: "Light", isSet: true });

    expect([host.readSetting("desktop.mode"), settings.read("desktop.mode")]).toEqual(["Light", "Light"]);
    expect(heard).toEqual(["desktop.mode"]);
    expect([entry.name.text, entry.value, entry.isSet]).toEqual(["desktop.mode", "Dark", false]);
    expect(bridge.requests.slice(-3)).toEqual([
      ["desktop.readSetting", { name: "desktop.mode", scope: { name: "notes.note", id: "n1" } }],
      ["desktop.setSetting", { name: "desktop.mode", value: "Dark" }],
      ["desktop.resetSetting", { name: "desktop.mode" }]
    ]);
  });

  it("activates the active modules' window parts before loading the layout and finds their contributions", async () => {

    const { host, layout, loads } = start([source("notes", notesPart(log), ["tasks"])], [status("tasks"), status("notes", ModuleState.Active, null, ["tasks"])]);
    const labels = TestBed.inject(TabLabelService);

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]));

    expect(log).toEqual(["activate notes"]);
    expect(loads).toEqual(["notes.list"]);
    expect(layout.registry().view("notes.list")).toEqual(new ViewType("notes.list", DockSide.Left, true));
    expect(layout.registry().hasDocument("notes.note")).toBe(true);
    expect(layout.registry().documentTabRowPlace("notes.note")).toBe("notes.tabRow");
    expect(labels.of(new ViewTab("notes.list")).title).toBe("Notes");
    expect(labels.of(new DocumentTab("notes.note", "1")).title).toBe("Note 1");
    expect(host.findContribution(new ViewTab("notes.list"))?.context?.moduleId).toBe("notes");
    expect(await host.findContribution(new DocumentTab("notes.note", "2"))?.loadComponent()).toBe(ContentComponent);
    expect(host.findContribution(new ViewTab("notes.outline"))).toBeNull();
    expect(host.findFailure(new ViewTab("notes.list"))).toBeNull();
    expect(errors).toEqual([]);
  });

  it("keeps the look a part gives a document's tab as it opens, and merges the part's updates into it", async () => {
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1", { underline: "Shared", image: "data:image/png;base64,AA==" });
      t.updateDocument("notes.note", "1", { status: { glyph: "error", description: "Gone" }, image: null });
    });
    const { layout } = start([source("notes", notes)], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]));

    const look = labels.lookOf(new DocumentTab("notes.note", "1"));
    expect([look.underline, look.status?.description, look.image]).toEqual(["Shared", "Gone", null]);
  });

  it("keeps an open document's look when the part opens it again, changing only the look the options give", async () => {
    const parts: IWindowPartContext[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1", { underline: "Shared" });
      t.updateDocument("notes.note", "1", { status: { glyph: "error", description: "Gone" }, marker: { glyph: "lock", label: "Locked" } });
      parts.push(t);
    });
    const { layout } = start([source("notes", notes)], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    const tab = new DocumentTab("notes.note", "1");
    const read = (): readonly (string | null)[] => [labels.lookOf(tab).underline, labels.lookOf(tab).status?.description ?? null, labels.lookOf(tab).marker?.label ?? null];
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([tab]));
    const opened = read();

    parts.forEach(t => t.openDocument("notes.note", "1", "Note 1"));
    const reopened = read();
    parts.forEach(t => t.openDocument("notes.note", "1", "Note 1", { underline: "Draft", breadcrumb: ["Notes"] }));

    expect([opened, reopened, read()]).toEqual([["Shared", "Gone", "Locked"], ["Shared", "Gone", "Locked"], ["Draft", "Gone", "Locked"]]);
  });

  it("keeps the look of a document the part opens again while it first activates", async () => {
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1", { marker: { glyph: "link", label: "From a link" } });
      t.updateDocument("notes.note", "1", { underline: "Shared" });
      t.openDocument("notes.note", "1", "Note 1");
    });
    const { layout } = start([source("notes", notes)], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    const tab = new DocumentTab("notes.note", "1");

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([tab]));

    expect([labels.lookOf(tab).marker?.label ?? null, labels.lookOf(tab).underline]).toEqual(["From a link", "Shared"]);
  });

  it("opens a document that a newer preview replaced with only the look its options give", async () => {
    const parts: IWindowPartContext[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1", { preview: true, underline: "Shared" });
      parts.push(t);
    });
    const { layout } = start([source("notes", notes)], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    const first = new DocumentTab("notes.note", "1");
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([first]));
    const opened = labels.lookOf(first).underline;

    parts.forEach(t => t.openDocument("notes.note", "2", "Note 2", { preview: true }));
    const replaced = layout.layout().documents.tabs;
    parts.forEach(t => t.openDocument("notes.note", "1", "Note 1"));

    expect([opened, replaced, labels.lookOf(first).underline]).toEqual(["Shared", [new DocumentTab("notes.note", "2")], null]);
  });

  it("drops a document's look when the part closes it and the looks of a module that no longer activates", async () => {
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1", { underline: "Shared" });
      if (log.filter(u => u === "activate notes").length === 1)
        t.openDocument("notes.note", "2", "Note 2", { underline: "Draft" });
    });
    const clock = new WindowPartFixture("clock", log, t => {
      t.registerDocument(new DocumentContribution("clock.note", load));
      t.openDocument("clock.note", "1", "Alarm", { underline: "Ringing" });
    });
    const { host, layout } = start([source("notes", notes), source("clock", clock)], [status("clock"), status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    const underlines = (): readonly (string | null)[] => [new DocumentTab("notes.note", "1"), new DocumentTab("notes.note", "2"), new DocumentTab("clock.note", "1")].map(t => labels.lookOf(t).underline);
    await vi.waitFor(() => expect([host.generation(), layout.layout().documents.tabs.length]).toEqual([1, 3]));
    const opened = underlines();

    host.closeDocument("notes", "notes.note", "2");
    const closed = underlines();
    bridge.responses.set("desktop.modules", { payload: { modules: [status("clock", ModuleState.Failed, "It broke."), status("notes")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect([opened, closed, underlines()]).toEqual([["Shared", "Draft", "Ringing"], ["Shared", null, "Ringing"], ["Shared", null, null]]);
  });

  it("pads each contribution as it declares, else as its module chose, else as the shell does, and lays out Settings and Modules edge to edge", async () => {
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load, ContentPadding.Default));
      t.registerDocument(new DocumentContribution("notes.note", load));
    });
    notes.padding = ContentPadding.None;
    const { host, loads } = start([source("notes", notes), source("clock", clockPart(log))], [status("notes"), status("clock")]);
    await vi.waitFor(() => expect(loads).toHaveLength(1));

    expect([new ViewTab("notes.list"), new DocumentTab("notes.note", "1"), new ViewTab("clock.list"), ShellDocuments.settingsTab, ShellDocuments.modulesTab].map(t => host.findContribution(t)?.padding))
      .toEqual([ContentPadding.Default, ContentPadding.None, ContentPadding.Default, ContentPadding.None, ContentPadding.None]);
  });

  it("finds the placeholder a part registers, padded as its module chose unless it declares a padding, and keeps it across refreshes", async () => {
    const notes = placeholderPart();
    notes.padding = ContentPadding.None;
    const { host, loads } = start([placeholderSource(notes), source("clock", clockPart(log))], [status("notes"), status("clock")]);
    const before = [host.placeholder(), host.findPlaceholderName()];
    await vi.waitFor(() => expect(loads).toHaveLength(1));
    const found = host.placeholder();
    host.refresh();

    expect(before).toEqual([null, null]);
    expect([found?.context?.moduleId, found?.padding, await found?.loadComponent(), host.findPlaceholderName()]).toEqual(["notes", ContentPadding.None, ContentComponent, "notes.start"]);
    expect(host.placeholder()).toBe(found);
  });

  it("pads a placeholder as it declares, over its module's choice", async () => {
    const notes = placeholderPart(ContentPadding.Default);
    notes.padding = ContentPadding.None;
    const { host, loads } = start([placeholderSource(notes)], [status("notes")]);
    await vi.waitFor(() => expect(loads).toHaveLength(1));

    expect(host.placeholder()?.padding).toBe(ContentPadding.Default);
  });

  it("drops the placeholder of a part that fails to activate", async () => {
    const failing = new WindowPartFixture("notes", log, t => {
      t.registerPlaceholder(new PlaceholderContribution("notes.start", load));
      throw new Error("The start page broke.");
    });
    const { host } = start([placeholderSource(failing)], [status("notes")]);
    await vi.waitFor(() => expect(host.failures()).toHaveLength(1));

    expect([host.placeholder(), host.findPlaceholderName()]).toEqual([null, null]);
  });

  it("lists the parts' search sources in module order, each module's in the order it registered them", async () => {
    const searchSource = (name: string): SearchSourceContribution =>
      new SearchSourceContribution(name, "Items", "items", "Items", null, "search", () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([])));
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerSearchSource(searchSource("notes.notes"));
      t.registerSearchSource(searchSource("notes.tags"));
    });
    const clock = new WindowPartFixture("clock", log, t => t.registerSearchSource(searchSource("clock.alarms")));
    const { host } = start([source("clock", clock), source("notes", notes)], [status("notes"), status("clock")]);
    await vi.waitFor(() => expect(host.searchSources()).toHaveLength(3));

    expect(host.searchSources().map(t => t.name)).toEqual(["notes.notes", "notes.tags", "clock.alarms"]);
  });

  it("lists the settings pages the modules declare in module order, each loading until its part registers it, leaves out one an active part never registered, and keeps the entries across refreshes", async () => {
    const seen: (readonly (readonly (string | null)[])[])[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
      seen.push(listedPages());
      t.registerSettingsPage(new SettingsPageContribution("notes.sync", load));
      seen.push(listedPages());
    });
    const clock = new WindowPartFixture("clock", log, t => t.registerSettingsPage(new SettingsPageContribution("clock.alarms", load)));
    const { host } = start([pagesSource("notes", notes, ["sync", "sharing"]), pagesSource("clock", clock, ["alarms"])], [status("notes"), status("clock")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const entries = host.settingsPages();
    host.refresh();

    expect(seen).toEqual([
      [["notes.sync", "Sync", "notes", null, "notes", null], ["notes.sharing", "Sharing", "notes", null, "notes", null], ["clock.alarms", "Alarms", "clock", null, null, null]],
      [["notes.sync", "Sync", "notes", "notes.sync", "notes", null], ["notes.sharing", "Sharing", "notes", null, "notes", null], ["clock.alarms", "Alarms", "clock", null, null, null]]
    ]);
    expect(listedPages()).toEqual([["notes.sync", "Sync", "notes", "notes.sync", "notes", null], ["clock.alarms", "Alarms", "clock", "clock.alarms", "clock", null]]);
    expect([host.settingsPages(), await host.settingsPages()[0]?.page?.loadComponent()]).toEqual([entries, ContentComponent]);
    expect(host.settingsPages()[0]).toBe(entries[0]);
  });

  it("lists a failed module's settings pages with its failure, and leaves out those of a module turned off, unavailable or blocked by one", async () => {
    const failing = new WindowPartFixture("notes", log, t => {
      t.registerSettingsPage(new SettingsPageContribution("notes.sync", load));
      throw new Error("The sync page broke.");
    });
    const { host } = start([
      pagesSource("notes", failing, ["sync"]),
      pagesSource("radio", new WindowPartFixture("radio", log), ["tuning"]),
      pagesSource("clock", new WindowPartFixture("clock", log), ["alarms"]),
      pagesSource("shade", new WindowPartFixture("shade", log), ["blinds"]),
      pagesSource("bell", new WindowPartFixture("bell", log), ["chimes"])
    ], [
      status("notes"),
      status("radio", ModuleState.Failed, "Its runtime part failed to activate."),
      { ...status("clock", ModuleState.Off), switchSetting: "clock.enabled" },
      status("shade", ModuleState.Unavailable, "It doesn't run on Linux."),
      { ...status("bell", ModuleState.Blocked, "It depends on clock, which is off.", ["clock"]), blockedBy: "clock" }
    ]);
    await vi.waitFor(() => expect(host.failures()).toHaveLength(2));

    expect(listedPages()).toEqual([
      ["notes.sync", "Sync", "notes", null, null, "Its window part failed to activate."],
      ["radio.tuning", "Tuning", "radio", null, null, "Its runtime part failed to activate."]
    ]);
  });

  it("names the reported modules while their window parts activate and lists them for the Modules document once activation ends", async () => {
    let during: readonly unknown[] = [];
    const part = new WindowPartFixture("notes", log, () => {
      const statuses = TestBed.inject(ModuleStatusService);
      during = [statuses.nameOf("tasks"), statuses.nameOf("notes"), statuses.modules()];
    });
    const { loads } = start([source("notes", part)], [status("tasks"), status("notes")]);

    await vi.waitFor(() => expect(loads).toHaveLength(1));

    expect(log).toEqual(["activate notes"]);
    expect(during).toEqual(["Tasks", "Notes", []]);
    expect(TestBed.inject(ModuleStatusService).modules().map(t => t.id)).toEqual(["tasks", "notes"]);
  });

  it("keeps a failed module's views in their saved places with its name and an error icon, and finds its failure", async () => {

    const { host, layout } = start(
      [source("clock", new Error("unused"), [], ["clock.face"])],
      [status("clock", ModuleState.Failed, "Its runtime part failed to activate."), status("weather", ModuleState.Failed, "Its runtime part failed to activate.")]);
    void TestBed.inject(LayoutStoreService).writeAsync(Layout.createDefault(new ViewRegistry([new ViewType("clock.face", DockSide.Right, true)], [])).toJson());
    const labels = TestBed.inject(TabLabelService);
    const face = new ViewTab("clock.face");

    await vi.waitFor(() => expect(host.failures().length).toBe(2));
    await vi.waitFor(() => expect(layout.layout().groupOf(face)).not.toBeNull());

    expect(host.failures().map(t => [t.moduleId, t.displayName, t.state, t.cause, t.viewNames])).toEqual([
      ["clock", "Clock", ModuleState.Failed, "Its runtime part failed to activate.", ["clock.face"]],
      ["weather", "Weather", ModuleState.Failed, "Its runtime part failed to activate.", []]
    ]);
    expect(layout.layout().sideOf(layout.layout().groupOf(face)?.id ?? -1)).toBe(DockSide.Right);
    expect(layout.registry().view("clock.face")).toEqual(new ViewType("clock.face", DockSide.Left, false));
    expect([labels.of(face).title, labels.of(face).icon]).toEqual(["Clock", "error"]);
    expect(host.findFailure(face)?.moduleId).toBe("clock");
    expect(host.findFailure(new DocumentTab("clock.page", "1"))).toBeNull();
    expect(host.findContribution(face)).toBeNull();
    expect(log).toEqual([]);
  });

  it("reports a window part that cannot load or activate as failed, withdraws what it registered and blocks its dependents", async () => {
    const failing = new WindowPartFixture("clock", log, t => {
      t.registerView(new ViewContribution("clock.face", "Clock", "schedule", DockSide.Right, true, load));
      throw new Error("The clock broke.");
    });
    const { host, layout } = start(
      [source("tasks", new Error("No chunk.")), source("clock", failing, [], ["clock.face"]), source("notes", notesPart(log), ["clock"]), source("weather", notesPart(log), ["tasks"])],
      [status("tasks"), status("clock"), status("notes", ModuleState.Active, null, ["clock"]), status("weather", ModuleState.Active, null, ["tasks"]), status("alarm")]);

    await vi.waitFor(() => expect(host.failures().length).toBe(4));

    expect(TestBed.inject(ModuleStatusService).modules().map(t => [t.id, t.state, t.blockedBy, t.description])).toEqual([
      ["tasks", ModuleState.Failed, null, "Used by the tests."],
      ["clock", ModuleState.Failed, null, "Used by the tests."],
      ["notes", ModuleState.Blocked, "clock", "Used by the tests."],
      ["weather", ModuleState.Blocked, "tasks", "Used by the tests."],
      ["alarm", ModuleState.Active, null, "Used by the tests."]
    ]);
    expect(host.failures().map(t => [t.moduleId, t.state, t.cause])).toEqual([
      ["tasks", ModuleState.Failed, "Its window part could not be loaded."],
      ["clock", ModuleState.Failed, "Its window part failed to activate."],
      ["notes", ModuleState.Blocked, "It depends on clock, which is not active."],
      ["weather", ModuleState.Blocked, "It depends on tasks, which is not active."]
    ]);
    expect(log).toEqual(["activate clock"]);
    expect(host.findContribution(new ViewTab("clock.face"))).toBeNull();
    expect(layout.registry().view("clock.face").isShownByDefault).toBe(false);
    expect(errors.map(t => [(t instanceof WindowPartFailureException ? t.moduleId : null), FailureFixture.of(t, Error).message, FailureFixture.of(FailureFixture.of(t, Error).cause, Error).message])).toEqual([
      ["tasks", "Its window part could not be loaded.", "No chunk."],
      ["clock", "Its window part failed to activate.", "The clock broke."]
    ]);
  });

  it("posts and dismisses notifications through the runtime and reports a dismissal that fails", async () => {
    const post = new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null);
    bridge.responses.set("desktop.postNotification", { payload: { id: "n4" } });
    bridge.responses.set("desktop.dismissNotification", { failure: { code: "Unavailable", message: "The runtime did not answer desktop.dismissNotification in time." } });
    const { host } = start([], []);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    const id = await host.postNotificationAsync(post);
    host.dismissNotification(id);
    await vi.waitFor(() => expect(errors.length).toBe(1));

    expect(id).toBe("n4");
    expect(bridge.requests.slice(-2).map(t => [t[0], JSON.stringify(t[1])])).toEqual([
      ["desktop.postNotification", JSON.stringify(post.toJson())],
      ["desktop.dismissNotification", JSON.stringify({ id: "n4" })]
    ]);
    expect(FailureFixture.of(errors[0], Error).message).toContain("did not answer");
  });

  it("advances its generation only once every post its parts made while activating is answered, even one not awaited or refused", async () => {
    let answer: (value: unknown) => void = () => undefined;
    bridge.responses.set("desktop.postNotification", new Promise(resolve => {
      answer = resolve;
    }));
    const refusals: unknown[] = [];
    const post = new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null);
    const notes = new WindowPartFixture("notes", log, t => {
      t.postNotificationAsync(post).catch((error: unknown) => refusals.push(error));
    });
    const { host, loads } = start([source("notes", notes, [], [], [], [], [], ["notes.saved"])], [status("notes")]);
    await vi.waitFor(() => expect(bridge.requests.some(t => t[0] === "desktop.postNotification")).toBe(true));
    await Promise.resolve();
    const waiting = [host.generation(), loads.length];

    answer({ failure: { code: "Refused", message: "The kind is not declared." } });
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(waiting).toEqual([0, 0]);
    expect(FailureFixture.of(refusals[0], Error).message).toContain("The kind is not declared.");
    expect(errors).toEqual([]);
  });

  it("lists Noldova Desktop's runtime commands first, then the runtime's and the window parts' commands in module order, and runs both", async () => {
    const runs: string[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerCommand(new CommandContribution("notes.newNote", "New note", "note_add", "Mod+Alt+N", async u => {
        runs.push(`notes.newNote ${JSON.stringify(u)}`);
        return "opened";
      }));
    });
    bridge.responses.set("desktop.commands", { payload: { commands: [
      { name: "notes.sync", title: "Sync" }, { name: "clock.tick", title: "Tick", icon: "timer", defaultKey: "Mod+Alt+T" },
      { name: "desktop.stopAgentControl", title: "Stop agents", icon: "stop_circle", defaultKey: "Mod+Shift+Period" }
    ], sequence: 2 } });
    bridge.responses.set("desktop.runCommand", { payload: 3 });
    const { host } = start([source("notes", notes, [], [], ["notes.newNote"])], [status("clock"), status("notes")]);
    const commands = TestBed.inject(CommandService);

    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(commands.commands().filter(t => !t.name.startsWith("desktop.") || t.name === "desktop.stopAgentControl").map(t => [t.name, t.title, t.icon, t.defaultKey?.text ?? null])).toEqual([
      ["desktop.stopAgentControl", "Stop agents", "stop_circle", "Mod+Shift+Period"],
      ["clock.tick", "Tick", "timer", "Mod+Alt+T"],
      ["notes.sync", "Sync", null, null],
      ["notes.newNote", "New note", "note_add", "Mod+Alt+N"]
    ]);
    expect([commands.isEnabled("desktop.stopAgentControl"), commands.shortcuts().find(new KeyboardEvent("keydown", { key: ">", code: "Period", ctrlKey: true, shiftKey: true }))])
      .toEqual([true, "desktop.stopAgentControl"]);
    expect(await commands.runAsync("clock.tick", { by: 2 })).toBe(3);
    expect(await host.runCommandAsync("notes.newNote", { folder: "inbox" })).toBe("opened");
    expect(bridge.requests.at(-1)).toEqual(["desktop.runCommand", { name: "clock.tick", arguments: { by: 2 } }]);
    expect(runs).toEqual(["notes.newNote {\"folder\":\"inbox\"}"]);
    expect([host.isCommandRegistered("clock.tick"), host.isCommandRegistered("notes.newNote"), host.isCommandRegistered("notes.open")]).toEqual([true, true, false]);
    expect(["N", "M"].map(t => host.findWindowCommand(new KeyboardEvent("keydown", { key: t.toLowerCase(), code: `Key${t}`, ctrlKey: true, altKey: true })))).toEqual(["notes.newNote", null]);
  });

  it("gives a part a command's key that follows the person's bindings", () => {
    const { host } = start([], []);
    TestBed.inject(CommandService).setCommands([new CommandContribution("notes.newNote", "New note", null, "Mod+Alt+N", () => Promise.resolve(null)),
      new CommandContribution("notes.sync", "Sync", null, null, () => Promise.resolve(null))]);
    const key = host.keyOf("notes.newNote");
    const gone = host.keyOf("notes.gone");
    const before = [key(), gone()][0];
    const bind = (value: JsonValue): void => bridge.publishEvent("desktop.settingsChanged", { name: "desktop.keyBindings", value, isSet: true });
    bind({ "notes.newNote": "F6" });
    const rebound = key();
    bind({ "notes.newNote": "F6", "notes.sync": "F7" });

    expect([before, rebound]).toEqual([{ label: "Ctrl+Alt+N", ariaKeyShortcuts: "Control+Alt+N" }, { label: "F6", ariaKeyShortcuts: "F6" }]);
    expect(key()).toBe(rebound);
    expect([host.keyOf("notes.sync")(), gone()]).toEqual([{ label: "F7", ariaKeyShortcuts: "F7" }, null]);
    bind({ "notes.newNote": null });
    const unbound = key();
    bind({});

    expect([unbound, key()]).toEqual([null, before]);
    const later = host.keyOf("notes.later");
    const unregistered = later();
    TestBed.inject(CommandService).setCommands([new CommandContribution("notes.later", "Later", null, "Mod+Alt+L", () => Promise.resolve(null))]);

    expect([unregistered, later(), key()]).toEqual([null, { label: "Ctrl+Alt+L", ariaKeyShortcuts: "Control+Alt+L" }, null]);
  });

  it("follows the runtime commands' enabled and checked state from the first answer and each newer change", async () => {
    const tick = (isEnabled: boolean): object => ({ name: "clock.tick", title: "Tick", ...isEnabled ? {} : { isEnabled } });
    const pause = (isChecked: boolean): object => ({ name: "clock.pause", title: "Pause", isChecked });
    bridge.responses.set("desktop.commands", { payload: { commands: [tick(false), pause(false)], sequence: 2 } });
    const { host } = start([], [status("clock")]);
    const commands = TestBed.inject(CommandService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const state = (): readonly unknown[] => ["clock.tick", "clock.pause"].map(t => [commands.isEnabled(t), commands.commands().find(u => u.name === t)?.isChecked?.(null) ?? null]);
    const first = state();

    bridge.publishEvent("desktop.commandsChanged", { commands: [tick(true), pause(true)], sequence: 3 });
    const changed = state();
    bridge.publishEvent("desktop.commandsChanged", { commands: [tick(false), pause(false)], sequence: 1 });
    bridge.publishEvent("notes.changed", { commands: [], sequence: 9 });
    bridge.publishEvent("desktop.commandsChanged", { commands: [tick(false)] });
    const afterOlder = state();
    bridge.publishEvent("desktop.commandsChanged", { commands: [pause(true)], sequence: 4 });

    expect(first).toEqual([[false, null], [true, false]]);
    expect(changed).toEqual([[true, null], [true, true]]);
    expect(afterOlder).toEqual(changed);
    expect(state()).toEqual([[false, null], [true, true]]);
    expect(errors.map(t => FailureFixture.of(t, Error).name)).toEqual(["JsonException"]);
  });

  it("keeps a change that arrives before the first answer over the older answer", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    const answer = new Promise<unknown>(t => {
      resolve = t;
    });
    bridge.responses.set("desktop.commands", answer);
    const { host } = start([], [status("clock")]);
    const commands = TestBed.inject(CommandService);
    await vi.waitFor(() => expect(bridge.requests.map(t => t[0])).toContain("desktop.commands"));

    bridge.publishEvent("desktop.commandsChanged", { commands: [{ name: "clock.tick", title: "Tick", isEnabled: false }], sequence: 5 });
    resolve({ payload: { commands: [{ name: "clock.tick", title: "Tick" }], sequence: 4 } });
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(commands.isEnabled("clock.tick")).toBe(false);
    expect(errors).toEqual([]);
  });

  it("disables the runtime commands while the runtime is away and takes a new runtime's first answer whatever its sequence", async () => {
    bridge.responses.set("desktop.commands", { payload: { commands: [{ name: "clock.tick", title: "Tick" }], sequence: 7 } });
    const { host } = start([], [status("clock")]);
    const commands = TestBed.inject(CommandService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const before = commands.isEnabled("clock.tick");

    bridge.responses.set("desktop.commands", { payload: { commands: [{ name: "clock.tick", title: "Tick" }, { name: "clock.reset", title: "Reset" }], sequence: 1 } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    const away = commands.isEnabled("clock.tick");
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect([before, away]).toEqual([true, false]);
    expect([commands.isEnabled("clock.tick"), commands.isEnabled("clock.reset")]).toEqual([true, true]);
  });

  it("shows the window parts' bar items in module order and withdraws a module's items when it no longer activates", async () => {
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes")));
      t.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote")));
    });
    const clock = new WindowPartFixture("clock", log, t => {
      t.registerStatusBarItem(new StatusBarItemContribution("clock.ticks", StatusBarSide.Right, new StatusBarItemState("No ticks")));
      t.registerStatusBarItem(new StatusBarItemContribution("clock.zone", StatusBarSide.Left, new StatusBarItemState("UTC")));
      t.registerTopBarAction(new TopBarActionContribution("clock.reset", new TopBarActionState("restart_alt", "Reset", "clock.tick")));
    });
    const { host } = start([
      source("notes", notes, [], [], [], ["notes.count"], ["notes.compose"]),
      source("clock", clock, [], [], [], ["clock.ticks", "clock.zone"], ["clock.reset"])
    ], [status("clock"), status("notes")]);
    const bars = TestBed.inject(BarItemsService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const shown = [bars.leftItems().map(t => t.name), bars.rightItems().map(t => t.name), bars.endActions().map(t => t.name)];

    bridge.responses.set("desktop.modules", { payload: { modules: [status("clock", ModuleState.Failed, "It broke."), status("notes")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(shown).toEqual([["clock.zone", "notes.count"], ["clock.ticks"], ["clock.reset", "notes.compose"]]);
    expect([bars.leftItems().map(t => t.name), bars.rightItems(), bars.endActions().map(t => t.name)]).toEqual([["notes.count"], [], ["notes.compose"]]);
    expect(errors).toEqual([]);
  });

  it("fails a window part that registers a command the runtime part registered, and replaces the commands when the runtime returns", async () => {
    const notes = new WindowPartFixture("notes", log, t => t.registerCommand(new CommandContribution("notes.sync", "Sync", null, null, () => Promise.resolve(null))));
    bridge.responses.set("desktop.commands", { payload: { commands: [{ name: "notes.sync", title: "Sync" }], sequence: 1 } });
    const { host } = start([source("notes", notes, [], [], ["notes.sync"])], [status("notes")]);
    const commands = TestBed.inject(CommandService);
    await vi.waitFor(() => expect(host.failures().length).toBe(1));

    bridge.responses.set("desktop.commands", { payload: { commands: [], sequence: 0 } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(errors.map(t => [(t instanceof WindowPartFailureException ? t.moduleId : null), FailureFixture.of(FailureFixture.of(t, Error).cause, Error).message])).toEqual([["notes", "The command notes.sync is already registered."]]);
    expect(commands.commands().filter(t => !t.name.startsWith("desktop.")).map(t => t.title)).toEqual(["Sync"]);
    expect(host.isCommandRegistered("notes.sync")).toBe(true);
    expect(host.failures().length).toBe(0);
  });

  it("still loads the layout when the runtime does not answer with its modules", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    bridge.responses.set("desktop.modules", { failure: { code: "Unavailable", message: "The runtime did not answer desktop.modules in time." } });
    const layout = TestBed.inject(LayoutService);
    const loaded = vi.spyOn(layout, "loadAsync");
    const host = TestBed.inject(WindowPartHostService);

    await vi.waitFor(() => expect(loaded).toHaveBeenCalledTimes(1));

    expect([host.generation(), host.failures()]).toEqual([1, []]);
    expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual(["The runtime did not answer desktop.modules in time."]);
  });

  it("opens documents asked for during activation after the layout loads, reports refused ones, and opens later ones at once", async () => {
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1");
      t.openDocument("notes.page", "2", "Page");
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);

    await vi.waitFor(() => expect(errors.length).toBe(1));
    host.openDocument("notes", "notes.note", "3", new DocumentHeading("Note 3"), false);

    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1"), new DocumentTab("notes.note", "3")]);
  });

  it("opens a document right after the instance it names, whether asked for during activation or later", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1");
      t.openDocument("notes.note", "2", "Note 2");
      t.openDocument("notes.note", "3", "Note 3", { after: "1" });
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toHaveLength(3));
    const started = layout.layout().documents.tabs;

    host.openDocument("notes", "notes.note", "4", new DocumentHeading("Note 4"), false, "1");

    expect(started).toEqual([note("1"), note("3"), note("2")]);
    expect(layout.layout().documents.tabs).toEqual([note("1"), note("4"), note("3"), note("2")]);
  });

  it("opens a document without activating it when asked, whether asked for during activation or later", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1");
      t.openDocument("notes.note", "2", "Note 2", { activate: false });
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toHaveLength(2));
    const started = [layout.layout().documents.tabs, layout.layout().documents.active];

    host.openDocument("notes", "notes.note", "3", new DocumentHeading("Note 3"), false, "1", false);

    expect(started).toEqual([[note("1"), note("2")], note("1")]);
    expect([layout.layout().documents.tabs, layout.layout().documents.active]).toEqual([[note("1"), note("3"), note("2")], note("1")]);
  });

  it("changes the heading of a document opened during activation once it opens, and of an open one at once", async () => {
    const note = new DocumentTab("notes.note", "1");
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1");
      t.updateDocument("notes.note", "1", { breadcrumb: ["Notes"] });
      t.updateDocument("notes.note", "2", { title: "Note 2" });
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note]));
    const opened = labels.headingOf(note).text;

    host.updateDocument("notes", "notes.note", "1", "Plan", null);

    expect([opened, labels.headingOf(note).text]).toEqual(["Notes / Note 1", "Notes / Plan"]);
    expect(errors).toEqual([]);
  });

  it("keeps the saved instance tabs a part reopens before its activation ends where they are, closes the rest quietly, and opens one reopened just after as new", async () => {
    const shell = (instance: string): ViewTab => new ViewTab("terminal.shell", instance);
    const registry = new ViewRegistry([new ViewType("terminal.shell", DockSide.Bottom, false, true)], []);
    const base = Layout.createDefault(registry).openView(shell("2"), registry).openView(shell("3"), registry).activate(shell("3"));
    const saved = new TabDropTarget(base.documents.id, 0).place(base, shell("1"));
    const heard: string[] = [];
    const terminal = new WindowPartFixture("terminal", log, t => {
      t.registerView(new ViewContribution("terminal.shell", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true }));
      t.onViewClosed("terminal.shell", u => heard.push(u));
      t.openView("terminal.shell", "1", "pwsh", { breadcrumb: ["Work"] });
    });
    const clock = new WindowPartFixture("clock", log, () => TestBed.inject(WindowPartHostService).openView("terminal", "terminal.shell", "2", new DocumentHeading("bash"), null, null));
    const { layout } = start([source("terminal", terminal, [], ["terminal.shell"]), source("clock", clock)], [status("terminal"), status("clock")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockResolvedValue(saved.toJson());

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([shell("1"), shell("2")]));
    TestBed.tick();
    expect([layout.layout().documents.active, layout.layout().isOpen(shell("3"))]).toEqual([shell("2"), false]);
    expect(TestBed.inject(TabLabelService).headingOf(shell("1")).text).toBe("Work / pwsh");
    expect([heard, errors]).toEqual([[], []]);
  });

  it("applies the instance changes a part makes while activating once the layout loads, in order, and later ones at once", async () => {
    const shell = (instance: string): ViewTab => new ViewTab("terminal.shell", instance);
    const terminal = new WindowPartFixture("terminal", log, t => {
      t.registerView(new ViewContribution("terminal.shell", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true }));
      t.openView("terminal.shell", "1", "pwsh");
      t.openView("terminal.shell", "2", "bash");
      t.updateView("terminal.shell", "1", { title: "Build", breadcrumb: ["Work"] });
      t.closeView("terminal.shell", "2");
    });
    const { host, layout } = start([source("terminal", terminal, [], ["terminal.shell"])], [status("terminal")]);
    const labels = TestBed.inject(TabLabelService);
    await vi.waitFor(() => expect(layout.layout().isOpen(shell("1"))).toBe(true));
    const started = [layout.layout().isOpen(shell("2")), labels.headingOf(shell("1")).text];

    host.openView("terminal", "terminal.shell", "3", new DocumentHeading("zsh", ["Home"]), "code", null);
    const opened = labels.headingOf(shell("3")).text;
    host.updateView("terminal", "terminal.shell", "3", "fish", null, ["Projects"]);
    host.closeView("terminal", "terminal.shell", "1");

    expect([started, opened]).toEqual([[false, "Work / Build"], "Home / zsh"]);
    expect([layout.layout().isOpen(shell("1")), layout.layout().isOpen(shell("3")), labels.of(shell("3")), labels.headingOf(shell("3")).text])
      .toEqual([false, true, new TabLabel("fish", "code"), "Projects / fish"]);
  });

  it("shows a part's view without instances asked for while activating once the layout loads, and shows it or hides the dock of its view tabs at once afterwards", async () => {
    const panel = new ViewTab("terminal.panel");
    const shell = new ViewTab("terminal.shell", "1");
    const terminal = new WindowPartFixture("terminal", log, t => {
      t.registerView(new ViewContribution("terminal.panel", "Terminal", "terminal", DockSide.Bottom, false, load));
      t.registerView(new ViewContribution("terminal.shell", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true }));
      t.showView("terminal.panel");
    });
    const { host, layout } = start([source("terminal", terminal, [], ["terminal.panel", "terminal.shell"])], [status("terminal")]);
    layout.setMetrics(LayoutMetricsFixture.standard);
    layout.setViewport(120, 60);
    await vi.waitFor(() => expect(layout.layout().isOpen(panel)).toBe(true));
    const shown = [layout.layout().groupOf(panel)?.active, layout.layout().dock(DockSide.Bottom).isExpanded];

    host.hideViewDock("terminal", "terminal.panel", null);
    const hidden = layout.layout().dock(DockSide.Bottom).isExpanded;
    host.showView("terminal", "terminal.panel");
    const again = layout.layout().dock(DockSide.Bottom).isExpanded;
    host.openView("terminal", "terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    host.hideViewDock("terminal", "terminal.shell", "1");

    expect([shown, hidden, again]).toEqual([[panel, true], false, true]);
    expect([layout.layout().dock(DockSide.Bottom).isExpanded, layout.layout().isOpen(panel), layout.layout().isOpen(shell), errors]).toEqual([false, true, true, []]);
  });

  it("reads the dock that holds a part's view tab, with its instance or without, as the person moves it", async () => {
    const panel = new ViewTab("terminal.panel");
    const shell = new ViewTab("terminal.shell", "1");
    const terminal = new WindowPartFixture("terminal", log, t => {
      t.registerView(new ViewContribution("terminal.panel", "Terminal", "terminal", DockSide.Bottom, false, load));
      t.registerView(new ViewContribution("terminal.shell", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true }));
      t.showView("terminal.panel");
    });
    const { host, layout } = start([source("terminal", terminal, [], ["terminal.panel", "terminal.shell"])], [status("terminal")]);
    layout.setMetrics(LayoutMetricsFixture.standard);
    layout.setViewport(120, 60);
    await vi.waitFor(() => expect(layout.layout().isOpen(panel)).toBe(true));
    const panelDock = host.viewDockOf("terminal.panel", null);
    const shellDock = host.viewDockOf("terminal.shell", "1");
    const before = [panelDock(), shellDock()];

    host.openView("terminal", "terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    const opened = shellDock();
    layout.place(panel, new SideDropTarget(DockSide.Right));
    layout.place(shell, new TabDropTarget(layout.layout().documents.id, 0));

    expect([before, opened, panelDock(), shellDock(), errors]).toEqual([[DockSide.Bottom, null], DockSide.Bottom, DockSide.Right, null, []]);
  });

  it("asks the dock growth for a part's view tab, with its instance or without, until the part releases it", () => {
    const { host } = start([], []);
    const growth = TestBed.inject(DockGrowthService);

    const releasePanel = host.growViewDock("terminal.panel", null, 12);
    const releaseShell = host.growViewDock("terminal.shell", "1", 20);
    const asked = [growth.minimumOf(new ViewTab("terminal.panel")), growth.minimumOf(new ViewTab("terminal.shell", "1"))];
    releasePanel();
    releaseShell();

    expect([asked, growth.minimumOf(new ViewTab("terminal.panel")), growth.minimumOf(new ViewTab("terminal.shell", "1"))]).toEqual([[12, 20], null, null]);
  });

  it("drops the instance changes of a part whose activation fails", async () => {
    const terminal = new WindowPartFixture("terminal", log, t => {
      t.registerView(new ViewContribution("terminal.shell", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true }));
      t.openView("terminal.shell", "1", "pwsh");
      throw new Error("It did not start.");
    });
    const { host, layout } = start([source("terminal", terminal, [], ["terminal.shell"])], [status("terminal")]);

    await vi.waitFor(() => expect(host.generation()).toBe(1));
    await vi.waitFor(() => expect(errors.length).toBe(1));
    expect(layout.layout().isOpen(new ViewTab("terminal.shell", "1"))).toBe(false);
  });

  it("opens no document that a part whose activation fails asked for during it", async () => {
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1");
      throw new Error("It did not start.");
    });
    const tasks = new WindowPartFixture("tasks", log, t => {
      t.registerDocument(new DocumentContribution("tasks.note", load));
      t.openDocument("tasks.note", "1", "Task 1");
    });
    const { layout } = start([source("notes", notes), source("tasks", tasks)], [status("notes"), status("tasks")]);

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("tasks.note", "1")]));
    expect(errors.length).toBe(1);
  });

  it("opens no document that a part asked for during a failed activation once it activates on reconnect, when the connection ended before the layout loaded", async () => {
    let attempts = 0;
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      attempts += 1;
      if (attempts === 1) {
        t.openDocument("notes.note", "1", "Note 1");
        throw new Error("It did not start.");
      }
    });
    const tasks = new WindowPartFixture("tasks", log, t => {
      t.registerDocument(new DocumentContribution("tasks.note", load));
      t.openDocument("tasks.note", "1", "Task 1");
    });
    tasks.onReconnect = () => true;
    const { host, layout } = start([source("notes", notes), source("tasks", tasks)], [status("notes"), status("tasks")]);
    const { read, release } = holdRead();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    read.mockResolvedValueOnce(null);
    release(new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime."));
    await vi.waitFor(() => expect(errors.length).toBe(2));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("tasks.note", "1")]));
    expect([attempts, errors.length]).toEqual([2, 2]);
  });

  it("updates and closes no document that a part whose activation fails asked for before the layout loaded", async () => {
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.updateDocument("notes.note", "1", { title: "Note 1" });
      t.closeDocument("notes.note", "2");
      throw new Error("It did not start.");
    });
    const tasks = new WindowPartFixture("tasks", log, t => {
      t.registerDocument(new DocumentContribution("tasks.note", load));
      t.openDocument("tasks.note", "1", "Task 1");
    });
    const { layout } = start([source("notes", notes), source("tasks", tasks)], [status("notes"), status("tasks")]);
    const opener = TestBed.inject(DocumentOpenerService);
    const updated = vi.spyOn(opener, "update");
    const closed = vi.spyOn(opener, "close");

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("tasks.note", "1")]));
    expect([updated.mock.calls, closed.mock.calls, errors.length]).toEqual([[], [], 1]);
  });

  it("updates and closes no document that a part asked for before the layout loaded once it deactivates, when the connection ended first and it activates again on reconnect", async () => {
    let attempts = 0;
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      attempts += 1;
      if (attempts === 1) {
        t.updateDocument("notes.note", "1", { title: "Note 1" });
        t.closeDocument("notes.note", "2");
      }
    });
    const tasks = new WindowPartFixture("tasks", log, t => {
      t.registerDocument(new DocumentContribution("tasks.note", load));
      t.openDocument("tasks.note", "1", "Task 1");
    });
    tasks.onReconnect = () => true;
    const { host, layout } = start([source("notes", notes), source("tasks", tasks)], [status("notes"), status("tasks")]);
    const opener = TestBed.inject(DocumentOpenerService);
    const updated = vi.spyOn(opener, "update");
    const closed = vi.spyOn(opener, "close");
    const { read, release } = holdRead();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    read.mockResolvedValueOnce(null);
    release(new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime."));
    await vi.waitFor(() => expect(errors.length).toBe(1));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("tasks.note", "1")]));
    expect([attempts, updated.mock.calls, closed.mock.calls, errors.length]).toEqual([2, [], [], 1]);
  });

  it("opens no view that a part asked for during a failed activation once it activates on reconnect, when the connection ended before the layout loaded", async () => {
    let attempts = 0;
    const terminal = new WindowPartFixture("terminal", log, t => {
      t.registerView(new ViewContribution("terminal.shell", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true }));
      attempts += 1;
      if (attempts === 1) {
        t.openView("terminal.shell", "1", "pwsh");
        throw new Error("It did not start.");
      }
    });
    const tasks = new WindowPartFixture("tasks", log, t => {
      t.registerDocument(new DocumentContribution("tasks.note", load));
      t.openDocument("tasks.note", "1", "Task 1");
    });
    tasks.onReconnect = () => true;
    const { host, layout } = start([source("terminal", terminal, [], ["terminal.shell"]), source("tasks", tasks)], [status("terminal"), status("tasks")]);
    const { read, release } = holdRead();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    read.mockResolvedValueOnce(null);
    release(new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime."));
    await vi.waitFor(() => expect(errors.length).toBe(2));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("tasks.note", "1")]));
    expect([attempts, layout.layout().isOpen(new ViewTab("terminal.shell", "1")), errors.length]).toEqual([2, false, 2]);
  });

  it("tells a part when the person closes one of its instance tabs, and never once the part deactivates or the window goes away", async () => {
    const shell = (instance: string): ViewTab => new ViewTab("terminal.shell", instance);
    const heard: string[] = [];
    const terminal = new WindowPartFixture("terminal", log, t => {
      t.registerView(new ViewContribution("terminal.shell", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true }));
      t.onViewClosed("terminal.shell", u => heard.push(u));
      ["1", "2", "3"].forEach(u => t.openView("terminal.shell", u, `Shell ${u}`));
    });
    const { host, layout } = start([source("terminal", terminal, [], ["terminal.shell"])], [status("terminal")]);
    await vi.waitFor(() => expect(layout.layout().isOpen(shell("3"))).toBe(true));
    TestBed.tick();
    layout.close(shell("1"));
    TestBed.tick();

    bridge.responses.set("desktop.modules", { payload: { modules: [status("terminal", ModuleState.Failed, "It broke.")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));
    TestBed.tick();
    layout.close(shell("2"));
    TestBed.tick();
    TestBed.resetTestingModule();

    expect(heard).toEqual(["1"]);
    expect(log).toEqual(["activate terminal", "deactivate terminal"]);
  });

  it("tells a reactivated part of the instance tabs the person closed while it was inactive, and leaves them closed when it reopens them", async () => {
    const shell = (instance: string): ViewTab => new ViewTab("terminal.shell", instance);
    const heard: string[] = [];
    const terminal = new WindowPartFixture("terminal", log, t => {
      t.registerView(new ViewContribution("terminal.shell", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true }));
      t.onViewClosed("terminal.shell", u => heard.push(u));
      ["1", "2"].forEach(u => t.openView("terminal.shell", u, `Shell ${u}`));
    });
    const { host, layout } = start([source("terminal", terminal, [], ["terminal.shell"])], [status("terminal")]);
    await vi.waitFor(() => expect(layout.layout().isOpen(shell("2"))).toBe(true));
    TestBed.tick();
    bridge.responses.set("desktop.modules", { payload: { modules: [status("terminal", ModuleState.Failed, "It broke.")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));
    TestBed.tick();
    layout.close(shell("2"));
    TestBed.tick();
    const inactive = [...heard];

    bridge.responses.set("desktop.modules", { payload: { modules: [status("terminal")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(3));
    TestBed.tick();

    expect(inactive).toEqual([]);
    expect([layout.layout().isOpen(shell("1")), layout.layout().isOpen(shell("2"))]).toEqual([true, false]);
    expect(heard).toEqual(["2"]);
    expect(log).toEqual(["activate terminal", "deactivate terminal", "activate terminal"]);
  });

  it("marks a part's renamable views and documents in the registry, and tells it each title a person keeps", async () => {
    const heard: string[] = [];
    const part = new WindowPartFixture("notes", log, t => {
      t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, false, load, undefined, { hasInstances: true, isRenamable: true }));
      t.registerDocument(new DocumentContribution("notes.note", load, undefined, { isRenamable: true }));
      t.registerDocument(new DocumentContribution("notes.page", load));
      t.onTabRenamed("notes.list", (u, v) => heard.push(`list ${u} ${v}`));
      t.onTabRenamed("notes.note", (u, v) => heard.push(`note ${u} ${v}`));
    });
    const { layout } = start([source("notes", part, [], ["notes.list"], [], [], [], [], ["notes.note", "notes.page"])], [status("notes")]);
    layout.setMetrics(LayoutMetricsFixture.standard);
    layout.setViewport(120, 60);
    await vi.waitFor(() => expect(layout.registry().hasDocument("notes.page")).toBe(true));
    const [list, note] = [new ViewTab("notes.list", "1"), new DocumentTab("notes.note", "2")];
    layout.openView(list);
    layout.openDocument(note);
    const renames = TestBed.inject(TabRenameService);
    renames.begin(list);
    renames.keep("Inbox");
    renames.begin(note);
    renames.keep("Plans");

    expect([layout.registry().isRenamableView("notes.list"), layout.registry().isRenamableDocument("notes.note"), layout.registry().isRenamableDocument("notes.page")])
      .toEqual([true, true, false]);
    expect(heard).toEqual(["list 1 Inbox", "note 2 Plans"]);
  });

  it("tells a part when the person closes one of its document tabs, and never of one it closed itself, once it deactivates or when the window goes away", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const heard: string[] = [];
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.onDocumentClosed("notes.note", u => heard.push(u));
      ["1", "2", "3", "4"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(layout.layout().isOpen(note("4"))).toBe(true));
    TestBed.tick();
    layout.close(note("1"));
    host.closeDocument("notes", "notes.note", "2");
    TestBed.tick();

    bridge.responses.set("desktop.modules", { payload: { modules: [status("notes", ModuleState.Failed, "It broke.")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));
    TestBed.tick();
    const open = layout.layout().documents.tabs;
    layout.close(note("3"));
    TestBed.tick();
    TestBed.resetTestingModule();

    expect(open).toEqual([note("3"), note("4")]);
    expect(heard).toEqual(["1"]);
    expect(log).toEqual(["activate notes", "deactivate notes"]);
  });

  it("tells a reactivated part of the document tabs the person closed while it was inactive, and leaves them closed when it reopens them", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const heard: string[] = [];
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.onDocumentClosed("notes.note", u => heard.push(u));
      ["1", "2"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(layout.layout().isOpen(note("2"))).toBe(true));
    TestBed.tick();
    bridge.responses.set("desktop.modules", { payload: { modules: [status("notes", ModuleState.Failed, "It broke.")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));
    TestBed.tick();
    layout.close(note("2"));
    TestBed.tick();
    const inactive = [...heard];

    bridge.responses.set("desktop.modules", { payload: { modules: [status("notes")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(3));
    TestBed.tick();

    expect(inactive).toEqual([]);
    expect(layout.layout().documents.tabs).toEqual([note("1")]);
    expect(heard).toEqual(["2"]);
    expect(log).toEqual(["activate notes", "deactivate notes", "activate notes"]);
  });

  it("forgets a close no listener heard once the part opens that document again, so its next activation hears nothing of it", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const heard: string[] = [];
    let activations = 0;
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      activations += 1;
      if (activations > 1)
        t.onDocumentClosed("notes.note", u => heard.push(u));
      t.openDocument("notes.note", "1", "Note 1");
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(layout.layout().isOpen(note("1"))).toBe(true));
    TestBed.tick();
    layout.close(note("1"));
    TestBed.tick();
    host.openDocument("notes", "notes.note", "1", new DocumentHeading("Note 1"), false);
    TestBed.tick();

    for (const [generation, state] of [[2, ModuleState.Failed], [3, ModuleState.Active]] as const) {
      bridge.responses.set("desktop.modules", { payload: { modules: [status("notes", state, state === ModuleState.Failed ? "It broke." : null)] } });
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
      await vi.waitFor(() => expect(host.generation()).toBe(generation));
      TestBed.tick();
    }

    expect(layout.layout().documents.tabs).toEqual([note("1")]);
    expect(heard).toEqual([]);
    expect(log).toEqual(["activate notes", "deactivate notes", "activate notes"]);
  });

  it("lists a part's open document instances once its activation ends, the saved ones among them, at once after it, and nothing for a part whose activation fails", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note("1")).openDocument(note("3"));
    const lists: (readonly string[] | null)[] = [];
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      ["1", "2"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
      void t.listOpenDocumentsAsync("notes.note").then(u => lists.push(u));
    });
    const failing = new WindowPartFixture("clock", log, t => {
      void t.listOpenDocumentsAsync("clock.note").then(u => lists.push(u));
      throw new Error("It broke.");
    });
    const { host } = start([source("notes", part), source("clock", failing)], [status("notes"), status("clock")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockResolvedValue(saved.toJson());
    await vi.waitFor(() => expect(lists).toHaveLength(2));
    const later = await host.listOpenDocumentsAsync("notes", "notes.note");

    expect(lists).toEqual([null, ["1", "3"]]);
    expect(later).toEqual(["1", "3"]);
  });

  it("restores the saved documents a part opens during activation with the saved active one, leaves out one the layout lacks, and opens it when asked later", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note("1")).openDocument(note("2")).openDocument(note("3")).activate(note("1"));
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      ["1", "2", "3", "4"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockResolvedValue(saved.toJson());
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toHaveLength(3));
    const restored = [layout.layout().documents.tabs, layout.layout().documents.active];

    host.openDocument("notes", "notes.note", "4", new DocumentHeading("Note 4"), false);

    expect(restored).toEqual([[note("1"), note("2"), note("3")], note("1")]);
    expect(TestBed.inject(TabLabelService).of(note("3")).title).toBe("Note 3");
    expect([layout.layout().documents.tabs, layout.layout().documents.active]).toEqual([[note("1"), note("2"), note("3"), note("4")], note("4")]);
  });

  it("opens a document asked for after activation but before the saved layout is read, right after the instance it names, and still leaves out a start open the layout lacks", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note("1")).openDocument(note("2"));
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      ["1", "3"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
    });
    let read: (value: JsonValue) => void = () => undefined;
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockReturnValue(new Promise(resolve => read = resolve));
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    host.openDocument("notes", "notes.note", "4", new DocumentHeading("Note 4"), false, "1");
    host.keepDocument("notes", "notes.note", "1");
    host.updateDocument("notes", "notes.note", "1", "First note", ["Notes"]);
    read(saved.toJson());

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note("1"), note("4"), note("2")]));
    expect(layout.layout().documents.active).toEqual(note("4"));
    expect(TestBed.inject(TabLabelService).headingOf(note("1")).text).toBe("Notes / First note");
  });

  it("keeps the active document when the runtime is ready again, and adds a document the parts open while reactivating that is not open", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      ["1", "2"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    expect(layout.layout().documents.active).toEqual(note("2"));
    layout.close(note("2"));
    layout.activate(note("1"));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(layout.layout().documents.tabs).toEqual([note("1"), note("2")]);
    expect(layout.layout().documents.active).toEqual(note("1"));
  });

  it("brings to the front a document a part that keeps running opens while the window reconnects, whether its tab is open behind the active one or new", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      ["1", "2"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const reconnectOpeningAsync = async (instance: string, generation: number): Promise<readonly [readonly DocumentTab[], DocumentTab | null]> => {
      layout.activate(note("1"));
      part.onReconnect = () => {
        host.openDocument("notes", "notes.note", instance, new DocumentHeading(`Note ${instance}`), false);
        return true;
      };
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
      await vi.waitFor(() => expect(host.generation()).toBe(generation));
      return [layout.layout().documents.tabs, layout.layout().documents.active];
    };

    const reopened = await reconnectOpeningAsync("2", 2);
    const added = await reconnectOpeningAsync("3", 3);

    expect(log).toEqual(["activate notes", "reconnect notes", "reconnect notes"]);
    expect(reopened).toEqual([[note("1"), note("2")], note("2")]);
    expect(added).toEqual([[note("1"), note("2"), note("3")], note("3")]);
  });

  it("leaves out a document closed while its part activates, closes one the saved layout holds once it loads, and closes one at once afterwards", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note("0")).openDocument(note("3")).openDocument(note("4"));
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      ["0", "1", "2"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
      ["1", "3"].forEach(u => t.closeDocument("notes.note", u));
    });
    let read: (value: JsonValue) => void = () => undefined;
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockReturnValue(new Promise(resolve => read = resolve));
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    host.closeDocument("notes", "notes.note", "4");
    host.closeDocument("notes", "notes.note", "5");
    host.openDocument("notes", "notes.note", "5", new DocumentHeading("Note 5"), false);
    read(saved.toJson());
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note("0"), note("5")]));

    host.closeDocument("notes", "notes.note", "5");

    expect(layout.layout().documents.tabs).toEqual([note("0")]);
  });

  it("forgets a part's document, closing it and taking it out of Back and Forward so they go to the document before it", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const part = new WindowPartFixture("notes", log, t => t.registerDocument(new DocumentContribution("notes.note", load)));
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const history = TestBed.inject(DocumentHistoryService);
    for (const instance of ["1", "2", "3"]) {
      host.openDocument("notes", "notes.note", instance, new DocumentHeading(`Note ${instance}`), false);
      await vi.waitFor(() => expect(layout.layout().documents.active).toEqual(note(instance)));
      TestBed.tick();
    }

    host.forgetDocument("notes", "notes.note", "2");
    TestBed.tick();
    const isOpen = layout.layout().isOpen(note("2"));
    history.go(-1);

    expect([isOpen, layout.layout().documents.active]).toEqual([false, note("1")]);
  });

  it("drops a part's places from Back and Forward as it starts to deactivate and those it records while deactivating, so neither it nor its next activation can reach them", async () => {
    const heard: string[] = [];
    const contexts: IWindowPartContext[] = [];
    let activations = 0;
    const part = new WindowPartFixture("notes", log, t => {
      contexts.push(t);
      t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.onPlaceShown("notes.list", u => heard.push(u));
      activations += 1;
      if (activations > 1)
        return;
      t.recordPlace("notes.list", "note-0");
      t.forgetPlace("notes.list", "note-0");
      t.recordPlace("notes.list", "note-1");
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const history = TestBed.inject(DocumentHistoryService);
    host.openDocument("notes", "notes.note", "1", new DocumentHeading("Note 1"), false);
    await vi.waitFor(() => expect(layout.layout().documents.active).toEqual(new DocumentTab("notes.note", "1")));
    TestBed.tick();
    const before = history.canGoBack();
    const during: boolean[] = [];
    vi.spyOn(part, "deactivateAsync").mockImplementation(() => {
      during.push(history.canGoBack());
      contexts[0]?.recordPlace("notes.list", "note-2");
      TestBed.tick();
      return Promise.resolve();
    });

    bridge.publishStartup({ kind: "Ready", details: [] });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));
    TestBed.tick();
    history.go(-1);

    expect([before, during, history.canGoBack(), activations, heard]).toEqual([true, [false], false, 2, []]);
  });

  it("drops the places a part records before its activation fails, so its next activation can't reach them", async () => {
    const heard: string[] = [];
    let activations = 0;
    const part = new WindowPartFixture("notes", log, t => {
      t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.onPlaceShown("notes.list", u => heard.push(u));
      activations += 1;
      if (activations > 1)
        return;
      t.recordPlace("notes.list", "note-1");
      throw new Error("It did not start.");
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    await vi.waitFor(() => expect(errors.length).toBe(1));

    bridge.publishStartup({ kind: "Ready", details: [] });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));
    const history = TestBed.inject(DocumentHistoryService);
    host.openDocument("notes", "notes.note", "1", new DocumentHeading("Note 1"), false);
    await vi.waitFor(() => expect(layout.layout().documents.active).toEqual(new DocumentTab("notes.note", "1")));
    TestBed.tick();
    history.go(-1);

    expect([history.canGoBack(), activations, heard]).toEqual([false, 2, []]);
  });

  it("forgets a document a part forgets before the layout loads, so Back and Forward can't reach it though the saved layout showed it", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note("0")).openDocument(note("1"));
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.forgetDocument("notes.note", "1");
    });
    let read: (value: JsonValue) => void = () => undefined;
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockReturnValue(new Promise(resolve => read = resolve));
    const opener = TestBed.inject(DocumentOpenerService);
    const close = opener.close.bind(opener);
    vi.spyOn(opener, "close").mockImplementation((...t) => {
      TestBed.tick();
      close(...t);
    });
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    read(saved.toJson());
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note("0")]));
    TestBed.tick();
    const history = TestBed.inject(DocumentHistoryService);

    expect([layout.layout().documents.active, history.canGoBack(), history.canGoForward()]).toEqual([note("0"), false, false]);
  });

  it("reports a close asked before the layout loads that fails once it has, and still closes the others", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note("0")).openDocument(note("1"));
    const part = new WindowPartFixture("notes", log, t => t.registerDocument(new DocumentContribution("notes.note", load)));
    let read: (value: JsonValue) => void = () => undefined;
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockReturnValue(new Promise(resolve => read = resolve));
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    host.closeDocument("notes", "notes.missing", "1");
    host.closeDocument("notes", "notes.note", "1");

    read(saved.toJson());
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note("0")]));

    expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual([new ArgumentException(`No document named "notes.missing" is registered.`, "name").message]);
  });

  it("keeps the titles a part gives before the layout loads, background tabs included, applies them over the saved ones once it loads, and titles at once afterwards", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note("0")).openDocument(note("1")).openDocument(note("2")).openDocument(note("3"));
    const part = new WindowPartFixture("notes", log, t => t.registerDocument(new DocumentContribution("notes.note", load)));
    let read: (value: JsonValue) => void = () => undefined;
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockReturnValue(new Promise(resolve => read = resolve));
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    host.updateDocument("notes", "notes.note", "0", "Background", null);
    host.updateDocument("notes", "notes.note", "1", "First", ["Drafts"], "folder");
    host.updateDocument("notes", "notes.note", "1", "Second", null);
    host.updateDocument("notes", "notes.note", "2", "Closed", null);
    host.updateDocument("notes", "notes.missing", "1", "Missing", null);
    host.closeDocument("notes", "notes.note", "2");
    read({ ...saved.toJson(), titles: { [note("0").key]: "Saved 0", [note("3").key]: "Saved 3" } });
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note("0"), note("1"), note("3")]));
    const labels = TestBed.inject(TabLabelService);
    const loaded = ["0", "1", "2", "3"].map(t => labels.titleOf(note(t)));

    host.updateDocument("notes", "notes.note", "3", "Later", null);

    expect(loaded).toEqual(["Background", "Second", null, "Saved 3"]);
    expect(labels.headingOf(note("1"))).toEqual(new DocumentHeading("Second", ["Drafts"], "folder"));
    expect(labels.titleOf(note("3"))).toBe("Later");
    expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual([new ArgumentException(`No document named "notes.missing" is registered.`, "name").message]);
  });

  it("lets a document opened before the layout loads keep its own title over an update made before the open", async () => {
    const note = new DocumentTab("notes.note", "1");
    const part = new WindowPartFixture("notes", log, t => t.registerDocument(new DocumentContribution("notes.note", load)));
    let read: (value: JsonValue) => void = () => undefined;
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockReturnValue(new Promise(resolve => read = resolve));
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    host.updateDocument("notes", "notes.note", "1", "Old", ["Drafts"]);
    host.openDocument("notes", "notes.note", "1", new DocumentHeading("New"), false);
    read(Layout.createDefault(new ViewRegistry([], [])).toJson());
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note]));

    expect(TestBed.inject(TabLabelService).headingOf(note)).toEqual(new DocumentHeading("New"));
    expect(errors).toEqual([]);
  });

  it("keeps a preview asked to be kept before the layout loads, and keeps one at once afterwards", async () => {
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "0", "Note 0");
      t.openDocument("notes.note", "1", "Note 1", { preview: true });
      t.keepDocument("notes.note", "1");
      t.openDocument("notes.note", "2", "Note 2", { preview: true });
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(layout.layout().documents.tabs.length).toBe(3));
    const preview = layout.layout().documents.preview;

    host.keepDocument("notes", "notes.note", "2");

    expect(preview).toEqual(new DocumentTab("notes.note", "2"));
    expect(layout.layout().documents.preview).toBeNull();
  });

  it("opens a window part's palette under the window row in its own pane, giving it the part's context, a padding of its own, shown and never the active document", async () => {
    const row = document.body.appendChild(document.createElement("nol-window-row"));
    Object.assign(row.style, { position: "fixed", top: "0", left: "0", right: "0", height: "2rem", display: "block" });
    const { host } = start([source("notes", notesPart(log))], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const context = host.findContribution(new ViewTab("notes.list"))?.context;
    if (Object.isNullOrUndefined(context))
      throw new Error("The notes part has no context.");

    const palette = host.openBelowWindowRow(context, PaletteComponent);
    const opened = palette?.componentRef.instance;
    const pane = document.querySelector(".cdk-overlay-container .nol-window-palette-pane > *");
    palette?.close();
    row.remove();

    expect([opened?.context, opened?.padding.value(), opened?.shown(), opened?.activeDocument(), Object.isNull(pane)]).toEqual([context, null, true, false, false]);
  });

  it("returns focus to where it was when the part's withdrawal closes the palette that took it", async () => {
    const { context, row, button } = await startWithPalette();
    button.focus();
    await context.openBelowWindowRowAsync(() => Promise.resolve(FocusingPaletteComponent));
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("palette-field")).toBe(true));
    context.withdraw();
    const focused = document.activeElement;
    row.remove();
    button.remove();

    expect([focused === button, document.querySelector(".nol-window-palette-pane")]).toEqual([true, null]);
  });

  it("gives focus to nothing that has gone when the part's withdrawal closes its palette", async () => {
    const { context, row, button } = await startWithPalette();
    button.focus();
    await context.openBelowWindowRowAsync(() => Promise.resolve(FocusingPaletteComponent));
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("palette-field")).toBe(true));
    button.remove();
    context.withdraw();
    const focused = document.activeElement;
    row.remove();

    expect([focused === document.body, document.querySelector(".nol-window-palette-pane")]).toEqual([true, null]);
  });

  it("shows a registered document or else a view by name in a dialog, with its instance and title", async () => {
    const { host } = start([source("notes", notesPart(log))], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const shown = vi.spyOn(TestBed.inject(ViewDialogService), "showAsync").mockResolvedValue();

    await host.showInDialogAsync("notes.note", "2", "Note 2");
    await host.showInDialogAsync("notes.list", null, null);
    await host.showInDialogAsync("notes.list", "3", null);
    await host.showInDialogAsync("desktop.settings", null, null);

    await expect(host.showInDialogAsync("Notes", null, null)).rejects.toThrowError(ArgumentException);
    expect(shown.mock.calls).toEqual([[new DocumentTab("notes.note", "2"), "Note 2"], [new ViewTab("notes.list"), null], [new ViewTab("notes.list", "3"), null], [new DocumentTab("desktop.settings"), null]]);
  });

  it("closes the dialog showing a window part's view or document through the dialog service, by name or by name and instance", () => {
    const { host } = start([], []);
    const closing = vi.spyOn(TestBed.inject(ViewDialogService), "closeShowing").mockReturnValue();

    host.closeDialog("notes.list", null);
    host.closeDialog("notes.note", "2");

    expect(closing.mock.calls).toEqual([["notes.list", null], ["notes.note", "2"]]);
  });

  it("writes a window part's log lines through the main process under its module's id", async () => {
    const part = new WindowPartFixture("notes", log, t => t.log("Opened the list"));
    const { host } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(bridge.logged).toEqual(["notes: Opened the list"]);
  });

  it("opens a window part's web link in the in-app browser a part registered, and shows a link's menu", async () => {
    const { host } = start([], []);
    const opened: string[] = [];
    const logged: string[] = [];
    const stop = host.registerInAppBrowser({ placeFor: () => LinkPlace.InApp, openAsync: t => Promise.resolve(void opened.push(t)) }, t => logged.push(t));
    await host.openLinkAsync("https://example.com/help", { gesture: LinkGesture.Plain });
    host.showLinkMenu("https://example.com/docs", new MouseEvent("contextmenu", { cancelable: true }));
    stop();
    await host.openLinkAsync("https://example.com/help", {});

    expect([opened, bridge.links, logged, TestBed.inject(LinkService).menu()?.url]).toEqual([["https://example.com/help"], ["https://example.com/help"], [], "https://example.com/docs"]);
  });

  it("opens a window part's link through the main process, and rejects when the main process does not open it", async () => {
    const { host } = start([], []);

    await host.openLinkAsync("https://example.com/help", {});
    bridge.isLinkOpened = false;
    const refusal = await host.openLinkAsync("file:///etc/passwd", {}).catch((error: unknown) => error);

    expect(bridge.links).toEqual(["https://example.com/help", "file:///etc/passwd"]);
    expect([refusal instanceof LinkNotOpenedException, FailureFixture.of(refusal, Error).message])
      .toEqual([true, "Noldova Desktop Sample did not open the link: it opens only well-formed http, https and mailto links, in the system's own application."]);
  });

  it("shows a window part's file in its folder through the main process, and rejects with the main process's reason when it refuses", async () => {
    const { host } = start([], []);

    await host.showInFolderAsync("/home/ada/report.pdf");
    bridge.showRefusal = "no file can be read at the path.";
    const refusal = await host.showInFolderAsync("/home/ada/missing.pdf").catch((error: unknown) => error);

    expect(bridge.shownFiles).toEqual(["/home/ada/report.pdf", "/home/ada/missing.pdf"]);
    expect([refusal instanceof FileNotShownException, refusal instanceof ExportedFileNotShownException && refusal.reason, FailureFixture.of(refusal, Error).message])
      .toEqual([true, bridge.showRefusal, "Noldova Desktop Sample didn't show the file in its folder: no file can be read at the path."]);
  });

  it("opens a window part's file in its default app through the main process, and rejects with the main process's reason when it refuses", async () => {
    const { host } = start([], []);

    await host.openFileAsync("/home/ada/notes.md");
    bridge.openRefusal = "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.";
    const refusal = await host.openFileAsync("/home/ada/run.sh").catch((error: unknown) => error);

    expect(bridge.openedFiles).toEqual(["/home/ada/notes.md", "/home/ada/run.sh"]);
    expect([refusal instanceof FileNotOpenedException, refusal instanceof ExportedFileNotOpenedException && refusal.reason, FailureFixture.of(refusal, Error).message])
      .toEqual([true, bridge.openRefusal, "Noldova Desktop Sample didn't open the file: only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens."]);
  });

  it("opens a window part's web view through the window's web views, which refuse a pane that isn't open", async () => {
    const { host } = start([source("notes", notesPart(log))], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const context = host.findContribution(new ViewTab("notes.list"))?.context;
    if (Object.isNullOrUndefined(context))
      throw new Error("The notes part has no context.");

    const refusal = await host.openWebViewAsync(context, "notes", new WebViewPane(QualifiedName.parse("notes.note"), "plan"), new DocumentTab("notes.note", "plan"), "workspace-1")
      .catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(WebViewNotOpenedException);
    expect(bridge.webViewCalls).toEqual([]);
  });

  it("gives a window part's web view the part's tokens for its layers, the active document while the view's tab is", async () => {
    const { host, layout } = start([source("notes", notesPart(log))], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const context = host.findContribution(new ViewTab("notes.list"))?.context;
    if (Object.isNullOrUndefined(context))
      throw new Error("The notes part has no context.");
    const injectors: Injector[] = [];
    vi.spyOn(TestBed.inject(WebViewService), "openAsync").mockImplementation((_moduleId, _pane, _tab, _profileKey, injector) => {
      injectors.push(injector);
      return Promise.reject(new WebViewNotOpenedException());
    });
    const [plan, todo] = [new DocumentTab("notes.note", "plan"), new DocumentTab("notes.note", "todo")];

    await host.openWebViewAsync(context, "notes", new WebViewPane(QualifiedName.parse("notes.note"), "plan"), plan, "workspace-1").catch(() => undefined);
    const [injector] = injectors;
    if (Object.isNullOrUndefined(injector))
      throw new Error("The web view got no injector.");
    const activeDocument = injector.get(WindowPartTokens.activeDocument);
    const states = [activeDocument()];
    layout.openDocument(plan);
    states.push(activeDocument());
    layout.openDocument(todo);
    states.push(activeDocument());

    expect([injector.get(WindowPartTokens.context), injector.get(WindowPartTokens.shown)(), states]).toEqual([context, true, [false, true, false]]);
  });

  it("asks the main process for a window part's folder and passes on the answer", async () => {
    const { host } = start([], []);
    bridge.folder = "/home/person/project";

    const chosen = await host.chooseFolderAsync();
    bridge.folder = null;
    const cancelled = await host.chooseFolderAsync();

    expect([chosen, cancelled, bridge.folderChoices]).toEqual(["/home/person/project", null, 2]);
  });

  it("asks the main process for a window part's file path and passes on the answer", async () => {
    const { host } = start([], []);
    bridge.filePath = "/opt/tools/agent";

    const chosen = await host.chooseFilePathAsync({ folder: "/opt/tools" });
    bridge.filePath = null;
    const cancelled = await host.chooseFilePathAsync({});

    expect([chosen, cancelled, bridge.filePathChoices]).toEqual(["/opt/tools/agent", null, [{ folder: "/opt/tools" }, {}]]);
  });

  it("tells a window part's context the window's platform", () => {
    const { host } = start([], []);
    bridge.platform = "win32";

    expect(host.platform).toBe("win32");
  });

  it("asks the main process for a window part's files, discards its grants through the runtime and reports a discard that fails", async () => {
    const { host } = start([], []);
    bridge.fileGrants = { granted: [{ grant: "a".repeat(32), name: "report.pdf", mediaType: "application/pdf", size: 1204 }], refused: [] };

    const chosen = await host.chooseFilesAsync("notes", { multiple: true });
    const offered = await host.grantFilesAsync("notes", [new File(["notes"], "notes.txt")], { lifetime: 1_000 });
    host.discardFileGrants(["a".repeat(32)]);
    bridge.responses.set("desktop.discardFileGrants", { failure: { code: "Internal", message: "The runtime failed." } });
    host.discardFileGrants(["b".repeat(32)]);

    await vi.waitFor(() => expect(errors.map(t => t instanceof Error ? t.message : t)).toEqual(["The runtime failed."]));
    expect([chosen.files[0]?.name, offered.files[0]?.size]).toEqual(["report.pdf", 1204]);
    expect(bridge.fileRequests).toEqual([["chooseFiles", "notes", { multiple: true }], ["grantFiles", "notes", ["notes.txt"], { lifetime: 1_000 }]]);
    expect(bridge.requests.filter(([method]) => method === "desktop.discardFileGrants").length).toBe(2);
  });

  it("asks the main process to save a window part's file and passes on the outcome", async () => {
    const { host } = start([], []);
    bridge.saveOutcome = "Cancelled";

    const outcome = await host.saveFileAsync("photo.png", new Uint8Array([7]));

    expect([outcome, bridge.saves]).toEqual([FileSaveOutcome.Cancelled, [["photo.png", [7]]]]);
  });

  it("reports a layout that cannot load and still opens the documents asked for", async () => {
    const { layout } = start([source("notes", notesPart(log))], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockRejectedValue(new Error("The layout could not be read."));

    await vi.waitFor(() => expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual(["The layout could not be read."]));

    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]);
  });

  it("opens Settings the person opened before the layout loaded after the documents the parts opened while activating, so Settings is active", async () => {
    const { host, layout } = start([source("notes", notesPart(log))], [status("notes")]);
    const { read, release } = holdRead();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));

    layout.openDocument(ShellDocuments.settingsTab);
    release(null);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1"), ShellDocuments.settingsTab]));
    expect(layout.layout().documents.active).toEqual(ShellDocuments.settingsTab);
  });

  it("stops keeping the person's documents when reading the layout fails, so a document closed after that is not opened again once ready again", async () => {
    const { host, layout } = start([source("notes", notesPart(log))], [status("notes")]);
    const { read, release } = holdRead();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    layout.openDocument(ShellDocuments.settingsTab);
    release(new Error("The layout could not be read."));
    await vi.waitFor(() => expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual(["The layout could not be read."]));

    layout.close(ShellDocuments.settingsTab);
    layout.openDocument(ShellDocuments.modulesTab);
    layout.close(ShellDocuments.modulesTab);
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]);
  });

  it("keeps the person's Settings and the parts' start documents for the next read when the connection ends while reading the layout, so only the saved layout decides the start documents", async () => {
    const note = new DocumentTab("notes.note", "1");
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note);
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host, layout } = start([source("notes", notes)], [status("notes")]);
    const { read, release } = holdRead();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    layout.openDocument(ShellDocuments.settingsTab);
    read.mockResolvedValueOnce(saved.toJson());
    release(new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime."));
    await vi.waitFor(() => expect(errors.length).toBe(1));
    const before = layout.layout().documents.tabs;

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect(before).toEqual([ShellDocuments.settingsTab]);
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note, ShellDocuments.settingsTab]));
    expect(layout.layout().documents.active).toEqual(ShellDocuments.settingsTab);
    expect(TestBed.inject(TabLabelService).of(note).title).toBe("Note 1");
  });

  it("rebuilds the parts that don't continue when the runtime is ready again, deactivating them in reverse, and loads the layout only once", async () => {
    const tasks = new WindowPartFixture("tasks", log);
    const notes = notesPart(log);
    tasks.isDeactivationFailing = true;
    const { host, loads } = start([source("tasks", tasks), source("notes", notes, ["tasks"])], [status("tasks"), status("notes", ModuleState.Active, null, ["tasks"])]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    bridge.publishStartup({ kind: "Ready", details: [] });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate tasks", "activate notes", "reconnect tasks", "deactivate notes", "deactivate tasks", "activate tasks", "activate notes"]);
    expect(loads.length).toBe(1);
    expect(errors.map(t => FailureFixture.of(t, Error).message)).toEqual(["tasks did not stop"]);
    expect(host.findContribution(new ViewTab("notes.list"))?.context?.moduleId).toBe("notes");
  });

  it("destroys the live views of a part it rebuilds before deactivating the part, and keeps those of a part that continues", async () => {
    const notes = notesPart(log);
    const clock = clockPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes), source("clock", clock)], [status("notes"), status("clock")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const tabs = [new ViewTab("notes.list"), new DocumentTab("notes.note", "1"), new ViewTab("clock.list"), new DocumentTab("clock.note", "1"), ShellDocuments.settingsTab];
    vi.spyOn(TestBed.inject(LiveViewService), "destroy").mockImplementation(owns => log.push(`destroy ${tabs.filter(owns).map(t => t.name).join(",")}`));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "activate clock", "reconnect notes", "reconnect clock", "destroy clock.list", "deactivate clock", "activate clock"]);
  });

  it("keeps a part that continues when the runtime is ready again, with its context and its tabs' revisions, and moves on only the rebuilt module's tabs", async () => {
    const notes = notesPart(log);
    const clock = clockPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes), source("clock", clock)], [status("notes"), status("clock")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const tabs = [new ViewTab("notes.list"), new DocumentTab("notes.note", "1"), new ViewTab("clock.list"), ShellDocuments.settingsTab];
    const context = host.findContribution(new ViewTab("notes.list"))?.context;
    const revisions = tabs.map(t => host.revisionOf(t));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "activate clock", "reconnect notes", "reconnect clock", "deactivate clock", "activate clock"]);
    expect(host.findContribution(new ViewTab("notes.list"))?.context).toBe(context);
    expect(revisions).toEqual([1, 1, 1, 0]);
    expect(tabs.map(t => host.revisionOf(t))).toEqual([1, 1, 2, 0]);
    expect(errors).toEqual([]);
  });

  it("rebuilds a part that asks to be or fails to continue, logging the failure under its module's id, and every part that depends on a rebuilt one", async () => {
    const tasks = new WindowPartFixture("tasks", log);
    const notes = new WindowPartFixture("notes", log);
    const clock = new WindowPartFixture("clock", log);
    tasks.onReconnect = () => {
      throw new Error("tasks lost its state");
    };
    notes.onReconnect = () => true;
    const { host } = start(
      [source("tasks", tasks), source("notes", notes, ["tasks"]), source("clock", clock)],
      [status("tasks"), status("notes", ModuleState.Active, null, ["tasks"]), status("clock")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual([
      "activate tasks", "activate notes", "activate clock",
      "reconnect tasks", "reconnect clock",
      "deactivate clock", "deactivate notes", "deactivate tasks",
      "activate tasks", "activate notes", "activate clock"
    ]);
    expect(errors.map(t => [(t instanceof WindowPartFailureException ? t.moduleId : null), FailureFixture.of(t, Error).message, FailureFixture.of(FailureFixture.of(t, Error).cause, Error).message])).toEqual([
      ["tasks", "Its window part failed to continue after the runtime started again.", "tasks lost its state"]
    ]);
  });

  it("withdraws a kept part whose module is no longer active, showing its views' failure, activates a module that became active, keeps the revision of a module that stays failed and moves on one whose failure changed", async () => {
    const tabs = [new ViewTab("notes.list"), new ViewTab("clock.list"), new ViewTab("tasks.list"), new ViewTab("calendar.list")];
    const during: [number[], (string | null)[]][] = [];
    const notes = new WindowPartFixture("notes", log, t => t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load)));
    const clock = new WindowPartFixture("clock", log, t => {
      t.registerView(new ViewContribution("clock.list", "Clock", "schedule", DockSide.Right, true, load));
      const host = TestBed.inject(WindowPartHostService);
      during.push([tabs.map(u => host.revisionOf(u)), tabs.map(u => host.findFailure(u)?.cause ?? null)]);
    });
    notes.onReconnect = () => true;
    const { host } = start(
      [source("notes", notes), source("clock", clock), source("tasks", new WindowPartFixture("tasks", log)), source("calendar", new WindowPartFixture("calendar", log))],
      [status("notes"), status("clock", ModuleState.Failed, "It broke."), status("tasks", ModuleState.Failed, "It is broken."), status("calendar", ModuleState.Failed, "It did not start.")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const revisions = tabs.map(t => host.revisionOf(t));

    bridge.responses.set("desktop.modules", { payload: { modules: [
      status("notes", ModuleState.Failed, "It broke too."), status("clock"), status("tasks", ModuleState.Failed, "It is broken."), status("calendar", ModuleState.Failed, "It broke.")
    ] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "deactivate notes", "activate clock"]);
    expect(host.findFailure(new ViewTab("notes.list"))?.cause).toBe("It broke too.");
    expect(host.findContribution(new ViewTab("notes.list"))).toBeNull();
    expect(host.findContribution(new ViewTab("clock.list"))?.context?.moduleId).toBe("clock");
    expect(revisions).toEqual([1, 1, 1, 1]);
    expect(during).toEqual([[[0, 1, 1, 1], [null, null, "It is broken.", "It did not start."]]]);
    expect(tabs.map(t => host.revisionOf(t))).toEqual([2, 2, 1, 2]);
    expect(host.findFailure(new ViewTab("calendar.list"))?.cause).toBe("It broke.");
    expect(errors).toEqual([]);
  });

  it("moves on the revision of a module that stays failed when its state changes and its cause stays the same", async () => {
    const chat = (state: ModuleState): object => ({ ...status("chat", state, "It waits.", ["tasks"]), ...state === ModuleState.Blocked ? { blockedBy: "tasks" } : {} });
    const tab = new ViewTab("chat.list");
    const { host } = start([source("chat", new WindowPartFixture("chat", log), ["tasks"])], [status("tasks", ModuleState.Failed, "It broke."), chat(ModuleState.Blocked)]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const before = [host.revisionOf(tab), host.findFailure(tab)?.state];

    bridge.responses.set("desktop.modules", { payload: { modules: [status("tasks", ModuleState.Failed, "It broke."), chat(ModuleState.Failed)] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(before).toEqual([1, ModuleState.Blocked]);
    expect([host.revisionOf(tab), host.findFailure(tab)?.state]).toEqual([2, ModuleState.Failed]);
    expect(log).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("keeps a part whose dependency has no window part, with its context", async () => {
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes, ["tasks"])], [status("tasks"), status("notes", ModuleState.Active, null, ["tasks"])]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const context = host.findContribution(new ViewTab("notes.list"))?.context;

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect(host.findContribution(new ViewTab("notes.list"))?.context).toBe(context);
    expect(errors).toEqual([]);
  });

  it("activates a part without its optional dependencies and tells a part that continues when one turns on or off, as its state reads, reporting a listener that fails", async () => {
    const heard: string[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      heard.push(`start ${String(t.isDependencyActive("clock"))}`);
      t.onDependencyChanged((moduleId, isActive) => heard.push(`${moduleId} ${String(isActive)} ${String(t.isDependencyActive(moduleId))}`));
      t.onDependencyChanged(() => {
        throw new Error("The face is gone.");
      });
    });
    notes.onReconnect = () => true;
    const notesSource = new WindowPartSource("notes", [], ["notes.list"], [], [], [], [], [], () => Promise.resolve(notes), [], ["clock", "theme"]);
    const { host } = start([notesSource], [status("clock", ModuleState.Failed, "It failed."), status("notes")]);
    const reconnectAsync = async (generation: number, ...modules: readonly object[]): Promise<void> => {
      bridge.responses.set("desktop.modules", { payload: { modules } });
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
      await vi.waitFor(() => expect(host.generation()).toBe(generation));
    };
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    const first = TestBed.inject(ModuleStatusService).modules().map(t => `${t.id} ${t.state}`).join(",");
    await reconnectAsync(2, status("clock"), status("notes"));
    await reconnectAsync(3, status("clock"), status("notes"));
    await reconnectAsync(4, status("clock", ModuleState.Failed, "It failed."), status("notes"));

    expect(first).toBe("clock Failed,notes Active");
    expect(log).toEqual(["activate notes", "reconnect notes", "reconnect notes", "reconnect notes"]);
    expect(heard).toEqual(["start false", "clock true true", "clock false false"]);
    expect(errors.map(t => [(t instanceof WindowPartFailureException ? t.moduleId : null), FailureFixture.of(t, Error).message, FailureFixture.of(FailureFixture.of(t, Error).cause, Error).message])).toEqual([
      ["notes", "Its window part failed to follow a change of a module it optionally depends on.", "The face is gone."],
      ["notes", "Its window part failed to follow a change of a module it optionally depends on.", "The face is gone."]
    ]);
  });

  it("tells a part that a pass the runtime's restart cut short gave a dependency's state when that dependency comes back off, by the part's own state", async () => {
    const heard: string[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      heard.push(`start ${String(t.isDependencyActive("clock"))}`);
      t.onDependencyChanged((moduleId, isActive) => heard.push(`${moduleId} ${String(isActive)} ${String(t.isDependencyActive(moduleId))}`));
      bridge.publishStartup({ kind: "Connecting", details: [] });
    });
    notes.onReconnect = () => true;
    const notesSource = new WindowPartSource("notes", [], ["notes.list"], [], [], [], [], [], () => Promise.resolve(notes), [], ["clock"]);
    const { host } = start([notesSource], [status("clock"), status("notes"), status("theme")]);
    await vi.waitFor(() => expect(heard).toEqual(["start true"]));

    bridge.responses.set("desktop.modules", { payload: { modules: [status("clock", ModuleState.Failed, "It failed."), status("notes"), status("theme")] } });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect(heard).toEqual(["start true", "clock false false"]);
    expect(errors).toEqual([]);
  });

  it("tells a part that continues that a dependency built again across a restart of the runtime went off as its part deactivated and came on once every part is active", async () => {
    const heard: string[] = [];
    const theme = new WindowPartFixture("theme", log, t => t.onDependencyChanged((moduleId, isActive) => heard.push(`${moduleId} ${String(isActive)} after ${String(log[log.length - 1])}`)));
    theme.onReconnect = () => true;
    const { host } = start([
      source("clock", new WindowPartFixture("clock", log)),
      new WindowPartSource("theme", [], [], [], [], [], [], [], () => Promise.resolve(theme), [], ["clock"])
    ], [status("clock"), status("theme")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    log.splice(0);

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["reconnect clock", "reconnect theme", "deactivate clock", "activate clock"]);
    expect(heard).toEqual(["clock false after deactivate clock", "clock true after activate clock"]);
    expect(errors).toEqual([]);
  });

  it("gives a part, as it activates, the state of each optional dependency settled before it, and false for a module that isn't one", async () => {
    const read: string[] = [];
    const notes = new WindowPartFixture("notes", log, t => read.push(...["clock", "theme", "tasks", "notes"].map(u => `${u} ${String(t.isDependencyActive(u))}`)));
    const notesSource = new WindowPartSource("notes", ["tasks"], ["notes.list"], [], [], [], [], [], () => Promise.resolve(notes), [], ["clock", "theme"]);
    const { host } = start([notesSource], [status("tasks"), status("clock"), status("theme", ModuleState.Failed, "It failed."), status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(read).toEqual(["clock true", "theme false", "tasks false", "notes false"]);
    expect(errors).toEqual([]);
  });

  it("keeps a part's notification handles across a reconnect, so a dismissal reaches a notification the runtime still holds", async () => {
    const saved = new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null);
    bridge.responses.set("desktop.postNotification", { payload: { id: "n1" } });
    bridge.responses.set("desktop.dismissNotification", { payload: null });
    const handles: NotificationHandle[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      void t.postNotificationAsync(saved).then(u => handles.push(u));
    });
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes, [], [], [], [], [], ["notes.saved"])], [status("notes")]);
    await vi.waitFor(() => expect(handles.length).toBe(1));
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));
    handles.forEach(t => t.dismiss());
    await vi.waitFor(() => expect(bridge.requests.map(t => t[0])).toContain("desktop.dismissNotification"));
    bridge.responses.set("desktop.modules", { payload: { modules: [status("notes", ModuleState.Failed, "It broke.")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(3));

    expect(log).toEqual(["activate notes", "reconnect notes", "deactivate notes"]);
    expect(bridge.requests.filter(t => t[0].includes("Notification")).map(t => t[0]))
      .toEqual(["desktop.postNotification", "desktop.dismissNotification"]);
    expect(errors).toEqual([]);
  });

  it("stops activating its parts when the runtime drops while one activates, and activates them for the new runtime", async () => {
    let drops = 1;
    const tasks = new WindowPartFixture("tasks", log, () => {
      if (drops-- === 0)
        return;
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
    });
    const { host } = start([source("tasks", tasks), source("notes", notesPart(log))], [status("tasks"), status("notes")]);

    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(log).toEqual(["activate tasks", "reconnect tasks", "deactivate tasks", "activate tasks", "activate notes"]);
    expect(errors).toEqual([]);
  });

  it("starts over from its parts as they are when the runtime drops while a part is continuing, so no part is rebuilt twice or left half kept", async () => {
    const notes = notesPart(log);
    const clock = clockPart(log);
    let calls = 0;
    notes.onReconnect = () => {
      calls++;
      if (calls > 1)
        return true;
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
      return false;
    };
    const { host } = start([source("notes", notes), source("clock", clock)], [status("notes"), status("clock")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const context = host.findContribution(new ViewTab("notes.list"))?.context;

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "activate clock", "reconnect notes", "reconnect notes", "reconnect clock", "deactivate clock", "activate clock"]);
    expect(host.findContribution(new ViewTab("notes.list"))?.context).toBe(context);
    expect(host.findContribution(new ViewTab("clock.list"))?.context?.moduleId).toBe("clock");
    expect([host.revisionOf(new ViewTab("notes.list")), host.revisionOf(new ViewTab("clock.list"))]).toEqual([1, 2]);
    expect(errors).toEqual([]);
  });

  it("gives a module's tabs its revision only once the reload that changed the module ends", async () => {
    const during: number[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
      during.push(TestBed.inject(WindowPartHostService).revisionOf(new ViewTab("notes.list")));
    });
    const { host } = start([source("notes", notes)], [status("notes")]);

    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(during).toEqual([0]);
    expect(host.revisionOf(new ViewTab("notes.list"))).toBe(1);
  });

  it("reloads once for the newest connection when the runtime is ready again more than once before it reloads", async () => {
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    for (let index = 0; index < 2; index++) {
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
    }
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect(errors).toEqual([]);
  });

  it("leaves its parts as they are, reporting nothing, when a request fails because the runtime dropped again", async () => {
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const request = bridge.request.bind(bridge);
    let drops = 1;
    vi.spyOn(bridge, "request").mockImplementation((method, payload) => {
      if (method !== "desktop.modules" || drops-- === 0)
        return request(method, payload);
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
      return Promise.resolve({ failure: { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." } });
    });

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect(errors).toEqual([]);
  });

  it("keeps a part whose reconnection failed because the connection ended before the window heard so, reports nothing and asks it again once ready", async () => {
    const notes = notesPart(log);
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    let isDropping = true;
    notes.onReconnect = () => {
      if (!isDropping)
        return true;
      isDropping = false;
      throw new Error("Its options were not read.", { cause: new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime.") });
    };

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(log).toEqual(["activate notes", "reconnect notes"]));
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes", "reconnect notes"]);
    expect([errors, host.failures()]).toEqual([[], []]);
  });

  it("keeps its parts and reports nothing when the runtime's modules are not read because the connection ended before the window heard so", async () => {
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    bridge.responses.set("desktop.modules", { failure: { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." } });

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(bridge.requests.filter(t => t[0] === "desktop.modules").length).toBe(2));
    bridge.responses.set("desktop.modules", { payload: { modules: [status("notes")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect([errors, host.failures()]).toEqual([[], []]);
  });

  it("activates a part again once ready when its activation failed because the connection ended, without counting it failed", async () => {
    let isDropping = true;
    const notes = new WindowPartFixture("notes", log, () => {
      if (!isDropping)
        return;
      isDropping = false;
      throw new RuntimeDisconnectedException("Noldova Desktop Sample is not connected to its runtime.");
    });
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(log).toEqual(["activate notes"]));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(log).toEqual(["activate notes", "activate notes"]);
    expect([errors, host.failures()]).toEqual([[], []]);
  });

  it("loads the saved layout once ready again when reading it failed because the connection ended", async () => {
    const read = vi.spyOn(bridge, "readLayout").mockResolvedValueOnce({ failure: { code: "Disconnected", message: "Noldova Desktop Sample is not connected to its runtime." } });
    const { host, loads } = start([], []);
    await vi.waitFor(() => expect(loads.length).toBe(1));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    await vi.waitFor(() => expect(loads.length).toBe(2));
    expect(read).toHaveBeenCalledTimes(2);
    expect(errors.map(t => RuntimeDisconnectedException.isIn(t))).toEqual([true]);
  });

  it("keeps the modules it reported until the runtime reports them again", async () => {
    const seen: string[][] = [];
    let reported: () => readonly ModuleStatus[] = () => [];
    const tasks = new WindowPartFixture("tasks", log, () => {
      seen.push(reported().map(t => t.id));
    });
    const { host } = start([source("tasks", tasks)], [status("tasks")]);
    reported = () => TestBed.inject(ModuleStatusService).modules();
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    bridge.publishStartup({ kind: "Ready", details: [] });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(seen).toEqual([[], ["tasks"]]);
    expect(TestBed.inject(ModuleStatusService).modules().map(t => t.id)).toEqual(["tasks"]);
  });

  it("shows the tab a window part marks as working until the part is withdrawn", async () => {
    let marks = 0;
    const notes = new WindowPartFixture("notes", log, t => {
      if (marks++ === 0)
        t.markWorking("notes.list");
    });
    const { host } = start([source("notes", notes, [], ["notes.list"])], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const shown = labels.isWorking(new ViewTab("notes.list"));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect([shown, labels.isWorking(new ViewTab("notes.list"))]).toEqual([true, false]);
  });

  it("shows the tab a window part marks as waiting until the part is withdrawn", async () => {
    let marks = 0;
    const notes = new WindowPartFixture("notes", log, t => {
      if (marks++ === 0)
        t.markWaiting("notes.list");
    });
    const { host } = start([source("notes", notes, [], ["notes.list"])], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const shown = [labels.isWaiting(new ViewTab("notes.list")), labels.isWorking(new ViewTab("notes.list"))];

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect([shown, labels.isWaiting(new ViewTab("notes.list"))]).toEqual([[true, false], false]);
  });

  it("shows the badge a window part sets on its view, set again when the part reactivates", async () => {
    const badge = new ViewBadge(2, "2 new");
    const notes = new WindowPartFixture("notes", log, t => t.setViewBadge("notes.list", badge));
    const { host } = start([source("notes", notes, [], ["notes.list"])], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const shown = labels.badgeOf(new ViewTab("notes.list"));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(shown).toBe(badge);
    expect(labels.badgeOf(new ViewTab("notes.list"))).toBe(badge);
    expect(log).toContain("deactivate notes");
  });

  it("makes Copy follow the selection source a window part registers", async () => {
    const terminal = document.createElement("div");
    terminal.append(document.createElement("textarea"));
    document.body.append(terminal);
    terminal.querySelector("textarea")?.focus();
    const notes = new WindowPartFixture("notes", log, t => t.registerSelectionSource(terminal, { hasSelection: () => true, readSelection: () => "total 8" }));
    const { host } = start([source("notes", notes)], [status("notes")]);
    const edits = TestBed.inject(EditTargetService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const followed = edits.readSelection();
    terminal.remove();

    expect(followed).toBe("total 8");
  });

  it("passes requests to the runtime, and the runtime's events of the name listened for, until the listener stops", async () => {
    const { host } = start([], []);
    const heard: unknown[] = [];
    bridge.responses.set("notes.read", { payload: { title: "Note 1" } });

    const stop = host.onEvent("notes.changed", payload => heard.push(payload));
    bridge.publishEvent("notes.changed", { id: 1 });
    bridge.publishEvent("tasks.changed", { id: 9 });
    stop();
    bridge.publishEvent("notes.changed", { id: 2 });

    expect(await host.requestAsync("notes.read", { id: 1 })).toEqual({ title: "Note 1" });
    expect(heard).toEqual([{ id: 1 }]);
  });

  it("asks the menu service whether a module declares a dynamic menu group and passes on the items of a group it supplies", () => {
    const { host } = start([], []);
    const menus = TestBed.inject(MenuService);
    const withdraw = vi.fn();
    const declares = vi.spyOn(menus, "declaresDynamicGroup").mockReturnValue(true);
    const provide = vi.spyOn(menus, "provideGroup").mockReturnValue(withdraw);
    const provider = (): readonly MenuItem[] => [];

    expect(host.declaresDynamicMenuGroup("notes", "notes.recent")).toBe(true);
    expect(host.provideMenuGroup("notes.recent", provider)).toBe(withdraw);
    expect(declares).toHaveBeenCalledWith("notes", "notes.recent");
    expect(provide).toHaveBeenCalledWith("notes.recent", provider);
  });

  it("asks the setting options service whether a setting is a dynamic choice and passes on its options and refreshes", () => {
    const { host } = start([], []);
    const options = TestBed.inject(SettingOptionsService);
    const stop = vi.fn();
    const isDynamic = vi.spyOn(options, "isDynamic").mockReturnValue(true);
    const provide = vi.spyOn(options, "provide").mockReturnValue(stop);
    const refresh = vi.spyOn(options, "refresh").mockReturnValue(undefined);
    const provider = (): readonly SettingOption[] => [];

    expect(host.declaresDynamicSetting("notes.model")).toBe(true);
    expect(host.provideSettingOptions("notes.model", provider)).toBe(stop);
    host.refreshSettingOptions("notes.model");
    expect(isDynamic).toHaveBeenCalledWith("notes.model");
    expect(provide).toHaveBeenCalledWith("notes.model", provider);
    expect(refresh).toHaveBeenCalledWith("notes.model");
  });

  it("asks the setting check service whether a setting is a checked text and passes on its check", () => {
    const { host } = start([], []);
    const checks = TestBed.inject(SettingCheckService);
    const stop = vi.fn();
    const isChecked = vi.spyOn(checks, "isChecked").mockReturnValue(true);
    const provide = vi.spyOn(checks, "provide").mockReturnValue(stop);
    const check = (): string | null => null;

    expect(host.declaresCheckedSetting("notes.sites")).toBe(true);
    expect(host.provideSettingCheck("notes.sites", check)).toBe(stop);
    expect(isChecked).toHaveBeenCalledWith("notes.sites");
    expect(provide).toHaveBeenCalledWith("notes.sites", check);
  });

  it("does nothing before the runtime is ready", async () => {
    bridge.startup = { kind: "Connecting", details: [] };
    const { host, loads } = start([], []);
    await Promise.resolve();

    bridge.publishStartup({ kind: "WorkInProgress", details: ["Saving"] });

    expect([host.generation(), loads.length, bridge.requests.length]).toEqual([0, 0, 0]);
  });

  it("marks every module in a chain blocked by a module turned off as turned off, and one blocked by a failed module as failed", async () => {
    const { host } = start([
      source("clock", notesPart(log)),
      source("notes", notesPart(log), ["clock"]),
      source("alarm", notesPart(log), ["notes"]),
      source("radio", notesPart(log)),
      source("bell", notesPart(log), ["radio"])
    ], [
      { ...status("clock", ModuleState.Off), switchSetting: "clock.enabled" },
      { ...status("notes", ModuleState.Blocked, "It depends on clock, which is off.", ["clock"]), blockedBy: "clock" },
      { ...status("alarm", ModuleState.Blocked, "It depends on notes, which is not active.", ["notes"]), blockedBy: "notes" },
      status("radio", ModuleState.Failed, "Its runtime part failed to activate."),
      { ...status("bell", ModuleState.Blocked, "It depends on radio, which is not active.", ["radio"]), blockedBy: "radio" }
    ]);

    await vi.waitFor(() => expect(host.failures()).toHaveLength(2));

    expect(["clock", "notes", "alarm", "radio", "bell"].map(t => host.findFailure(new ViewTab(`${t}.list`))?.isTurnedOff)).toEqual([true, true, true, false, false]);
    expect(host.failures().map(t => t.moduleId)).toEqual(["radio", "bell"]);
    expect(["alarm.list", "bell.list"].map(t => TestBed.inject(TabLabelService).of(new ViewTab(t)).icon)).toEqual(["toggle_off", "error"]);
    expect(log).toEqual([]);
  });

  it("counts a module unavailable on this platform, and the modules it blocks, out of the failures, offers no switch for it and keeps its documents' cards with the block glyph", async () => {
    const { host } = start([
      source("shade", notesPart(log)),
      source("notes", notesPart(log), ["shade"]),
      source("radio", notesPart(log))
    ], [
      status("shade", ModuleState.Unavailable, "It doesn't run on Linux."),
      { ...status("notes", ModuleState.Blocked, "It depends on shade, which doesn't run on Linux.", ["shade"]), blockedBy: "shade" },
      status("radio", ModuleState.Failed, "Its runtime part failed to activate.")
    ]);

    await vi.waitFor(() => expect(host.failures()).toHaveLength(1));

    const shade = host.findFailure(new ViewTab("shade.list"));
    expect(["shade", "notes", "radio"].map(t => host.findFailure(new ViewTab(`${t}.list`))?.isTurnedOff)).toEqual([true, true, false]);
    expect([shade?.state, shade?.cause, shade?.switchSetting, host.failures().map(t => t.moduleId)]).toEqual([ModuleState.Unavailable, "It doesn't run on Linux.", null, ["radio"]]);
    expect(["shade", "notes", "radio"].map(t => host.findFailure(new DocumentTab(`${t}.note`, "1"))?.moduleId ?? null)).toEqual(["shade", null, null]);
    expect(["shade", "notes", "radio"].map(t => TestBed.inject(TabLabelService).of(new ViewTab(`${t}.list`)).icon)).toEqual(["block", "toggle_off", "error"]);
    expect(log).toEqual([]);
  });

  it("follows desktop.modulesChanged: saves and stops the parts of modules that stopped, dependents first, starts the ones that started and keeps the others", async () => {
    const heard: string[] = [];
    const clock = new WindowPartFixture("clock", log, t => {
      t.registerView(new ViewContribution("clock.list", "Clock", "schedule", DockSide.Right, true, load));
      t.registerDocument(new DocumentContribution("clock.note", load));
      t.registerSave(() => {
        log.push("save clock");
        return Promise.resolve();
      });
    });
    const notes = new WindowPartFixture("notes", log, t => t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load)));
    const theme = new WindowPartFixture("theme", log, t => t.onDependencyChanged((moduleId, isActive) => heard.push(`${moduleId} ${String(isActive)}`)));
    const on = [status("clock"), status("notes", ModuleState.Active, null, ["clock"]), status("theme")];
    const off = [
      { ...status("clock", ModuleState.Off), switchSetting: "clock.enabled" },
      { ...status("notes", ModuleState.Blocked, "It depends on clock, which is off.", ["clock"]), blockedBy: "clock", switchSetting: "notes.enabled" },
      status("theme")
    ];
    const { host } = start([
      source("clock", clock, [], ["clock.list"], [], [], [], [], ["clock.note"]),
      source("notes", notes, ["clock"]),
      new WindowPartSource("theme", [], [], [], [], [], [], [], () => Promise.resolve(theme), [], ["clock"])
    ], on);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    log.splice(0);

    bridge.publishEvent("desktop.modulesChanged", { modules: off });
    await vi.waitFor(() => expect(host.findFailure(new ViewTab("clock.list"))?.state).toBe(ModuleState.Off));
    const offView = host.findFailure(new ViewTab("clock.list"));
    const offDocument = host.findFailure(new DocumentTab("clock.note"));
    const blockedView = host.findFailure(new ViewTab("notes.list"));
    const blockedDocument = host.findFailure(new DocumentTab("notes.note"));
    const icons = ["clock.list", "notes.list"].map(t => TestBed.inject(TabLabelService).of(new ViewTab(t)).icon);
    const failures = host.failures().map(t => t.moduleId);
    const stopped = log.splice(0);
    bridge.publishEvent("desktop.modulesChanged", { modules: on });
    await vi.waitFor(() => expect(host.findFailure(new ViewTab("notes.list"))).toBeNull());

    expect(stopped).toEqual(["save clock", "deactivate notes", "deactivate clock"]);
    expect([offView?.switchSetting, offDocument?.moduleId, blockedView?.state, blockedView?.cause, blockedView?.switchSetting, blockedDocument])
      .toEqual(["clock.enabled", "clock", ModuleState.Blocked, "It depends on clock, which is off.", null, null]);
    expect([failures, offView?.isTurnedOff, blockedView?.isTurnedOff]).toEqual([[], true, true]);
    expect(icons).toEqual(["toggle_off", "toggle_off"]);
    expect(log).toEqual(["activate clock", "activate notes"]);
    expect(heard).toEqual(["clock false", "clock true"]);
    expect(host.findContribution(new ViewTab("clock.list"))?.context?.moduleId).toBe("clock");
    expect(TestBed.inject(ModuleStatusService).modules().map(t => `${t.id} ${t.state}`)).toEqual(["clock Active", "notes Active", "theme Active"]);
    expect([host.generation(), bridge.requests.filter(t => t[0] === "desktop.commands").length]).toEqual([1, 3]);
    expect(errors).toEqual([]);
  });

  for (const [kind, hasPart] of [["with a window part", true], ["only in the runtime", false]] as const)
    it(`tells a kept part that a dependency ${kind} went off as soon as it stops, so a module the same pass starts later reads it off there, reporting a listener that fails`, async () => {
      const heard: string[] = [];
      const contexts: IWindowPartContext[] = [];
      const theme = new WindowPartFixture("theme", log, t => {
        contexts.push(t);
        t.onDependencyChanged((moduleId, isActive) => heard.push(`theme hears ${moduleId} ${String(isActive)}`));
        t.onDependencyChanged(() => {
          throw new Error("The face is gone.");
        });
      });
      const radio = new WindowPartFixture("radio", log, () => heard.push(`radio starts, theme reads clock ${String(contexts[0]?.isDependencyActive("clock"))}`));
      const { host } = start([
        ...(hasPart ? [source("clock", new WindowPartFixture("clock", log))] : []),
        new WindowPartSource("theme", [], [], [], [], [], [], [], () => Promise.resolve(theme), [], ["clock"]),
        source("radio", radio)
      ], [status("clock"), status("theme"), { ...status("radio", ModuleState.Off), switchSetting: "radio.enabled" }]);
      await vi.waitFor(() => expect(host.generation()).toBe(1));
      log.splice(0);

      bridge.publishEvent("desktop.modulesChanged", { modules: [{ ...status("clock", ModuleState.Off), switchSetting: "clock.enabled" }, status("theme"), status("radio")] });
      await vi.waitFor(() => expect(TestBed.inject(ModuleStatusService).modules().map(t => `${t.id} ${t.state}`)).toEqual(["clock Off", "theme Active", "radio Active"]));

      expect(log).toEqual([...(hasPart ? ["deactivate clock"] : []), "activate radio"]);
      expect(heard).toEqual(["theme hears clock false", "radio starts, theme reads clock false"]);
      expect(errors.map(t => t instanceof WindowPartFailureException ? [t.moduleId, t.message, t.cause instanceof Error ? t.cause.message : null] : t)).toEqual([
        ["theme", "Its window part failed to follow a change of a module it optionally depends on.", "The face is gone."]
      ]);
    });

  it("brings a document a running part opens while modules switch to the front once the switch ends, and restores those a part the switch starts opens", async () => {
    const asked: (() => void)[] = [];
    const clock = new WindowPartFixture("clock", log, t => {
      t.registerDocument(new DocumentContribution("clock.note", load));
      t.openDocument("clock.note", "1", "Clock 1");
      asked.forEach(u => u());
    });
    const notes = new WindowPartFixture("notes", log, t => t.registerDocument(new DocumentContribution("notes.note", load)));
    const { host, layout } = start([source("clock", clock, [], []), source("notes", notes, [], [])],
      [{ ...status("clock", ModuleState.Off), switchSetting: "clock.enabled" }, status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    for (const instance of ["1", "2"])
      host.openDocument("notes", "notes.note", instance, new DocumentHeading(`Note ${instance}`), false);
    asked.push(() => host.openDocument("notes", "notes.note", "1", new DocumentHeading("Note 1"), true));
    const before = layout.layout().documents.active;

    bridge.publishEvent("desktop.modulesChanged", { modules: [status("clock"), status("notes")] });
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toContainEqual(new DocumentTab("clock.note", "1")));

    expect(before).toEqual(new DocumentTab("notes.note", "2"));
    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1"), new DocumentTab("notes.note", "2"), new DocumentTab("clock.note", "1")]);
    expect(layout.layout().documents.active).toEqual(new DocumentTab("notes.note", "1"));
  });

  it("leaves the active tab as it is when the only document opened while modules switch is one a part the switch starts opens while it activates", async () => {
    const clock = new WindowPartFixture("clock", log, t => {
      t.registerDocument(new DocumentContribution("clock.note", load));
      t.openDocument("clock.note", "1", "Clock 1");
    });
    const notes = new WindowPartFixture("notes", log, t => t.registerDocument(new DocumentContribution("notes.note", load)));
    const { host, layout } = start([source("clock", clock, [], []), source("notes", notes, [], [])],
      [{ ...status("clock", ModuleState.Off), switchSetting: "clock.enabled" }, status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    for (const instance of ["1", "2"])
      host.openDocument("notes", "notes.note", instance, new DocumentHeading(`Note ${instance}`), false);

    bridge.publishEvent("desktop.modulesChanged", { modules: [status("clock"), status("notes")] });
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toContainEqual(new DocumentTab("clock.note", "1")));

    expect(layout.layout().documents.active).toEqual(new DocumentTab("notes.note", "2"));
  });

  it("brings a document a part the switch started opens after its activation, while a later part still activates, to the front once the switch ends", async () => {
    let clockContext: IWindowPartContext | null = null;
    const clock = new WindowPartFixture("clock", log, t => {
      t.registerDocument(new DocumentContribution("clock.note", load));
      t.openDocument("clock.note", "1", "Clock 1");
      clockContext = t;
    });
    const radio = new WindowPartFixture("radio", log, () => clockContext?.openDocument("clock.note", "2", "Clock 2"));
    const notes = new WindowPartFixture("notes", log, t => t.registerDocument(new DocumentContribution("notes.note", load)));
    const { host, layout } = start([source("clock", clock, [], []), source("radio", radio, [], [], [], [], [], [], []), source("notes", notes, [], [])],
      [{ ...status("clock", ModuleState.Off), switchSetting: "clock.enabled" }, { ...status("radio", ModuleState.Off), switchSetting: "radio.enabled" }, status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    host.openDocument("notes", "notes.note", "1", new DocumentHeading("Note 1"), false);
    log.splice(0);

    bridge.publishEvent("desktop.modulesChanged", { modules: [status("clock"), status("radio"), status("notes")] });
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toContainEqual(new DocumentTab("clock.note", "2")));

    expect(log).toEqual(["activate clock", "activate radio"]);
    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1"), new DocumentTab("clock.note", "1"), new DocumentTab("clock.note", "2")]);
    expect(layout.layout().documents.active).toEqual(new DocumentTab("clock.note", "2"));
  });

  it("keeps a part that failed for its own reasons as it is on a switch, stops a part whose save fails, reports a malformed modulesChanged and drops one the runtime left", async () => {
    let brokenLoads = 0;
    const broken = new WindowPartSource("broken", [], ["broken.list"], [], [], [], [], [], () => {
      brokenLoads++;
      return Promise.reject(new Error("The part broke."));
    });
    const clock = new WindowPartFixture("clock", log, t => t.registerSave(() => Promise.reject(new Error("The clock would not save."))));
    const clockOff = { ...status("clock", ModuleState.Off), switchSetting: "clock.enabled" };
    const radioOff = { ...status("radio", ModuleState.Off), switchSetting: "radio.enabled" };
    const { host } = start([broken, source("clock", clock)], [status("broken"), status("clock"), radioOff]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    errors.splice(0);
    log.splice(0);
    const brokenCause = host.findFailure(new ViewTab("broken.list"))?.cause;
    const request = bridge.request.bind(bridge);
    let releaseCommands: (value: unknown) => void = () => undefined;
    const commands = new Promise<unknown>(resolve => {
      releaseCommands = resolve;
    });

    bridge.publishEvent("desktop.modulesChanged", "not a list");
    bridge.publishEvent("desktop.modulesChanged", { modules: [status("broken"), clockOff, radioOff] });
    await vi.waitFor(() => expect(host.findFailure(new ViewTab("clock.list"))?.state).toBe(ModuleState.Off));
    const switched = [brokenLoads, host.findFailure(new ViewTab("broken.list"))?.cause, log.splice(0)];
    vi.spyOn(bridge, "request").mockImplementation((method, payload) => method === "desktop.commands" ? commands : request(method, payload));
    bridge.publishEvent("desktop.modulesChanged", { modules: [status("broken"), status("clock"), radioOff] });
    await vi.waitFor(() => expect(bridge.request).toHaveBeenCalledWith("desktop.commands", null));
    bridge.publishStartup({ kind: "Connecting", details: [] });
    releaseCommands(await request("desktop.commands", null));
    bridge.responses.set("desktop.modules", { payload: { modules: [status("broken"), clockOff, radioOff] } });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(switched).toEqual([1, brokenCause, ["deactivate clock"]]);
    expect(log).toEqual([]);
    expect(errors[0]).toBeInstanceOf(Error);
    expect(errors.slice(1, 2).map(t => [(t instanceof WindowPartFailureException ? t.moduleId : null), FailureFixture.of(t, Error).message, FailureFixture.of(FailureFixture.of(t, Error).cause, Error).message]))
      .toEqual([["clock", "Its window part failed to save while Noldova Desktop Sample was closing.", "The clock would not save."]]);
    expect(host.findFailure(new ViewTab("broken.list"))?.state).toBe(ModuleState.Failed);
    expect(TestBed.inject(ModuleStatusService).modules().map(t => `${t.id} ${t.state}`)).toEqual(["broken Failed", "clock Off", "radio Off"]);
    expect(host.failures().map(t => t.moduleId)).toEqual(["broken"]);
  });
});
