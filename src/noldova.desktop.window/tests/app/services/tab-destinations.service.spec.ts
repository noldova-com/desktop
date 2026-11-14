/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { CommandRow } from "../../../src/app/models/command-row";
import { Layout } from "../../../src/app/models/layout/layout";
import { SplitDropTarget } from "../../../src/app/models/layout/split-drop-target";
import type { MenuSection } from "../../../src/app/models/menu-section";
import { LayoutService } from "../../../src/app/services/layout.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { TabDestinationsService } from "../../../src/app/services/tab-destinations.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";

describe("TabDestinationsService", () => {
  const { files, search, changes, plan, todo } = LayoutFixture;
  const registry = LayoutFixture.createRegistry();
  const prepared = Layout.createDefault(registry).openView(search, registry).openDocument(plan).openDocument(todo, true);
  let menus: MenuService;

  beforeEach(async () => {
    PreloadBridgeFixture.install();
    await LayoutServiceFixture.prepareAsync(registry, prepared);
    TestBed.inject(TabDestinationsService);
    menus = TestBed.inject(MenuService);
  });

  afterEach(() => PreloadBridgeFixture.remove());

  function rows(sections: readonly MenuSection[]): readonly (readonly string[])[] {
    return sections.map(t => t.rows.map(u => `${u.title}${u instanceof CommandRow && !u.isEnabled ? " (disabled)" : String.empty}`));
  }

  function menuOf(key: string, place: string = "desktop.tab"): readonly (readonly string[])[] {
    return rows(menus.resolve(place, { tab: key }));
  }

  it("offers a view's tab every other group that accepts it, named by its views or as the documents, and nothing for a document while it has no other documents group, or for an unknown tab", () => {
    expect(menuOf(search.key, "desktop.tabMoveTo")).toEqual([[changes.name, "Documents"]]);
    expect(menuOf(changes.key, "desktop.tabMoveTo")).toEqual([[`${files.name}, ${search.name}`, "Documents"]]);
    expect([menuOf(plan.key, "desktop.tabMoveTo"), menuOf("missing", "desktop.tabMoveTo")]).toEqual([[], []]);
  });

  it("offers a document every other documents group, numbered once there are several", () => {
    const layout = TestBed.inject(LayoutService);
    layout.place(todo, new SplitDropTarget(0, PanelEdge.Right));

    expect([menuOf(plan.key, "desktop.tabMoveTo"), menuOf(todo.key, "desktop.tabMoveTo"), menuOf(search.key, "desktop.tabMoveTo")]).toEqual([
      [["Documents 2"]],
      [["Documents 1"]],
      [[changes.name, "Documents 1", "Documents 2"]]
    ]);
  });

  it("builds the tab menu from the shell's groups, leaving out what can never apply to the tab and disabling what can't run now", () => {
    expect(menuOf(search.key)).toEqual([
      ["Move to", "Split", "Dock", "Move left", "Move right (disabled)", "Move to next group", "Move to previous group"],
      ["Close", "Close others", "Close to the right (disabled)", "Close all"]
    ]);
    expect(menuOf(todo.key)).toEqual([
      ["Keep open", "Split", "Move left", "Move right (disabled)"],
      ["Close", "Close others", "Close to the right (disabled)", "Close all"]
    ]);
    expect(menuOf(changes.key, "desktop.tabSplit")).toEqual([["Split left (disabled)", "Split right (disabled)", "Split up (disabled)", "Split down (disabled)"]]);
    expect(menuOf(changes.key, "desktop.tabDock")).toEqual([["Dock left", "Dock right", "Dock at the bottom"]]);
  });
});
