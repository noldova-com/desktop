/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DockSide } from "../../../src/app/enums/dock-side";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import type { Tab } from "../../../src/app/models/layout/tab";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { DocumentHeading } from "../../../src/app/models/document-heading";
import { DocumentHistoryService } from "../../../src/app/services/document-history.service";
import type { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";

describe("DocumentHistoryService", () => {
  const { files, plan, todo, settings } = LayoutFixture;
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

  it("records nothing while no document is active, and keeps the closed one as a place", () => {
    layout.close(plan);
    TestBed.tick();
    const empty = state();
    open(todo);

    expect([empty, state(), go(-1), go(1)]).toEqual([[false, false], [true, false], plan.key, todo.key]);
  });
});
