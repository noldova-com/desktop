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

import { BottomDockSpan } from "../../../src/app/enums/bottom-dock-span";
import { DockSide } from "../../../src/app/enums/dock-side";
import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { SplitAxis } from "../../../src/app/enums/split-axis";
import { BuildTokens } from "../../../src/app/models/build-tokens";
import { DocumentHeading } from "../../../src/app/models/document-heading";
import { DocumentLook } from "../../../src/app/models/document-look";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { LayoutMetrics } from "../../../src/app/models/layout/layout-metrics";
import { LayoutReader } from "../../../src/app/services/layout.reader";
import { ToolbarLayout } from "../../../src/app/models/layout/toolbar-layout";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { SideDropTarget } from "../../../src/app/models/layout/side-drop-target";
import { SplitDropTarget } from "../../../src/app/models/layout/split-drop-target";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutMetricsFixture } from "../../fixtures/layout-metrics.fixture";

describe("LayoutService", () => {
  let bridge: PreloadBridgeFixture;

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  let service: LayoutService;
  let store: LayoutStoreService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(LayoutService);
    service.setMetrics(LayoutMetricsFixture.standard);
    store = TestBed.inject(LayoutStoreService);
    service.setRegistry(registry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (vi.isFakeTimers())
      vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  function prepared(): Layout {
    return Layout.createDefault(registry).openView(LayoutFixture.terminal, registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo);
  }

  async function loadAsync(layout: Layout): Promise<void> {
    await store.writeAsync(layout.toJson());
    await service.loadAsync();
  }

  it("tells its listeners each change before it takes effect, with the layouts before and after, until a listener stops", async () => {
    await loadAsync(prepared());
    const changes: unknown[][] = [];
    const stop = service.onChange((from, to) => changes.push([from === service.layout(), to.groupOf(LayoutFixture.todo)?.id !== from.groupOf(LayoutFixture.todo)?.id]));

    service.place(LayoutFixture.todo, new SplitDropTarget(service.layout().documents.id, PanelEdge.Right));
    const after = changes.length;
    stop();
    service.close(LayoutFixture.plan);

    expect([after, changes]).toEqual([1, [[true, true]]]);
  });

  it("starts empty and computes the geometry from the registry and the viewport", () => {
    expect(service.registry()).toBe(registry);
    expect(service.layout().groups.map(t => t.id)).toEqual([0]);
    service.setViewport(120, 60);

    expect(service.geometry().middle.width).toBeGreaterThan(0);
    expect(service.geometry().frames.map(t => t.group.id)).toEqual([0]);
  });

  it("lays out again with the metrics it is given, and resizes a dock to no less than their dock minimum", async () => {
    await loadAsync(Layout.createDefault(registry));
    service.setViewport(120, 60);
    service.resizeDock(DockSide.Bottom, 4);
    const standard = [service.geometry().dock(DockSide.Left).width, service.geometry().dock(DockSide.Right).width, service.layout().dock(DockSide.Bottom).size];

    service.setMetrics(new LayoutMetrics(0.5, 0.5, 8, 3, 12, { [SplitAxis.Horizontal]: 9, [SplitAxis.Vertical]: 5 }, { [DockSide.Left]: 20, [DockSide.Right]: 18, [DockSide.Bottom]: 12 }));
    service.resizeDock(DockSide.Bottom, 4);

    expect(standard).toEqual([26, 25, 10]);
    expect([service.geometry().dock(DockSide.Left).width, service.geometry().dock(DockSide.Right).width, service.layout().dock(DockSide.Bottom).size]).toEqual([20, 18, 8]);
    expect(service.geometry().dock(DockSide.Left).x).toBe(0.5);
  });

  it("puts a dock back to a size it had, and to its default size for none", async () => {
    await loadAsync(prepared());
    service.setViewport(120, 60);
    service.resizeDock(DockSide.Bottom, 20);

    service.restoreDock(DockSide.Bottom, 12);
    const restored = service.layout().dock(DockSide.Bottom).size;
    service.restoreDock(DockSide.Bottom, null);

    expect([restored, service.layout().dock(DockSide.Bottom).size]).toEqual([12, null]);
  });

  it("opens again in the restored layout the documents the person opened before it, the last one active, and changes nothing else", async () => {
    const saved = Layout.createDefault(registry).openDocument(LayoutFixture.plan);
    await store.writeAsync(saved.toJson());
    service.openDocument(LayoutFixture.todo);
    service.openDocument(LayoutFixture.plan);
    service.toggleDock(DockSide.Left);

    await service.loadAsync();
    service.reopenEarlyDocuments();

    expect(service.layout().documents.tabs).toEqual([LayoutFixture.plan, LayoutFixture.todo]);
    expect(service.layout().documents.active).toEqual(LayoutFixture.plan);
    expect(service.layout().dock(DockSide.Left)).toEqual(saved.dock(DockSide.Left));
  });

  it("opens again without activating a document opened so before the layout loaded", async () => {
    await store.writeAsync(Layout.createDefault(registry).openDocument(LayoutFixture.plan).toJson());
    service.openDocument(LayoutFixture.todo, false, null, false);

    await service.loadAsync();
    service.reopenEarlyDocuments();

    expect([service.layout().documents.tabs, service.layout().documents.active]).toEqual([[LayoutFixture.plan, LayoutFixture.todo], LayoutFixture.plan]);
  });

  it("opens them again right after the document each named, when the restored layout holds it", async () => {
    const readme = new DocumentTab("notes.note", "readme");
    await store.writeAsync(Layout.createDefault(registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.settings).toJson());
    service.openDocument(LayoutFixture.todo, false, LayoutFixture.plan);
    service.openDocument(readme, false, new DocumentTab("notes.note", "gone"));

    await service.loadAsync();
    service.reopenEarlyDocuments();

    expect(service.layout().documents.tabs).toEqual([LayoutFixture.plan, LayoutFixture.todo, LayoutFixture.settings, readme]);
  });

  it("opens them again in the default layout when none was saved, leaving out one the person closed before the layout loaded", async () => {
    service.openDocument(LayoutFixture.todo);
    service.openDocument(LayoutFixture.plan);
    service.close(LayoutFixture.plan);

    await service.loadAsync();
    const loaded = service.layout().documents.tabs;
    service.reopenEarlyDocuments();

    expect(loaded).toEqual([]);
    expect(service.layout().documents.tabs).toEqual([LayoutFixture.todo]);
  });

  it("opens them again only once, and keeps no document opened after the layout loaded", async () => {
    service.openDocument(LayoutFixture.todo);
    await service.loadAsync();
    service.reopenEarlyDocuments();
    service.close(LayoutFixture.todo);
    service.openDocument(LayoutFixture.plan);
    service.close(LayoutFixture.plan);

    service.reopenEarlyDocuments();
    await service.loadAsync();
    service.reopenEarlyDocuments();

    expect(service.layout().documents.tabs).toEqual([]);
  });

  it("stops keeping documents once told to open them again without a load, as after a layout that cannot be read", async () => {
    service.reopenEarlyDocuments();
    service.openDocument(LayoutFixture.todo);

    await service.loadAsync();
    service.reopenEarlyDocuments();

    expect(service.layout().documents.tabs).toEqual([]);
  });

  function closed(): readonly DockSide[] {
    return [...service.geometry().closedSides];
  }

  it("closes the side docks a narrow window cannot hold, right first, and reopens them only past the margin", async () => {
    await loadAsync(Layout.createDefault(registry));

    const widths = [50, 52, 53, 40].map(t => {
      service.setViewport(t, 40);
      return closed();
    });

    expect(widths).toEqual([[DockSide.Right], [DockSide.Right], [], [DockSide.Right, DockSide.Left]]);
  });

  it("keeps open the dock the person opens until the window grows so it would stay open anyway", async () => {
    await loadAsync(Layout.createDefault(registry));
    service.setViewport(40, 40);

    service.keepOpen(DockSide.Left);
    service.keepOpen(DockSide.Bottom);
    const kept = closed();
    service.setViewport(41, 40);
    const stillKept = closed();
    service.setViewport(60, 40);
    service.setViewport(40, 40);

    expect([kept, stillKept]).toEqual([[DockSide.Right], [DockSide.Right]]);
    expect(closed()).toEqual([DockSide.Right, DockSide.Left]);
  });

  it("opens the bottom dock a short window closed from its toggle and keeps it open until the window grows so it would stay open anyway", async () => {
    await loadAsync(Layout.createDefault(registry).openView(LayoutFixture.terminal, registry));
    service.setViewport(120, 21.25);
    const short = closed();

    service.toggleDock(DockSide.Bottom);
    const toggled = [closed(), service.geometry().dock(DockSide.Bottom).height, service.layout().dock(DockSide.Bottom).isCollapsed];
    service.setViewport(120, 26);
    const grown = closed();
    service.setViewport(120, 26.25);
    service.setViewport(120, 21.25);

    expect([short, toggled, grown]).toEqual([[DockSide.Bottom], [[], 7, false], []]);
    expect(closed()).toEqual([DockSide.Bottom]);
  });

  it("keeps the middle a side dock's drag leaves under its preferred size as the window narrows, and forgets it once a drag gives the middle that size again without moving the other dock", async () => {
    await loadAsync(Layout.createDefault(registry));
    service.setViewport(100, 40);
    const before = [service.layout().middleSize, service.geometry().middle.width];

    service.resizeDock(DockSide.Left, 56);
    service.resizeDock(DockSide.Bottom, 12);
    const dragged = [service.layout().middleSize, service.geometry().middle.width];
    service.setViewport(80, 40);
    const narrowed = [service.geometry().middle.width, service.geometry().dock(DockSide.Left).width, service.geometry().dock(DockSide.Right).width];
    service.resizeDock(DockSide.Left, 31);

    expect([before, dragged, narrowed]).toEqual([[null, 48], [18, 18], [18, 51, 10]]);
    expect([service.layout().middleSize, service.geometry().middle.width, service.layout().dock(DockSide.Right).size]).toEqual([null, 38, 10]);
  });

  it("saves the other open side dock at the width it shows when a drag would otherwise move it, and leaves a hidden one as it is", async () => {
    await loadAsync(Layout.createDefault(registry));
    service.setViewport(62, 40);
    const shown = (): number[] => [service.geometry().dock(DockSide.Left).width, service.geometry().dock(DockSide.Right).width, service.geometry().middle.width];
    const before = shown();

    service.resizeDock(DockSide.Right, 11);
    const dragged = shown();
    const saved = [service.layout().dock(DockSide.Left).size, service.layout().middleSize];
    service.toggleDock(DockSide.Left);
    service.resizeDock(DockSide.Right, 12);
    service.toggleDock(DockSide.Left);

    expect([before, dragged, saved]).toEqual([[21, 10, 30], [21, 11, 29], [21, 29]]);
    expect([service.layout().dock(DockSide.Left).size, service.layout().dock(DockSide.Right).size]).toEqual([21, 12]);
  });

  it("keeps a dock open beside one the person hid, opens a closed dock when its command runs, releases a kept dock the person hides and opens it again in one press", async () => {
    await loadAsync(Layout.createDefault(registry).toggleDock(DockSide.Right));
    service.setViewport(40, 40);
    const before = closed();

    service.keepOpen(DockSide.Left);
    service.setViewport(40.0625, 40);
    service.setViewport(40, 40);
    const kept = closed();
    service.toggleDock(DockSide.Left);
    const hidden = [closed(), service.layout().dock(DockSide.Left).isExpanded];
    service.toggleDock(DockSide.Left);
    const reopened = [closed(), service.layout().dock(DockSide.Left).isExpanded];
    service.setViewport(60, 40);
    service.setViewport(40, 40);

    expect([before, kept, hidden, reopened]).toEqual([[DockSide.Left], [], [[], false], [[], true]]);
    expect(closed()).toEqual([DockSide.Left]);
  });

  it("hides the dock a part asks to hide even while the window has it closed or keeps it open, so it stays hidden once the window has room, and its toggle opens it again in one press", async () => {
    await loadAsync(Layout.createDefault(registry).openView(LayoutFixture.terminal, registry));
    service.setViewport(120, 21.25);
    const short = closed();
    const isHidden = (): boolean => service.layout().dock(DockSide.Bottom).isCollapsed;
    const height = (): number => service.geometry().dock(DockSide.Bottom).height;

    service.hideDock(DockSide.Bottom);
    service.setViewport(120, 30);
    const hiddenWhenClosed = [isHidden(), closed(), height()];
    service.setViewport(120, 21.25);
    service.toggleDock(DockSide.Bottom);
    const opened = [closed(), height(), isHidden()];
    service.hideDock(DockSide.Bottom);
    const hidden = service.layout();
    service.hideDock(DockSide.Bottom);
    const isUnchanged = service.layout() === hidden;
    service.setViewport(120, 30);

    expect([short, hiddenWhenClosed, opened, isUnchanged, [isHidden(), height()]]).toEqual([[DockSide.Bottom], [true, [], 2.75], [[], 7, false], true, [true, 2.75]]);
  });

  it("loads the saved layout, the default when nothing is saved and the default for an unreadable one, and tells whether it restored one", async () => {
    expect(await service.loadAsync()).toBe(false);
    expect(service.layout().toJson()).toEqual(Layout.createDefault(registry).toJson());

    await store.writeAsync(prepared().toJson());
    expect(await service.loadAsync()).toBe(true);
    expect(service.layout().toJson()).toEqual(prepared().toJson());

    await store.writeAsync({ version: 99 });
    expect(await service.loadAsync()).toBe(false);
    expect(service.layout().toJson()).toEqual(Layout.createDefault(registry).toJson());
  });

  it("passes on a failure other than an unreadable layout", async () => {
    const failure = new Error("read failed");
    vi.spyOn(LayoutReader, "read").mockImplementation(() => {
      throw failure;
    });
    await store.writeAsync({ version: 1 });

    await expect(service.loadAsync()).rejects.toBe(failure);
  });

  it("changes the layout through the model and saves it after a pause", async () => {
    await loadAsync(prepared());
    service.setViewport(120, 60);
    const terminal = LayoutFixture.terminal;

    service.place(terminal, new SideDropTarget(DockSide.Right));
    expect(service.layout().sideOf(service.layout().groupOf(terminal)?.id ?? -1)).toBe(DockSide.Right);
    service.activate(LayoutFixture.plan);
    expect(service.layout().documents.active).toEqual(LayoutFixture.plan);
    service.close(LayoutFixture.todo);
    expect(service.layout().isOpen(LayoutFixture.todo)).toBe(false);
    service.openDocument(LayoutFixture.settings);
    expect(service.layout().documents.active).toEqual(LayoutFixture.settings);
    service.toggleDock(DockSide.Left);
    expect(service.layout().dock(DockSide.Left).isCollapsed).toBe(true);
    service.resizeDock(DockSide.Left, 30);
    expect(service.layout().dock(DockSide.Left).size).toBe(30);
    expect(await store.readAsync()).toEqual(prepared().toJson());

    vi.advanceTimersByTime(499);
    expect(await store.readAsync()).toEqual(prepared().toJson());
    vi.advanceTimersByTime(1);
    await vi.waitFor(async () => expect(await store.readAsync()).toEqual(service.layout().toJson()));
  });

  it("keeps the toolbar arrangement it is given and returns to the declared one on a reset", async () => {
    await loadAsync(prepared());

    service.setToolbars(new ToolbarLayout([["notes.main"]], ["notes.spare"]));

    expect(service.layout().toolbars.rows).toEqual([["notes.main"]]);
    expect(service.layout().toolbars.hidden).toEqual(["notes.spare"]);
    service.reset();
    expect(service.layout().toolbars.isEmpty).toBe(true);
  });

  it("closes several tabs at once, passing over a tab that is not open, and drops the closed documents' looks", async () => {
    await loadAsync(prepared());
    const labels = TestBed.inject(TabLabelService);
    const look = DocumentLook.none.updated({ underline: "Shared" });
    const kept = new DocumentTab("notes.kept", "1");
    [LayoutFixture.plan, LayoutFixture.todo, kept].forEach(t => labels.setLook(t, look));

    service.closeTabs([LayoutFixture.plan, LayoutFixture.settings]);
    service.close(LayoutFixture.todo);

    expect(service.layout().documents.tabs).toEqual([]);
    expect(service.layout().isOpen(LayoutFixture.files)).toBe(true);
    expect([LayoutFixture.plan, LayoutFixture.todo, kept].map(t => labels.lookOf(t))).toEqual([DocumentLook.none, DocumentLook.none, look]);
  });

  it("makes the group of an activated or focused tab the current group, keeping it when an absent tab is activated", async () => {
    await loadAsync(prepared());
    expect(service.currentGroup()).toBe(service.layout().documents);

    service.activate(LayoutFixture.files);
    const left = service.layout().groupOf(LayoutFixture.files);
    service.activate(new ViewTab("gone.view"));

    expect(service.currentGroup()).toBe(left);
    service.focusGroup(service.layout().documents.id);
    expect(service.currentGroup()).toBe(service.layout().documents);
  });

  it("numbers each tab it reveals by opening or activating it", async () => {
    expect(service.revealed()).toBeNull();
    await loadAsync(prepared());
    const start = service.revealed()?.sequence ?? 0;

    service.openDocument(LayoutFixture.plan);
    const opened = service.revealed();
    service.activate(LayoutFixture.files);

    expect([opened?.tab.key, opened?.sequence]).toEqual([LayoutFixture.plan.key, start + 1]);
    expect([service.revealed()?.tab.key, service.revealed()?.sequence]).toEqual([LayoutFixture.files.key, start + 2]);
  });

  it("reveals no document it opens without activating", async () => {
    const readme = new DocumentTab("notes.note", "readme");
    await loadAsync(prepared());
    service.openDocument(LayoutFixture.plan);
    const opened = service.revealed();

    service.openDocument(readme, false, null, false);

    expect(service.revealed()).toBe(opened);
    expect([service.layout().documents.tabs, service.layout().documents.active]).toEqual([[LayoutFixture.plan, LayoutFixture.todo, readme], LayoutFixture.plan]);
  });

  it("resizes a split through its handle", async () => {
    await loadAsync(prepared());
    service.setViewport(160, 80);
    service.place(LayoutFixture.terminal, new SplitDropTarget(0, PanelEdge.Right));
    const handle = service.geometry().handles[0];
    if (Object.isUndefined(handle))
      throw new Error("The split has no handle.");

    service.resizeSplit(handle, handle.leadingLength + 4);

    expect(service.geometry().handles[0]?.leadingLength).toBeCloseTo(handle.leadingLength + 4);
  });

  it("opens a document as a preview only while Preview tabs is on, even when a module asks for one, and turning it off keeps the open preview", async () => {
    const readme = new DocumentTab("notes.note", "readme");
    const third = new DocumentTab("notes.note", "third");
    const fourth = new DocumentTab("notes.note", "fourth");
    const setPreviewTabs = (value: boolean): void => {
      bridge.publishEvent("desktop.settingsChanged", { name: "desktop.previewTabs", value, isSet: true });
      TestBed.tick();
    };
    await loadAsync(prepared());

    service.openDocument(LayoutFixture.settings, true);
    expect([service.previewTabs(), service.layout().documents.preview]).toEqual([true, LayoutFixture.settings]);
    setPreviewTabs(false);
    expect([service.previewTabs(), service.layout().documents.preview, service.layout().isOpen(LayoutFixture.settings)]).toEqual([false, null, true]);
    service.openDocument(readme, true);
    expect([service.layout().documents.preview, service.layout().documents.tabs.at(-1)]).toEqual([null, readme]);
    service.openDocument(LayoutFixture.settings);
    expect(service.layout().documents.preview).toBeNull();
    setPreviewTabs(true);
    service.openDocument(third, true);
    service.openDocument(fourth, true);
    expect([service.previewTabs(), service.layout().documents.preview, service.layout().isOpen(third), service.layout().isOpen(readme)]).toEqual([true, fourth, false, true]);
  });

  it("keeps the preview of a layout loaded while Preview tabs is off", async () => {
    const readme = new DocumentTab("notes.note", "readme");
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.previewTabs", value: false, isSet: true });
    TestBed.tick();

    await loadAsync(prepared().openDocument(readme, true));
    TestBed.tick();

    expect([service.layout().isOpen(readme), service.layout().documents.preview]).toEqual([true, null]);
  });

  it("restores which documents group is active, so a document opens there", async () => {
    const readme = new DocumentTab("notes.note", "readme");
    const split = prepared().splitGroup(LayoutFixture.todo, 0, PanelEdge.Right);
    const first = split.documentGroups[0];
    await loadAsync(split.focusDocuments(first?.id ?? -1));

    expect([service.layout().documents.id, service.layout().documentGroups.length]).toEqual([first?.id, 2]);
    service.openDocument(readme);
    expect(service.layout().groupOf(readme)?.id).toBe(first?.id);
  });

  it("spans the bottom dock across the window or keeps it between the side docks", async () => {
    await loadAsync(prepared().openView(LayoutFixture.terminal, LayoutFixture.createRegistry()));
    service.setViewport(160, 80);
    const full = service.geometry().dock(DockSide.Bottom).width;

    service.setBottomSpan(BottomDockSpan.Between);

    expect(service.layout().bottomSpan).toBe(BottomDockSpan.Between);
    expect(service.geometry().dock(DockSide.Bottom).width).toBeLessThan(full);
  });

  it("resets the layout to the default and keeps open documents", async () => {
    await loadAsync(prepared().dockOnSide(LayoutFixture.files, DockSide.Right));

    service.reset();

    expect(service.layout().dock(DockSide.Left).root?.groups.flatMap(t => t.tabs)).toEqual([LayoutFixture.files]);
    expect(service.layout().documents.tabs).toEqual([LayoutFixture.plan, LayoutFixture.todo]);
  });

  it("saves at once on request, ignores changes that change nothing and stops its timer when destroyed", async () => {
    await loadAsync(prepared());
    service.activate(LayoutFixture.plan);
    await service.saveAsync();
    expect(await store.readAsync()).toEqual(service.layout().toJson());

    const before = service.layout();
    service.activate(LayoutFixture.plan);
    expect(service.layout()).toBe(before);

    service.close(LayoutFixture.todo);
    const saved = await store.readAsync();
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(500);
    expect(await store.readAsync()).toEqual(saved);
  });

  it("saves nothing before a layout was loaded, so a window that never loaded cannot replace the kept layout", async () => {
    const write = vi.spyOn(store, "writeAsync");

    service.toggleDock(DockSide.Left);
    vi.advanceTimersByTime(500);
    await service.saveAsync();

    expect(write).not.toHaveBeenCalled();
  });

  it("stays unloaded when the kept layout cannot be read, and passes the failure on", async () => {
    const failure = new Error("The kept layout could not be read.");
    vi.spyOn(store, "readAsync").mockRejectedValue(failure);
    const write = vi.spyOn(store, "writeAsync");

    await expect(service.loadAsync()).rejects.toBe(failure);
    service.toggleDock(DockSide.Left);
    vi.advanceTimersByTime(500);
    await service.saveAsync();

    expect(write).not.toHaveBeenCalled();
  });

  it("saves each open document's title with the layout, and saves again after a pause when only a title changes", async () => {
    await loadAsync(prepared());
    const labels = TestBed.inject(TabLabelService);
    const write = vi.spyOn(store, "writeAsync");
    labels.setHeading(LayoutFixture.plan, new DocumentHeading("Plan", ["Notes"]));
    labels.setTitle(LayoutFixture.terminal, "Shell");
    labels.setTitle(LayoutFixture.settings, "Settings");
    TestBed.tick();
    vi.advanceTimersByTime(500);
    await vi.waitFor(async () => expect(await store.readAsync()).toEqual({ ...prepared().toJson(), titles: { [LayoutFixture.plan.key]: "Plan" } }));

    labels.setTitle(LayoutFixture.todo, "Todo");
    TestBed.tick();
    vi.advanceTimersByTime(500);
    await vi.waitFor(async () => expect(await store.readAsync()).toEqual({ ...prepared().toJson(), titles: { [LayoutFixture.plan.key]: "Plan", [LayoutFixture.todo.key]: "Todo" } }));
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(2);
  });

  it("restores the saved titles of the documents it holds, keeps a title given before it loaded, and saves nothing for them", async () => {
    const labels = TestBed.inject(TabLabelService);
    const gone = new DocumentTab("notes.note", "gone");
    await store.writeAsync({
      ...prepared().toJson(),
      titles: { [LayoutFixture.plan.key]: "Plan", [LayoutFixture.todo.key]: "Saved todo", [LayoutFixture.terminal.key]: "Shell", [gone.key]: "Gone" }
    });
    labels.setTitle(LayoutFixture.todo, "Todo");
    const write = vi.spyOn(store, "writeAsync");

    expect(await service.loadAsync()).toBe(true);
    TestBed.tick();
    vi.advanceTimersByTime(500);
    await service.saveAsync();

    expect([LayoutFixture.plan, LayoutFixture.todo, LayoutFixture.terminal, gone].map(t => labels.titleOf(t))).toEqual(["Plan", "Todo", null, null]);
    expect(write).not.toHaveBeenCalled();
  });

  it("reopens a tab saved under a former name of a document in the build as that document, with its title", async () => {
    const sheet = new DocumentTab("notes.sheet", "plan");
    const load = (): Promise<IWindowPart> => Promise.reject(new Error("The part was not loaded."));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: BuildTokens.sources, useValue: [new WindowPartSource("notes", [], [], ["notes.note"], [], [], [], [], load, [], [], [], [["notes.sheet", "notes.note"]])] }]
    });
    const moved = TestBed.inject(LayoutService);
    moved.setMetrics(LayoutMetricsFixture.standard);
    moved.setRegistry(registry);
    const labels = TestBed.inject(TabLabelService);
    const layout = Layout.createDefault(registry).openView(LayoutFixture.terminal, registry).openDocument(sheet).openDocument(LayoutFixture.todo);
    await TestBed.inject(LayoutStoreService).writeAsync({ ...layout.toJson(), titles: { [sheet.key]: "Plan" } });

    expect(await moved.loadAsync()).toBe(true);
    TestBed.tick();

    expect(moved.layout().toJson()).toEqual(prepared().toJson());
    expect([labels.titleOf(LayoutFixture.plan), labels.titleOf(sheet)]).toEqual(["Plan", null]);
  });

  it("treats a layout whose titles are not text as unreadable", async () => {
    await store.writeAsync({ ...prepared().toJson(), titles: { [LayoutFixture.plan.key]: 3 } });

    expect(await service.loadAsync()).toBe(false);
    expect(service.layout().toJson()).toEqual(Layout.createDefault(registry).toJson());
  });

  it("writes only a layout that changed since it was loaded or last saved", async () => {
    await loadAsync(prepared());
    const write = vi.spyOn(store, "writeAsync");

    await service.saveAsync();
    service.activate(LayoutFixture.plan);
    await service.saveAsync();
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(1);
  });

  it("reports a save after a pause that fails, and the next change saves again", async () => {
    await loadAsync(prepared());
    const failure = new Error("The runtime refused the layout.");
    const handled = vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(() => undefined);
    const write = vi.spyOn(store, "writeAsync").mockRejectedValueOnce(failure);

    service.activate(LayoutFixture.plan);
    vi.advanceTimersByTime(500);
    await vi.waitFor(() => expect(handled).toHaveBeenCalledWith(failure));
    service.close(LayoutFixture.todo);
    vi.advanceTimersByTime(500);

    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(write.mock.calls[1]?.[0]).toEqual(service.layout().toJson());
  });

  it("writes one layout at a time, so the newest layout is always the last one written", async () => {
    await loadAsync(prepared());
    service.setViewport(120, 60);
    let finishFirst: () => void = () => undefined;
    const written: unknown[] = [];
    vi.spyOn(store, "writeAsync").mockImplementation(layout => {
      written.push(layout);
      return written.length === 1 ? new Promise<boolean>(resolve => {
        finishFirst = (): void => resolve(true);
      }) : Promise.resolve(true);
    });

    service.activate(LayoutFixture.plan);
    const first = service.saveAsync();
    await vi.waitFor(() => expect(written.length).toBe(1));
    service.toggleDock(DockSide.Left);
    const second = service.saveAsync();
    await Promise.resolve();
    expect(written.length).toBe(1);
    finishFirst();
    await Promise.all([first, second]);

    expect(written.length).toBe(2);
    expect(written[1]).toEqual(service.layout().toJson());
  });

  it("keeps saving after a failed write", async () => {
    await loadAsync(prepared());
    const failure = new Error("The runtime refused the layout.");
    const write = vi.spyOn(store, "writeAsync").mockRejectedValueOnce(failure);

    service.activate(LayoutFixture.plan);
    await expect(service.saveAsync()).rejects.toBe(failure);
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(2);
  });

  it("waits while the runtime is not ready and writes the newest layout once when it is ready again", async () => {
    await loadAsync(prepared());
    const write = vi.spyOn(store, "writeAsync");
    bridge.publishStartup({ kind: "Connecting", details: [] });
    TestBed.tick();

    service.activate(LayoutFixture.plan);
    await vi.advanceTimersByTimeAsync(500);
    service.toggleDock(DockSide.Left);
    await service.saveAsync();
    expect(write).not.toHaveBeenCalled();

    bridge.publishStartup({ kind: "Ready", details: [] });
    TestBed.tick();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    bridge.publishStartup({ kind: "Ready", details: [] });
    TestBed.tick();
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toEqual(service.layout().toJson());
  });

  it("keeps a layout the runtime was not there to take and writes it when the runtime is ready again", async () => {
    await loadAsync(prepared());
    const write = vi.spyOn(store, "writeAsync").mockResolvedValueOnce(false);

    service.activate(LayoutFixture.plan);
    await service.saveAsync();
    bridge.publishStartup({ kind: "Connecting", details: [] });
    TestBed.tick();
    bridge.publishStartup({ kind: "Ready", details: [] });
    TestBed.tick();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(2);
    expect(await store.readAsync()).toEqual(service.layout().toJson());
  });

  it("writes the layout while Noldova Desktop Sample saves for an update", async () => {
    await loadAsync(prepared());
    const write = vi.spyOn(store, "writeAsync");
    bridge.publishStartup({ kind: "Updating", details: ["0.3.0"] });
    TestBed.tick();

    service.activate(LayoutFixture.plan);
    service.toggleDock(DockSide.Left);
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(1);
  });
});
