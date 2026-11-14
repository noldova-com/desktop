/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { ArgumentException } from "@noldova/context.exceptions";

import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { DocumentHeading } from "../../../src/app/models/document-heading";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { SplitDropTarget } from "../../../src/app/models/layout/split-drop-target";
import { DocumentOpenerService } from "../../../src/app/services/document-opener.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";

describe("DocumentOpenerService", () => {
  beforeEach(() => {
    PreloadBridgeFixture.install();
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  let opener: DocumentOpenerService;
  let layout: LayoutService;
  let labels: TabLabelService;

  beforeEach(() => {
    opener = TestBed.inject(DocumentOpenerService);
    layout = TestBed.inject(LayoutService);
    labels = TestBed.inject(TabLabelService);
    layout.setRegistry(LayoutFixture.createRegistry());
  });

  it("opens a module's own document with its title and activates it when opened again with a new title", () => {
    opener.open("notes", "notes.note", "1", new DocumentHeading("Note 1"), false);
    opener.open("notes", "notes.note", "2", new DocumentHeading("Note 2"), false);
    opener.open("notes", "notes.note", "1", new DocumentHeading("First note"), false);
    const first = new DocumentTab("notes.note", "1");

    expect(layout.layout().documents.tabs).toEqual([first, new DocumentTab("notes.note", "2")]);
    expect(layout.layout().documents.active).toEqual(first);
    expect(labels.of(first).title).toBe("First note");
  });

  it("opens a document right after another open instance of it, and at the end of the active group when that instance is not open or is another module's", () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const other = new DocumentTab("desktop.settings", "4");
    ["1", "2"].forEach(t => opener.open("notes", "notes.note", t, new DocumentHeading(`Note ${t}`), false));
    layout.openDocument(other);

    opener.open("notes", "notes.note", "3", new DocumentHeading("Note 3"), false, "1");
    opener.open("notes", "notes.note", "5", new DocumentHeading("Note 5"), false, "4");
    opener.open("notes", "notes.note", "6", new DocumentHeading("Note 6"), false, "9");
    opener.open("notes", "notes.note", "2", new DocumentHeading("Second note"), false, "6");

    expect(layout.layout().documents.tabs).toEqual([note("1"), note("3"), note("2"), other, note("5"), note("6")]);
    expect([layout.layout().documents.active, labels.of(note("2")).title]).toEqual([note("2"), "Second note"]);
  });

  it("opens a document as a preview that the next preview replaces, and keeps it on request", () => {
    opener.open("notes", "notes.note", "1", new DocumentHeading("Note 1"), true);
    opener.open("notes", "notes.note", "2", new DocumentHeading("Note 2"), true);
    opener.keep("notes", "notes.note", "2");
    const second = new DocumentTab("notes.note", "2");

    expect(layout.layout().documents.tabs).toEqual([second]);
    expect(layout.layout().documents.preview).toBeNull();
    expect(() => opener.keep("clock", "notes.note", "2")).toThrow(ArgumentException);
    expect(() => opener.keep("notes", "notes.page", "2")).toThrow(ArgumentException);
  });

  it("restores an open document with its title and keeps it without activating it, and adds one that is not open without activating it", () => {
    const first = new DocumentTab("notes.note", "1");
    const second = new DocumentTab("notes.note", "2");
    const third = new DocumentTab("notes.note", "3");
    opener.open("notes", "notes.note", "1", new DocumentHeading("Note 1"), false);
    opener.open("notes", "notes.note", "2", new DocumentHeading("Note 2"), true);
    opener.open("notes", "notes.note", "1", new DocumentHeading("Note 1"), false);

    opener.restore("notes", "notes.note", "2", new DocumentHeading("Second note"), true);
    expect([layout.layout().documents.active, layout.layout().documents.preview]).toEqual([first, second]);
    opener.restore("notes", "notes.note", "2", new DocumentHeading("Second note"), false);
    expect([layout.layout().documents.active, layout.layout().documents.preview]).toEqual([first, null]);
    expect(labels.of(second).title).toBe("Second note");
    opener.restore("notes", "notes.note", "3", new DocumentHeading("Note 3"), true);
    expect(layout.layout().documents.tabs).toEqual([first, second, third]);
    expect([layout.layout().documents.active, layout.layout().documents.preview]).toEqual([first, third]);
    expect(() => opener.restore("clock", "notes.note", "1", new DocumentHeading("Note 1"), false)).toThrow(ArgumentException);
  });

  it("restores a document into an empty group as its active tab, and a preview as a kept tab when the group has a preview", () => {
    const first = new DocumentTab("notes.note", "1");
    const second = new DocumentTab("notes.note", "2");
    opener.restore("notes", "notes.note", "1", new DocumentHeading("Note 1"), true);
    opener.restore("notes", "notes.note", "2", new DocumentHeading("Note 2"), true);

    expect(layout.layout().documents.tabs).toEqual([first, second]);
    expect([layout.layout().documents.active, layout.layout().documents.preview]).toEqual([first, first]);
  });

  it("restores a document in another document group without making that group the active one", () => {
    const first = new DocumentTab("notes.note", "1");
    opener.open("notes", "notes.note", "1", new DocumentHeading("Note 1"), false);
    opener.open("notes", "notes.note", "2", new DocumentHeading("Note 2"), false);
    layout.place(new DocumentTab("notes.note", "2"), new SplitDropTarget(layout.layout().documents.id, PanelEdge.Right));
    layout.activate(first);
    const active = layout.layout().documents.id;

    opener.restore("notes", "notes.note", "2", new DocumentHeading("Note 2"), false);

    expect(layout.layout().documentGroups).toHaveLength(2);
    expect(layout.layout().documents.id).toBe(active);
    expect(layout.layout().documents.active).toEqual(first);
  });

  it("restores a saved document that is open as restore does, and leaves out one that is not", () => {
    const first = new DocumentTab("notes.note", "1");
    opener.open("notes", "notes.note", "1", new DocumentHeading("Note 1"), true);
    opener.open("notes", "notes.note", "2", new DocumentHeading("Note 2"), false);

    opener.restoreSaved("notes", "notes.note", "1", new DocumentHeading("First note"), false);
    opener.restoreSaved("notes", "notes.note", "3", new DocumentHeading("Note 3"), false);

    expect(layout.layout().documents.tabs).toEqual([first, new DocumentTab("notes.note", "2")]);
    expect([layout.layout().documents.active, layout.layout().documents.preview, labels.of(first).title]).toEqual([new DocumentTab("notes.note", "2"), null, "First note"]);
    expect(() => opener.restoreSaved("clock", "notes.note", "3", new DocumentHeading("Note 3"), false)).toThrow(ArgumentException);
  });

  it("changes an open document's title and breadcrumb, keeping what is left out, and nothing for one that is not open", () => {
    const first = new DocumentTab("notes.note", "1");
    opener.open("notes", "notes.note", "1", new DocumentHeading("Note 1", ["Notes"]), false);

    opener.update("notes", "notes.note", "1", "Plan", null);
    const renamed = labels.headingOf(first).text;
    opener.update("notes", "notes.note", "1", null, ["Notes", "Drafts"], "folder");
    opener.update("notes", "notes.note", "2", "Note 2", ["Notes"]);

    expect([renamed, labels.headingOf(first).text, labels.headingOf(first).icon, labels.of(first).title]).toEqual(["Notes / Plan", "Notes / Drafts / Plan", "folder", "Plan"]);
    expect(labels.headingOf(new DocumentTab("notes.note", "2")).text).toBe("2");
    expect(() => opener.update("clock", "notes.note", "1", "Plan", null)).toThrow(ArgumentException);
  });

  it("closes a shown document as the person would, showing the next tab of its group, a hidden one leaving the shown tab, and none that is not open", () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    ["1", "2", "3"].forEach(t => opener.open("notes", "notes.note", t, new DocumentHeading(`Note ${t}`), false));
    const expected = layout.layout().close(note("3"));

    opener.close("notes", "notes.note", "3");
    const shown = layout.layout().documents.active;
    opener.close("notes", "notes.note", "1");
    opener.close("notes", "notes.note", "9");

    expect(shown).toEqual(expected.documents.active);
    expect(layout.layout().documents.tabs).toEqual([note("2")]);
    expect(layout.layout().documents.active).toEqual(note("2"));
    expect(() => opener.close("clock", "notes.note", "2")).toThrow(ArgumentException);
    expect(() => opener.close("notes", "notes.page", "2")).toThrow(ArgumentException);
    expect(layout.layout().documents.tabs).toEqual([note("2")]);
  });

  it("moves focus to the tab that shows next when focus was in the closed document, and leaves it where it is otherwise", () => {
    ["1", "2"].forEach(t => opener.open("notes", "notes.note", t, new DocumentHeading(`Note ${t}`), false));
    const tabs = ["1", "2"].map(t => {
      const element = document.createElement("button");
      element.dataset["tabKey"] = new DocumentTab("notes.note", t).key;
      return document.body.appendChild(element);
    });
    const outside = document.body.appendChild(document.createElement("button"));

    outside.focus();
    opener.open("notes", "notes.note", "3", new DocumentHeading("Note 3"), false);
    opener.close("notes", "notes.note", "3");
    TestBed.tick();
    const kept = document.activeElement;
    outside.blur();
    opener.close("notes", "notes.note", "2");
    TestBed.tick();
    const moved = document.activeElement;
    [...tabs, outside].forEach(t => t.remove());

    expect([kept, moved]).toEqual([outside, tabs[0]]);
  });

  it("closes a split document group with the last document in it", () => {
    opener.open("notes", "notes.note", "1", new DocumentHeading("Note 1"), false);
    opener.open("notes", "notes.note", "2", new DocumentHeading("Note 2"), false);
    layout.place(new DocumentTab("notes.note", "2"), new SplitDropTarget(layout.layout().documents.id, PanelEdge.Right));

    opener.close("notes", "notes.note", "2");

    expect(layout.layout().documentGroups).toHaveLength(1);
    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]);
  });

  it("refuses another module's document and an unregistered one", () => {
    expect(() => opener.open("clock", "notes.note", "1", new DocumentHeading("Note 1"), false)).toThrow(ArgumentException);
    expect(() => opener.open("note", "notes.note", "1", new DocumentHeading("Note 1"), false)).toThrow(ArgumentException);
    expect(() => opener.open("notes", "notes.page", "1", new DocumentHeading("Page"), false)).toThrow(ArgumentException);
    expect(layout.layout().documents.tabs).toEqual([]);
  });
});
