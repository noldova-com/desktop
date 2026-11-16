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
import type { Tab } from "../../../src/app/models/layout/tab";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { ViewPlace } from "../../../src/app/models/view-place";
import { DocumentHeading } from "../../../src/app/models/document-heading";
import { DocumentHistoryService } from "../../../src/app/services/document-history.service";
import type { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";

describe("DocumentHistoryService", () => {
  const { files, search, terminal, plan, todo, settings } = LayoutFixture;
  const registry = LayoutFixture.createRegistry();
  let layout: LayoutService;
  let history: DocumentHistoryService;

  beforeEach(async () => {
    PreloadBridgeFixture.install();
    layout = await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(plan));
    history = TestBed.inject(DocumentHistoryService);
    TestBed.tick();
  });

  afterEach(() => PreloadBridgeFixture.remove());

  function show(tab: Tab): void {
    layout.activate(tab);
    TestBed.tick();
  }

  function open(tab: DocumentTab): void {
    layout.openDocument(tab);
    TestBed.tick();
  }

  function go(step: number): string | undefined {
    history.go(step);
    TestBed.tick();
    return layout.layout().documents.active?.key;
  }

  function state(): readonly boolean[] {
    return [history.canGoBack(), history.canGoForward()];
  }

  function isShown(tab: ViewTab): boolean {
    const now = layout.layout();
    const dock = [DockSide.Left, DockSide.Right, DockSide.Bottom].map(t => now.dock(t)).find(t => t.root?.groups.some(u => u.tabs.some(v => v.equals(tab))) ?? false);
    return now.groups.some(t => t.active?.equals(tab) ?? false) && (Object.isUndefined(dock) || dock.isExpanded);
  }

  function listen(heard: string[], view: string = files.name): () => void {
    return history.onPlaceShown(view, (place, instance) => heard.push(`${place} ${instance ?? "-"} ${isShown(new ViewTab(view, instance ?? undefined))}`));
  }

  function record(place: string, view: string = files.name, instance: string | null = null): void {
    history.recordPlace(new ViewPlace(view, instance, place));
    TestBed.tick();
  }

  it("goes back and forward over the documents shown in turn, and has nowhere to go before any other was shown", () => {
    const first = state();
    open(todo);
    open(settings);
    const last = state();

    expect([first, last]).toEqual([[false, false], [true, false]]);
    expect([go(-1), state()]).toEqual([todo.key, [true, true]]);
    expect([go(-1), state()]).toEqual([plan.key, [false, true]]);
    expect([go(1), go(1), state()]).toEqual([todo.key, settings.key, [true, false]]);
  });

  it("stays on the current document when there is nothing that way", () => {
    open(todo);
    go(-1);

    expect([go(-1), state()]).toEqual([plan.key, [false, true]]);
    expect([go(1), go(1), state()]).toEqual([todo.key, todo.key, [true, false]]);
  });

  it("records a document only when it becomes the active one, not again for other layout changes or for views", () => {
    open(todo);
    layout.toggleDock(DockSide.Left);
    TestBed.tick();
    show(files);
    show(todo);

    expect([go(-1), state()]).toEqual([plan.key, [false, true]]);
  });

  it("drops the documents ahead once another document is shown after going back", () => {
    open(todo);
    go(-1);
    open(settings);

    expect(state()).toEqual([true, false]);
    expect([go(-1), go(-1)]).toEqual([plan.key, plan.key]);
  });

  it("opens a document closed since again as a preview, both ways, without recording it again", () => {
    open(todo);
    open(settings);
    go(-1);
    go(-1);
    layout.close(todo);
    TestBed.tick();
    const closed = state();

    expect([closed, go(1), layout.layout().documents.preview?.key, state()]).toEqual([[false, true], todo.key, todo.key, [true, true]]);
    expect([go(1), go(-1), go(-1), state()]).toEqual([settings.key, todo.key, plan.key, [false, true]]);
  });

  it("opens a closed document again with the title, breadcrumb and glyph it last had", () => {
    const labels = TestBed.inject(TabLabelService);
    open(todo);
    labels.setHeading(todo, new DocumentHeading("To do", ["Notes", "Work"], "folder"));
    layout.close(todo);
    TestBed.tick();
    const reopened = go(-1);
    const heading = labels.headingOf(todo);

    expect([reopened, layout.layout().documents.preview?.key, heading.title, heading.breadcrumb, heading.icon]).toEqual([todo.key, todo.key, "To do", ["Notes", "Work"], "folder"]);
  });

  it("opens a document replaced by the next preview again in its place", () => {
    layout.openDocument(todo, true);
    TestBed.tick();
    layout.openDocument(settings, true);
    TestBed.tick();
    const replaced = layout.layout().isOpen(todo);

    expect([replaced, go(-1), layout.layout().documents.preview?.key, layout.layout().isOpen(settings)]).toEqual([false, todo.key, todo.key, false]);
  });

  it("goes back to the shown document after it closes and the one before it is shown again", () => {
    open(todo);
    layout.close(todo);
    TestBed.tick();

    expect([layout.layout().documents.active?.key, ...state()]).toEqual([plan.key, true, false]);
    expect([go(-1), go(-1), state()]).toEqual([todo.key, plan.key, [false, true]]);
  });

  it("skips a forgotten document both ways, and forgetting the current one keeps the place before it", () => {
    open(todo);
    open(settings);
    history.forget(todo);
    const skipped = go(-1);
    const forgotten = state();
    go(1);
    open(todo);
    go(-1);
    history.forget(settings);

    expect([skipped, forgotten]).toEqual([plan.key, [false, true]]);
    expect([state(), go(1), go(-1)]).toEqual([[false, true], todo.key, plan.key]);
  });

  it("skips a document whose module no longer offers it", () => {
    open(todo);
    open(settings);
    layout.setRegistry(new ViewRegistry(registry.views, ["desktop.settings"]));
    TestBed.tick();

    expect(state()).toEqual([false, false]);
  });

  it("keeps the last 50 documents", () => {
    for (let index = 0; index < 60; index++)
      open(new DocumentTab("notes.note", `n${index}`));
    let steps = 0;
    while (history.canGoBack()) {
      go(-1);
      steps++;
    }

    expect([steps, layout.layout().documents.active?.instance]).toEqual([49, "n10"]);
  });

  it("goes back and forward over a view's places between documents, showing the view before telling its listener", () => {
    const heard: string[] = [];
    listen(heard);
    show(search);
    layout.hideDock(DockSide.Left);
    TestBed.tick();
    record("a");
    record("b");
    open(todo);
    const hidden = isShown(files);

    expect([hidden, state()]).toEqual([false, [true, false]]);
    expect([go(-1), go(-1), state()]).toEqual([todo.key, todo.key, [true, true]]);
    expect([go(-1), state()]).toEqual([plan.key, [false, true]]);
    expect([go(1), go(1), go(1), state()]).toEqual([plan.key, plan.key, todo.key, [true, false]]);
    expect(heard).toEqual(["b - true", "a - true", "a - true", "b - true"]);
  });

  it("goes back from a place to the document shown under it, skipping a document equal to the active one only between documents", () => {
    const heard: string[] = [];
    listen(heard);
    record("a");
    record("b");

    expect([go(-1), state()]).toEqual([plan.key, [true, true]]);
    expect([go(-1), state()]).toEqual([plan.key, [false, true]]);
    expect(heard).toEqual(["a - true"]);
  });

  it("ignores a place equal to the entry the person is on, so a view can record the place Back shows it", () => {
    const heard: string[] = [];
    history.onPlaceShown(files.name, place => {
      heard.push(place);
      history.recordPlace(new ViewPlace(files.name, null, place));
    });
    record("a");
    record("a");
    record("b");
    go(-1);

    expect([state(), heard]).toEqual([[true, true], ["a"]]);
    expect([go(-1), state()]).toEqual([plan.key, [false, true]]);
  });

  it("drops the entries ahead once a place is recorded after going back", () => {
    open(todo);
    go(-1);
    listen([]);
    record("a");

    expect(state()).toEqual([true, false]);
    expect([go(-1), state()]).toEqual([plan.key, [false, true]]);
  });

  it("tells each listener of the view in turn, reporting one that throws, and stops telling one once removed, however often", () => {
    const errors = vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(() => undefined);
    const failure = new Error("The listener failed.");
    const heard: string[] = [];
    const first = listen(heard);
    history.onPlaceShown(files.name, () => {
      throw failure;
    });
    listen(heard);
    record("a");
    open(todo);
    go(-1);
    first();
    first();
    go(1);
    go(-1);

    expect(heard).toEqual(["a - true", "a - true", "a - true"]);
    expect(errors.mock.calls).toEqual([[failure], [failure]]);
  });

  it("removes only its own registration of a listener given twice, however often its remover runs", () => {
    const heard: string[] = [];
    const listener = (place: string): void => {
      heard.push(place);
    };
    const first = history.onPlaceShown(files.name, listener);
    history.onPlaceShown(files.name, listener);
    record("a");
    open(todo);
    go(-1);
    first();
    first();
    go(1);
    go(-1);

    expect(heard).toEqual(["a", "a", "a"]);
  });

  it("skips a place whose view has no listener, before one listens and once the last stops", () => {
    const heard: string[] = [];
    record("a");
    open(todo);
    const unheard = [go(-1), state()];
    go(1);
    const stop = listen(heard);
    const heardState = state();
    stop();

    expect(unheard).toEqual([plan.key, [false, true]]);
    expect([heardState, state(), heard]).toEqual([[true, false], [true, false], []]);
    expect([go(-1), heard]).toEqual([plan.key, []]);
  });

  it("goes to a place of a view's instance while its tab is open, and skips it once the tab closes", () => {
    const heard: string[] = [];
    layout.openView(terminal);
    TestBed.tick();
    listen(heard, terminal.name);
    record("/home", terminal.name, "1");
    open(todo);
    go(-1);
    go(1);
    layout.close(terminal);
    TestBed.tick();

    expect([state(), go(-1)]).toEqual([[true, false], plan.key]);
    expect(heard).toEqual(["/home 1 true"]);
  });

  it("skips a forgotten place and the places of a view whose part deactivated", () => {
    const heard: string[] = [];
    listen(heard);
    listen(heard, terminal.name);
    layout.openView(terminal);
    TestBed.tick();
    record("a");
    record("/home", terminal.name, "1");
    record("b");
    history.forgetPlace(new ViewPlace(files.name, null, "a"));
    open(todo);
    history.dropPlaces(t => t === terminal.name);

    expect([go(-1), go(-1), state()]).toEqual([todo.key, plan.key, [false, true]]);
    expect(heard).toEqual(["b - true"]);
  });

  it("keeps the entry before a forgotten current place as the one the person is on", () => {
    listen([]);
    record("a");
    record("b");
    history.forgetPlace(new ViewPlace(files.name, null, "b"));

    expect([state(), go(-1), state()]).toEqual([[true, false], plan.key, [false, true]]);
  });

  it("keeps the last 50 entries, places and documents together", () => {
    listen([]);
    for (let index = 0; index < 30; index++) {
      open(new DocumentTab("notes.note", `n${index}`));
      record(`p${index}`);
    }
    let steps = 0;
    while (history.canGoBack()) {
      go(-1);
      steps++;
    }

    expect([steps, layout.layout().documents.active?.instance]).toEqual([49, "n5"]);
  });

  it("records nothing while no document is active, and keeps the closed one as a place", () => {
    layout.close(plan);
    TestBed.tick();
    const empty = state();
    open(todo);

    expect([empty, state(), go(-1), go(1)]).toEqual([[false, false], [true, false], plan.key, todo.key]);
  });
});
