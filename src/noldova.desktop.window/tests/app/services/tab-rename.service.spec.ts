/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DockSide } from "../../../src/app/enums/dock-side";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../src/app/models/layout/view-type";
import type { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { TabRenameService } from "../../../src/app/services/tab-rename.service";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("TabRenameService", () => {
  const shell = new ViewTab("terminal.shell", "1");
  const log = new ViewTab("terminal.log", "1");
  const files = new ViewTab("files.tree");
  const list = new ViewTab("notes.list", "1");
  const note = new DocumentTab("notes.note", "1");
  const page = new DocumentTab("browser.page", "1");
  const registry = new ViewRegistry([
    new ViewType("files.tree", DockSide.Left, true),
    new ViewType("notes.list", DockSide.Left, false, true, null, true),
    new ViewType("terminal.shell", DockSide.Bottom, false, true, null, true),
    new ViewType("terminal.log", DockSide.Bottom, false, true)
  ], ["browser.page", "notes.note"], new Map(), new Set(["notes.note"]));
  let bridge: PreloadBridgeFixture;
  let errors: unknown[];
  let heard: string[];
  let layout: LayoutService;
  let service: TabRenameService;

  beforeEach(async () => {
    errors = [];
    heard = [];
    bridge = PreloadBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    layout = await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openView(shell, registry).openView(log, registry).openView(list, registry).openDocument(note).openDocument(page));
    const labels = TestBed.inject(TabLabelService);
    labels.setTitle(shell, "Terminal 1");
    labels.setTitle(note, "Plans");
    service = TestBed.inject(TabRenameService);
    service.onRenamed("terminal.shell", (instance, title) => heard.push(`terminal.shell ${instance} ${title}`));
    service.onRenamed("notes.note", (instance, title) => heard.push(`notes.note ${instance} ${title}`));
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  it("renames only a renamable view's instance tab or a renamable document's tab", () => {
    expect([shell, note, list, log, page, files].map(t => service.canRename(t))).toEqual([true, true, true, false, false, false]);
  });

  it("offers no rename on a side set to icons, where a header stands for the tabs, and ends one there", () => {
    service.begin(list);
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.leftDockStyle", value: "Icons", isSet: true });
    TestBed.tick();

    expect([service.editing(), service.canRename(list), service.canRename(shell)]).toEqual([null, false, true]);
  });

  it("offers no rename in a collapsed dock, and ends one when its dock collapses", () => {
    service.begin(shell);
    layout.toggleDock(DockSide.Bottom);
    TestBed.tick();

    expect([layout.geometry().isCollapsed(DockSide.Bottom), service.editing(), service.canRename(shell), service.canRename(note)]).toEqual([true, null, false, true]);
  });

  it("ends a rename when its tab closes, and tells the part nothing of a title kept after it", () => {
    service.begin(note);
    layout.close(note);
    service.keep("Roadmap");
    service.begin(shell);
    layout.close(shell);
    TestBed.tick();
    layout.openView(shell);

    expect([heard, service.editing(), service.canRename(note)]).toEqual([[], null, false]);
  });

  it("edits a renamable tab, and leaves any other tab alone", () => {
    service.begin(page);
    const other = service.editing();
    service.begin(note);

    expect([other, service.editing()]).toEqual([null, note]);
  });

  it("tells the part the kept title, trimmed, once, and leaves editing", () => {
    service.begin(shell);
    service.keep("  build  ");
    service.keep("again");

    expect([heard, service.editing()]).toEqual([["terminal.shell 1 build"], null]);
  });

  it("tells the part an empty title, which asks for its automatic one", () => {
    service.begin(note);
    service.keep("   ");

    expect(heard).toEqual(["notes.note 1 "]);
  });

  it("tells the part nothing when the title is the one the tab shows, or the person cancels", () => {
    service.begin(note);
    service.keep(" Plans ");
    service.begin(shell);
    service.cancel();

    expect([heard, service.editing()]).toEqual([[], null]);
  });

  it("reports a listener's error, and the other listeners still hear", () => {
    const failure = new Error("The part failed.");
    service.onRenamed("terminal.shell", () => {
      throw failure;
    });
    service.onRenamed("terminal.shell", (instance, title) => heard.push(`second ${instance} ${title}`));
    service.begin(shell);
    service.keep("build");

    expect([heard, errors]).toEqual([["terminal.shell 1 build", "second 1 build"], [failure]]);
  });

  it("stops telling a listener it removed", () => {
    const removed: string[] = [];
    const remove = service.onRenamed("notes.note", (instance, title) => removed.push(`${instance} ${title}`));
    remove();
    service.begin(note);
    service.keep("Notes");

    expect([removed, heard]).toEqual([[], ["notes.note 1 Notes"]]);
  });
});
