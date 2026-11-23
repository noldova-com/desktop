/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DockSide } from "../../../src/app/enums/dock-side";
import { SideDropTarget } from "../../../src/app/models/layout/side-drop-target";
import { DocumentHeading } from "../../../src/app/models/document-heading";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import type { Tab } from "../../../src/app/models/layout/tab";
import { TabLabel } from "../../../src/app/models/layout/tab-label";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { TabDropTarget } from "../../../src/app/models/layout/tab-drop-target";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../src/app/models/layout/view-type";
import { LayoutService } from "../../../src/app/services/layout.service";
import { ShellCommandsService } from "../../../src/app/services/shell-commands.service";
import { TabFocusService } from "../../../src/app/services/tab-focus.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { ViewDialogService } from "../../../src/app/services/view-dialog.service";
import { ViewInstancesService } from "../../../src/app/services/view-instances.service";
import { LayoutMetricsFixture } from "../../fixtures/layout-metrics.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("ViewInstancesService", () => {
  const first = new ViewTab("terminal.shell", "1");
  const second = new ViewTab("terminal.shell", "2");
  const third = new ViewTab("terminal.shell", "3");
  const files = new ViewTab("files.tree");
  const panel = new ViewTab("terminal.panel");
  let errors: unknown[];
  let closed: string[];
  let stopListening: () => void;
  let dialogCloses: number;
  let shown: WritableSignal<Tab | null>;
  let instances: ViewInstancesService;
  let layout: LayoutService;
  let labels: TabLabelService;

  beforeEach(() => {
    PreloadBridgeFixture.install();
    errors = [];
    closed = [];
    dialogCloses = 0;
    shown = signal(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: ViewDialogService, useValue: { shown, close: () => dialogCloses++ } }
      ]
    });
    instances = TestBed.inject(ViewInstancesService);
    layout = TestBed.inject(LayoutService);
    labels = TestBed.inject(TabLabelService);
    layout.setRegistry(new ViewRegistry([new ViewType("terminal.shell", DockSide.Bottom, false, true, "terminal.tabRow"), new ViewType("files.tree", DockSide.Left, true),
      new ViewType("terminal.panel", DockSide.Bottom, false)], ["notes.note"]));
    stopListening = instances.onClosed("terminal.shell", t => closed.push(`terminal.shell ${t}`));
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  it("opens an instance in its view's dock with its title and glyph, and activates it with a new title when opened again", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), "code", null);
    const dock = layout.layout().groupOf(first);

    expect([dock?.tabs, dock?.active, layout.layout().dock(DockSide.Bottom).root?.cornerGroup.id]).toEqual([[first, second], second, dock?.id]);
    instances.openInstance("terminal.shell", "1", new DocumentHeading("PowerShell"), "terminal", null);
    expect(layout.layout().groupOf(first)?.active).toEqual(first);
    expect([labels.of(first), labels.of(second)]).toEqual([new TabLabel("PowerShell", "terminal"), new TabLabel("bash", "code")]);
  });

  it("opens an instance in the group it names, else in the current group when it holds one of the view's tabs", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    const middle = layout.layout().documents.id;
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, middle.toString());
    instances.openInstance("terminal.shell", "3", new DocumentHeading("zsh"), null, "999");

    expect([layout.layout().groupOf(second)?.id, layout.layout().groupOf(third)?.id, layout.currentGroup().id]).toEqual([middle, middle, middle]);
    expect(layout.layout().documents.tabs).toEqual([second, third]);
  });

  it("opens an instance in the first group holding one of the view's tabs when the current group holds none", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    const dock = layout.layout().groupOf(first)?.id;
    layout.focusGroup(layout.layout().documents.id);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);

    expect(layout.layout().groupOf(second)?.id).toBe(dock);
    expect(layout.layout().documents.tabs).toEqual([]);
  });

  it("restores an open instance's title and glyph where it is without activating it, and opens one that is not open", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    instances.restore("terminal.shell", "1", new DocumentHeading("Saved shell"), "code", null);

    expect([layout.layout().groupOf(first)?.active, labels.of(first)]).toEqual([second, new TabLabel("Saved shell", "code")]);
    instances.restore("terminal.shell", "3", new DocumentHeading("zsh"), null, null);
    expect(layout.layout().groupOf(third)?.active).toEqual(third);
  });

  it("changes an open instance's title or glyph, keeps what the update leaves out, and ignores one that is not open", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), "terminal", null);
    instances.update("terminal.shell", "1", "Build", null, null);
    const titled = labels.of(first);
    instances.update("terminal.shell", "1", null, "code", null);
    instances.update("terminal.shell", "2", "Ghost", "code", null);

    expect([titled, labels.of(first), labels.of(second)]).toEqual([new TabLabel("Build", "terminal"), new TabLabel("Build", "code"), new TabLabel("2", "web_asset")]);
  });

  it("opens an instance with its breadcrumb, keeps it through a new title, changes it, and removes it with an empty list", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh", ["Work", "api"]), null, null);
    const opened = labels.headingOf(first);
    instances.update("terminal.shell", "1", "Build", null, null);
    const titled = labels.headingOf(first);
    instances.update("terminal.shell", "1", null, null, ["Home"], "home");
    const changed = labels.headingOf(first);
    instances.update("terminal.shell", "1", null, null, []);

    expect([opened.text, titled.text, changed.text, labels.headingOf(first).text]).toEqual(["Work / api / pwsh", "Work / api / Build", "Home / Build", "Build"]);
    expect([changed.icon, labels.headingOf(first).icon]).toEqual(["home", null]);
  });

  it("tells its listeners the name and instance of a tab the person closes, and never of one closed through it", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    instances.openInstance("terminal.shell", "3", new DocumentHeading("zsh"), null, null);
    layout.openView(files);
    TestBed.tick();
    layout.close(first);
    instances.close("terminal.shell", "2");
    instances.close("terminal.shell", "9");
    layout.close(files);
    TestBed.tick();
    layout.close(third);
    TestBed.tick();

    expect(closed).toEqual(["terminal.shell 1", "terminal.shell 3"]);
    expect(layout.layout().isOpen(second)).toBe(false);
  });

  it("closes the view dialog showing an instance it closes", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    shown.set(second);
    instances.close("terminal.shell", "1");
    instances.close("terminal.shell", "2");

    expect(dialogCloses).toBe(1);
  });

  it("closes the views' instance tabs it is not told to keep, without telling its listeners", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    instances.openInstance("terminal.shell", "3", new DocumentHeading("zsh"), null, null);
    layout.openView(files);
    TestBed.tick();
    instances.reconcile(new Set(["terminal.shell"]), new Set([second.key]));
    TestBed.tick();

    expect([first, second, third, files].map(t => layout.layout().isOpen(t))).toEqual([false, true, false, true]);
    expect(closed).toEqual([]);
  });

  it("holds a close no listener heard, keeps an early restore from reopening it, and tells the view's listeners when the part's activation ends", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    TestBed.tick();
    stopListening();
    layout.close(first);
    TestBed.tick();
    instances.onClosed("terminal.shell", t => closed.push(`new ${t}`));
    instances.restore("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.restore("terminal.shell", "2", new DocumentHeading("zsh"), null, null);
    TestBed.tick();
    const restored = [layout.layout().isOpen(first), layout.layout().isOpen(second), labels.of(second).title, [...closed]];
    instances.reconcile(new Set(["files.tree"]), new Set());
    const other = [...closed];
    instances.reconcile(new Set(["terminal.shell"]), new Set([first.key, second.key]));
    instances.reconcile(new Set(["terminal.shell"]), new Set([first.key, second.key]));

    expect(restored).toEqual([false, true, "zsh", []]);
    expect(other).toEqual([]);
    expect(closed).toEqual(["new 1"]);
  });

  it("drops a held close when the part opens its instance again", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    TestBed.tick();
    stopListening();
    layout.close(first);
    TestBed.tick();
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    TestBed.tick();
    instances.onClosed("terminal.shell", t => closed.push(`new ${t}`));
    instances.reconcile(new Set(["terminal.shell"]), new Set([first.key]));

    expect(layout.layout().isOpen(first)).toBe(true);
    expect(closed).toEqual([]);
  });

  it("forgets the title, breadcrumb and glyph of an instance whose tab closes", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh", ["Work"]), "code", null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), "code", null);
    TestBed.tick();
    layout.close(first);
    instances.close("terminal.shell", "2");
    TestBed.tick();

    expect([labels.of(first), labels.of(second)]).toEqual([new TabLabel("1", "web_asset"), new TabLabel("2", "web_asset")]);
    expect(labels.headingOf(first).breadcrumb).toEqual([]);
  });

  function measure(width: number, height: number): void {
    layout.setMetrics(LayoutMetricsFixture.standard);
    layout.setViewport(width, height);
  }

  function isShown(side: DockSide): boolean {
    return layout.layout().dock(side).isExpanded && !layout.geometry().closedSides.has(side);
  }

  function sideOf(tab: ViewTab): DockSide | null {
    return layout.layout().sideOf(layout.layout().groupOf(tab)?.id ?? -1);
  }

  it("shows a closed view without instances at the end of its dock's group, showing the hidden dock, and moves the focus to its tab and asks its content to take it", () => {
    const focus = vi.spyOn(TestBed.inject(TabFocusService), "focus");
    measure(120, 60);
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    layout.toggleDock(DockSide.Bottom);
    const wasShown = isShown(DockSide.Bottom);

    instances.show(panel);

    const group = layout.layout().groupOf(panel);
    expect([wasShown, isShown(DockSide.Bottom)]).toEqual([false, true]);
    expect([group?.tabs, group?.active, sideOf(panel)]).toEqual([[first, panel], panel, DockSide.Bottom]);
    expect([focus.mock.calls.map(t => t[0]), TestBed.inject(TabFocusService).isContentAsked(panel)]).toEqual([[panel], true]);
  });

  it("shows an open view behind another tab where the person moved it, showing that hidden dock, and moves the focus to its tab and asks its content to take it", () => {
    const focus = vi.spyOn(TestBed.inject(TabFocusService), "focus");
    measure(120, 60);
    layout.openView(files);
    const left = layout.layout().groupOf(files)?.id ?? -1;
    layout.place(panel, new TabDropTarget(left, 1));
    layout.activate(files);
    layout.toggleDock(DockSide.Left);
    const before = [isShown(DockSide.Left), layout.layout().group(left)?.active];

    instances.show(panel);

    expect(before).toEqual([false, files]);
    expect([isShown(DockSide.Left), layout.layout().groupOf(panel)?.id, layout.layout().group(left)?.active, layout.layout().dock(DockSide.Bottom).root]).toEqual([true, left, panel, null]);
    expect([focus.mock.calls.map(t => t[0]), TestBed.inject(TabFocusService).isContentAsked(panel)]).toEqual([[panel], true]);
  });

  it("shows an open view among the documents where it is, behind another tab, with no dock to show", () => {
    measure(120, 60);
    const documents = layout.layout().documents.id;
    layout.place(panel, new TabDropTarget(documents, 0));
    layout.place(files, new TabDropTarget(documents, 1));
    layout.activate(files);

    instances.show(panel);

    expect([layout.layout().groupOf(panel)?.id, layout.layout().documents.active, layout.layout().dock(DockSide.Bottom).root]).toEqual([documents, panel, null]);
  });

  it("shows an open view in a dock the narrow window closed", () => {
    measure(120, 60);
    layout.openView(files);
    layout.setViewport(40, 40);
    const wasShown = isShown(DockSide.Left);

    instances.show(files);

    expect([wasShown, isShown(DockSide.Left), layout.layout().groupOf(files)?.active]).toEqual([false, true, files]);
  });

  it("hides the dock that holds a view's tab, with instances and without, on each side, keeping its tabs so showing the view shows it there again", () => {
    measure(120, 60);
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    const results = [DockSide.Left, DockSide.Right, DockSide.Bottom].map(side => {
      layout.place(panel, new SideDropTarget(side));
      layout.place(first, new SideDropTarget(side));
      instances.hideDock(panel);
      const hidden = [isShown(side), layout.layout().isOpen(panel), layout.layout().isOpen(first)];
      instances.show(panel);
      const shown = [isShown(side), sideOf(panel)];
      instances.hideDock(first);
      return [side, hidden, shown, isShown(side), sideOf(first)];
    });

    expect(results).toEqual([
      [DockSide.Left, [false, true, true], [true, DockSide.Left], false, DockSide.Left],
      [DockSide.Right, [false, true, true], [true, DockSide.Right], false, DockSide.Right],
      [DockSide.Bottom, [false, true, true], [true, DockSide.Bottom], false, DockSide.Bottom]
    ]);
  });

  it("reads the dock that holds a view's tab as the tab moves between the docks and the documents, and none once it closes", () => {
    measure(120, 60);
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    const dock = instances.dockOf(first);
    const sides = [dock()];
    for (const target of [new SideDropTarget(DockSide.Left), new SideDropTarget(DockSide.Right), new TabDropTarget(layout.layout().documents.id, 0), new SideDropTarget(DockSide.Bottom)]) {
      layout.place(first, target);
      sides.push(dock());
    }
    instances.close("terminal.shell", "1");

    expect([...sides, dock()]).toEqual([DockSide.Bottom, DockSide.Left, DockSide.Right, null, DockSide.Bottom, null]);
  });

  it("reads the same dock for a view's tab while that dock is hidden, on each side", () => {
    measure(120, 60);
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    const dock = instances.dockOf(first);
    const results = [DockSide.Left, DockSide.Right, DockSide.Bottom].map(side => {
      layout.place(first, new SideDropTarget(side));
      instances.hideDock(first);
      return [isShown(side), dock()];
    });

    expect(results).toEqual([[false, DockSide.Left], [false, DockSide.Right], [false, DockSide.Bottom]]);
  });

  it("reads no dock for a view's tab that is not open yet, and its dock once it opens", () => {
    measure(120, 60);
    const dock = instances.dockOf(files);
    const before = dock();

    instances.show(files);

    expect([before, dock()]).toEqual([null, DockSide.Left]);
  });

  it("changes nothing when hiding a view's dock for a tab that is not open, a tab among the documents or a dock already hidden", () => {
    measure(120, 60);
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    layout.place(panel, new TabDropTarget(layout.layout().documents.id, 0));
    layout.toggleDock(DockSide.Bottom);
    const before = layout.layout();

    instances.hideDock(files);
    instances.hideDock(second);
    instances.hideDock(panel);
    instances.hideDock(first);
    const isUnchanged = layout.layout() === before;

    expect([isUnchanged, sideOf(panel)]).toEqual([true, null]);
  });

  it("shows a view in the bottom dock the short window closed at what the document's minimum leaves", () => {
    measure(120, 60);
    layout.openView(panel);
    layout.setViewport(120, 21.25);
    const wasShown = isShown(DockSide.Bottom);

    instances.show(panel);

    expect([wasShown, isShown(DockSide.Bottom), layout.geometry().dock(DockSide.Bottom).height]).toEqual([false, true, 7]);
  });

  it("keeps the dock a part hid hidden on each side once the window has room, whether the window had closed it or kept it open for the part, and shows it again with the view", () => {
    const results = [DockSide.Left, DockSide.Right, DockSide.Bottom].map(side => {
      const small = (): void => side === DockSide.Bottom ? layout.setViewport(120, 21.25) : layout.setViewport(40, 60);
      const state = (): readonly [boolean, number] => {
        const bounds = layout.geometry().dock(side);
        return [isShown(side), side === DockSide.Bottom ? bounds.height : bounds.width];
      };
      measure(120, 60);
      layout.place(panel, new SideDropTarget(side));
      small();
      const closedByWindow = state();
      instances.hideDock(panel);
      layout.setViewport(120, 60);
      const hiddenWhenClosed = state();
      small();
      instances.show(panel);
      const kept = state();
      instances.hideDock(panel);
      layout.setViewport(120, 60);
      const hiddenWhenKept = state();
      instances.show(panel);
      return [side, closedByWindow, hiddenWhenClosed, kept, hiddenWhenKept, state()];
    });

    expect(results).toEqual([
      [DockSide.Left, [false, 2.75], [false, 2.75], [true, 10], [false, 2.75], [true, 26]],
      [DockSide.Right, [false, 2.75], [false, 2.75], [true, 10], [false, 2.75], [true, 25]],
      [DockSide.Bottom, [false, 2.75], [false, 2.75], [true, 7], [false, 2.75], [true, 16.25]]
    ]);
  });

  it("gives a group's front back to the tab that was in front before the part's open brought its instance forward, whether it opened the instance or showed it again, without moving the focus", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    const tabFocus = TestBed.inject(TabFocusService);
    const focus = [vi.spyOn(tabFocus, "focus"), vi.spyOn(tabFocus, "focusContent"), vi.spyOn(tabFocus, "focusIfLost")];

    instances.returnFront("terminal.shell", "2");
    const returned = layout.layout().groupOf(first)?.active;
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    instances.returnFront("terminal.shell", "2");

    expect([returned, layout.layout().groupOf(first)?.active]).toEqual([first, first]);
    expect(focus.map(t => t.mock.calls.length)).toEqual([0, 0, 0]);
  });

  it("keeps the tab to give back when the part opens its instance again while it is in front", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    instances.returnFront("terminal.shell", "2");

    expect(layout.layout().groupOf(first)?.active).toEqual(first);
  });

  it("gives the front back without making its group the current one, so closing the tab closes the document the person works in", async () => {
    const note = new DocumentTab("notes.note", "a");
    layout.openDocument(note);
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    layout.activate(note);
    instances.returnFront("terminal.shell", "2");
    const close = TestBed.inject(ShellCommandsService).commands.find(t => t.name === "desktop.closeTab");

    expect(await close?.runAsync(null)).toBeNull();
    expect([layout.layout().groupOf(note), layout.layout().groupOf(first)?.tabs, layout.layout().groupOf(first)?.active]).toEqual([null, [first, second], first]);
  });

  it("gives nothing back once the person chose a tab in the group, moved or closed the tab that was in front, or the group went", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    const front = (): Tab | null | undefined => layout.layout().groupOf(first)?.active;

    layout.activate(first);
    layout.activate(second);
    instances.returnFront("terminal.shell", "2");
    const chosen = front();
    instances.openInstance("terminal.shell", "3", new DocumentHeading("zsh"), null, null);
    layout.place(second, new TabDropTarget(layout.layout().groupOf(first)?.id ?? 0, 0));
    layout.activate(third);
    instances.returnFront("terminal.shell", "3");
    const moved = front();
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    layout.close(third);
    instances.returnFront("terminal.shell", "1");
    const closedEarlier = front();
    instances.openInstance("terminal.shell", "3", new DocumentHeading("zsh"), null, null);
    layout.closeTabs([first, second, third]);
    const gone = layout.layout();
    instances.returnFront("terminal.shell", "3");

    expect([chosen, moved, closedEarlier]).toEqual([second, third, first]);
    expect(layout.layout()).toBe(gone);
  });

  it("gives nothing back for an instance whose open brought nothing forward, one it never opened, or one a later open in its group put behind", () => {
    instances.openInstance("terminal.shell", "1", new DocumentHeading("pwsh"), null, null);
    const alone = layout.layout();
    instances.returnFront("terminal.shell", "1");
    instances.returnFront("terminal.shell", "9");
    const unchanged = layout.layout() === alone;
    instances.openInstance("terminal.shell", "2", new DocumentHeading("bash"), null, null);
    instances.openInstance("terminal.shell", "3", new DocumentHeading("zsh"), null, null);
    instances.returnFront("terminal.shell", "2");
    const behind = layout.layout().groupOf(first)?.active;
    instances.returnFront("terminal.shell", "3");

    expect([unchanged, behind, layout.layout().groupOf(first)?.active]).toEqual([true, third, second]);
  });
});
