/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import type { JsonObject } from "@noldova/context.json";

import { DockSide } from "../../../src/app/enums/dock-side";
import { TabLabel } from "../../../src/app/models/layout/tab-label";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewType } from "../../../src/app/models/layout/view-type";
import type { MenuItem } from "../../../src/app/models/menu-item";
import { LayoutMenuService } from "../../../src/app/services/layout-menu.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("LayoutMenuService", () => {
  beforeEach(() => {
    PreloadBridgeFixture.install();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    PreloadBridgeFixture.remove();
  });

  function provided(): readonly [string, (context: JsonObject) => readonly MenuItem[]] {
    const provide = vi.spyOn(TestBed.inject(MenuService), "provideGroup");
    TestBed.inject(LayoutMenuService);
    const [call] = provide.mock.calls;
    if (provide.mock.calls.length !== 1 || Object.isUndefined(call))
      throw new Error("The layout menu provided no group, or more than one.");
    return call;
  }

  function read(items: readonly MenuItem[]): readonly (readonly [string | null, JsonObject, string | null])[] {
    return items.map(t => [t.command, t.commandArguments, t.label]);
  }

  it("provides the layout's views group", () => {
    expect(provided()[0]).toBe("desktop.layoutViews");
  });

  it("offers to show or hide each view without instances, under its label, or its name when it has none", () => {
    TestBed.inject(LayoutService).setRegistry(new ViewRegistry([
      new ViewType("files.tree", DockSide.Left, true),
      new ViewType("git.changes", DockSide.Right, false),
      new ViewType("terminal.shell", DockSide.Bottom, false, true)
    ], ["notes.note"]));
    TestBed.inject(TabLabelService).register("files.tree", new TabLabel("Files", "folder"));
    const [, items] = provided();

    expect(read(items({}))).toEqual([
      ["desktop.toggleView", { view: "files.tree" }, "Files"],
      ["desktop.toggleView", { view: "git.changes" }, "git.changes"]
    ]);
  });

  it("follows the views the layout has when the menu is read", () => {
    const [, items] = provided();
    const before = read(items({}));

    TestBed.inject(LayoutService).setRegistry(new ViewRegistry([new ViewType("files.search", DockSide.Left, false)], []));

    expect([before, read(items({}))]).toEqual([[], [["desktop.toggleView", { view: "files.search" }, "files.search"]]]);
  });
});
