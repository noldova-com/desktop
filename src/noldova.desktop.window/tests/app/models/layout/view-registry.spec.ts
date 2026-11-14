/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewType } from "../../../../src/app/models/layout/view-type";
import { LayoutFixture } from "../../../fixtures/layout.fixture";

describe("ViewRegistry", () => {
  it("lists views in registration order and answers for views and documents", () => {
    const registry = LayoutFixture.createRegistry();

    expect(registry.views.map(t => t.name)).toEqual(["files.tree", "files.search", "git.changes", "terminal.shell"]);
    expect(registry.view("git.changes").defaultSide).toBe(DockSide.Right);
    expect([registry.hasView("files.tree"), registry.hasView("notes.note")]).toEqual([true, false]);
    expect([registry.hasDocument("notes.note"), registry.hasDocument("files.tree")]).toEqual([true, false]);
    expect(() => registry.view("gone.view")).toThrow("No view named \"gone.view\" is registered.");
  });

  it("is empty when created empty", () => {
    expect(ViewRegistry.createEmpty().views).toEqual([]);
  });

  it("answers each document's tab-row place, and null for a document without one or one it does not hold", () => {
    const registry = new ViewRegistry([], ["browser.page", "notes.note"], new Map([["browser.page", "browser.tabRow"]]));

    expect([registry.documentTabRowPlace("browser.page"), registry.documentTabRowPlace("notes.note"), registry.documentTabRowPlace("gone.page")]).toEqual(["browser.tabRow", null, null]);
  });

  it("refuses a tab-row place for a document it does not hold, or one without its module id", () => {
    expect(() => new ViewRegistry([], ["browser.page"], new Map([["notes.note", "notes.tabRow"]]))).toThrowError(ArgumentException);
    expect(() => new ViewRegistry([], ["browser.page"], new Map([["browser.page", "tabRow"]]))).toThrowError(ArgumentException);
  });

  it("answers which views and documents a person can rename, and no for one it does not hold", () => {
    const registry = new ViewRegistry([
      new ViewType("files.tree", DockSide.Left, true),
      new ViewType("terminal.shell", DockSide.Bottom, false, true, null, true)
    ], ["browser.page", "notes.note"], new Map(), new Set(["notes.note"]));

    expect([registry.isRenamableView("terminal.shell"), registry.isRenamableView("files.tree"), registry.isRenamableView("gone.view")]).toEqual([true, false, false]);
    expect([registry.isRenamableDocument("notes.note"), registry.isRenamableDocument("browser.page"), registry.isRenamableDocument("gone.page")])
      .toEqual([true, false, false]);
  });

  it("refuses a renamable document it does not hold", () => {
    expect(() => new ViewRegistry([], ["browser.page"], new Map(), new Set(["notes.note"]))).toThrowError(ArgumentException);
  });

  it("rejects repeated names and invalid document names", () => {
    const tree = new ViewType("files.tree", DockSide.Left, true);

    expect(() => new ViewRegistry([tree, new ViewType("files.tree", DockSide.Right, false)], [])).toThrow(ArgumentException);
    expect(() => new ViewRegistry([], ["notes.note", "notes.note"])).toThrow(ArgumentException);
    expect(() => new ViewRegistry([], ["note"])).toThrow(ArgumentException);
  });
});
