/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DocumentHeading } from "../../../src/app/models/document-heading";
import { DocumentLook } from "../../../src/app/models/document-look";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { TabLabel } from "../../../src/app/models/layout/tab-label";
import { ViewBadge } from "../../../src/app/models/view-badge";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { LayoutFixture } from "../../fixtures/layout.fixture";

describe("TabLabelService", () => {
  it("names a tab by its registered title and icon, numbering instances", () => {
    const labels = TestBed.inject(TabLabelService);
    labels.register("files.tree", new TabLabel("Files", "folder"));
    labels.register("terminal.shell", new TabLabel("Terminal", "terminal"));

    expect(labels.of(LayoutFixture.files)).toEqual(new TabLabel("Files", "folder"));
    expect(labels.of(LayoutFixture.secondTerminal)).toEqual(new TabLabel("Terminal 2", "terminal"));
  });

  it("keeps one badge per view for each of its tabs, replaces and clears it, and never badges a document", () => {
    const labels = TestBed.inject(TabLabelService);
    const unread = new ViewBadge(3, "3 unread");
    labels.setBadge("terminal.shell", new ViewBadge(null, "Running"));
    labels.setBadge("terminal.shell", unread);
    labels.setBadge("files.tree", new ViewBadge(1, "1 change"));
    labels.setBadge("files.tree", null);
    labels.setBadge("notes.note", unread);

    expect([labels.badgeOf(LayoutFixture.terminal), labels.badgeOf(LayoutFixture.secondTerminal)]).toEqual([unread, unread]);
    expect([labels.badgeOf(LayoutFixture.files), labels.badgeOf(LayoutFixture.plan)]).toEqual([null, null]);
  });

  it("keeps whether each tab is working by its key, for views and documents alike", () => {
    const labels = TestBed.inject(TabLabelService);

    labels.setWorking(LayoutFixture.terminal.key, true);
    labels.setWorking(LayoutFixture.plan.key, true);
    labels.setWorking(LayoutFixture.plan.key, true);
    labels.setWorking(LayoutFixture.files.key, false);
    const working = [LayoutFixture.terminal, LayoutFixture.secondTerminal, LayoutFixture.plan, LayoutFixture.files].map(t => labels.isWorking(t));
    labels.setWorking(LayoutFixture.plan.key, false);

    expect([working, labels.isWorking(LayoutFixture.plan)]).toEqual([[true, false, true, false], false]);
  });

  it("keeps whether each tab is waiting by its key, for views and documents alike, apart from whether it is working", () => {
    const labels = TestBed.inject(TabLabelService);

    labels.setWaiting(LayoutFixture.terminal.key, true);
    labels.setWaiting(LayoutFixture.plan.key, true);
    labels.setWaiting(LayoutFixture.plan.key, true);
    labels.setWaiting(LayoutFixture.files.key, false);
    labels.setWorking(LayoutFixture.plan.key, true);
    const waiting = [LayoutFixture.terminal, LayoutFixture.secondTerminal, LayoutFixture.plan, LayoutFixture.files].map(t => labels.isWaiting(t));
    labels.setWaiting(LayoutFixture.plan.key, false);

    expect([waiting, labels.isWaiting(LayoutFixture.plan), labels.isWorking(LayoutFixture.plan), labels.isWorking(LayoutFixture.terminal)])
      .toEqual([[true, false, true, false], false, true, false]);
  });

  it("names a tab by its own title before its registered label", () => {
    const labels = TestBed.inject(TabLabelService);
    labels.register("notes.note", new TabLabel("Note", "note"));
    labels.setTitle(LayoutFixture.plan, "Plan for Monday");
    labels.setTitle(LayoutFixture.files, "Project files");

    expect(labels.of(LayoutFixture.plan)).toEqual(new TabLabel("Plan for Monday", "note"));
    expect(labels.of(LayoutFixture.files)).toEqual(new TabLabel("Project files", "web_asset"));
    expect(labels.of(LayoutFixture.todo)).toEqual(new TabLabel("Note todo", "note"));
    labels.setTitle(LayoutFixture.todo, "Todo");
    expect(labels.of(new DocumentTab("desktop.settings", "x"))).toEqual(new TabLabel("x", "description"));
    expect(labels.of(LayoutFixture.todo).title).toBe("Todo");
    labels.setTitle(LayoutFixture.settings, "Settings");
    expect(labels.of(LayoutFixture.settings)).toEqual(new TabLabel("Settings", "description"));
  });

  it("gives a titled tab its own glyph before its registered icon", () => {
    const labels = TestBed.inject(TabLabelService);
    labels.register("terminal.shell", new TabLabel("Terminal", "terminal"));
    labels.setTitle(LayoutFixture.terminal, "pwsh");
    labels.setTitle(LayoutFixture.secondTerminal, "bash");
    labels.setIcon(LayoutFixture.secondTerminal, "code");

    expect([labels.of(LayoutFixture.terminal), labels.of(LayoutFixture.secondTerminal)]).toEqual([new TabLabel("pwsh", "terminal"), new TabLabel("bash", "code")]);
  });

  it("keeps a document's breadcrumb with its title, and gives any other tab its label's title with none", () => {
    const labels = TestBed.inject(TabLabelService);
    labels.register("files.tree", new TabLabel("Files", "folder"));
    labels.setHeading(LayoutFixture.plan, new DocumentHeading("Plan", ["Notes", "Drafts"]));

    expect([labels.headingOf(LayoutFixture.plan).text, labels.of(LayoutFixture.plan).title]).toEqual(["Notes / Drafts / Plan", "Plan"]);
    expect(labels.headingOf(LayoutFixture.files)).toEqual(new DocumentHeading("Files"));
  });

  it("keeps a breadcrumb's glyph until a heading without one comes or the tab is forgotten", () => {
    const labels = TestBed.inject(TabLabelService);
    labels.setHeading(LayoutFixture.plan, new DocumentHeading("Plan", ["Notes"], "folder"));
    labels.setHeading(LayoutFixture.terminal, new DocumentHeading("pwsh", ["Work"], "terminal"));
    const given = [labels.headingOf(LayoutFixture.plan).icon, labels.headingOf(LayoutFixture.terminal).icon];
    labels.setHeading(LayoutFixture.plan, new DocumentHeading("Plan", ["Notes"]));
    labels.forget(LayoutFixture.terminal.key);

    expect([given, labels.headingOf(LayoutFixture.plan).icon, labels.headingOf(LayoutFixture.terminal)]).toEqual([["folder", "terminal"], null, new DocumentHeading("1")]);
  });

  it("keeps each document tab's look by its key, and gives a tab without one no look", () => {
    const labels = TestBed.inject(TabLabelService);
    const first = new DocumentTab("browser.page", "1");
    const look = DocumentLook.none.updated({ underline: "Shared" });
    labels.setLook(first, look);

    expect([labels.lookOf(first), labels.lookOf(new DocumentTab("browser.page", "2"))]).toEqual([look, DocumentLook.none]);
  });

  it("drops only the looks of the tabs it is asked to", () => {
    const labels = TestBed.inject(TabLabelService);
    const first = new DocumentTab("browser.page", "1");
    const second = new DocumentTab("browser.page", "2");
    const look = DocumentLook.none.updated({ underline: "Shared" });
    labels.setLook(first, look);
    labels.setLook(second, look);

    labels.dropLooks(t => t.equals(first));
    labels.dropLooks(() => false);

    expect([labels.lookOf(first), labels.lookOf(second)]).toEqual([DocumentLook.none, look]);
  });

  it("falls back to the instance or the name with a generic icon", () => {
    const labels = TestBed.inject(TabLabelService);

    expect(labels.of(LayoutFixture.changes)).toEqual(new TabLabel("git.changes", "web_asset"));
    expect(labels.of(LayoutFixture.plan)).toEqual(new TabLabel("plan", "description"));
  });
});
