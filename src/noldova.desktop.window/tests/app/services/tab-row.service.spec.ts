/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import type { JsonObject } from "@noldova/context.json";

import { DockSide } from "../../../src/app/enums/dock-side";
import { BuildTokens } from "../../../src/app/models/build-tokens";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../src/app/models/layout/view-type";
import { MenuDeclarations } from "../../../src/app/models/menu-declarations";
import { CommandService } from "../../../src/app/services/command.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { TabRowService } from "../../../src/app/services/tab-row.service";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("TabRowService", () => {
  const page = new DocumentTab("browser.page", "1");
  const otherPage = new DocumentTab("browser.page", "2");
  const note = new DocumentTab("notes.note", "1");
  const shell = new ViewTab("terminal.shell", "1");
  const registry = new ViewRegistry([
    new ViewType("files.tree", DockSide.Left, true),
    new ViewType("terminal.shell", DockSide.Bottom, false, true, "terminal.tabRow")
  ], ["browser.page", "notes.note"], new Map([["browser.page", "browser.tabRow"]]));
  let layout: LayoutService;
  let service: TabRowService;

  beforeEach(async () => {
    PreloadBridgeFixture.install();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BuildTokens.menus, useValue: [
            MenuDeclarations.fromJson("browser", {
              places: [{ name: "browser.tabRow", title: "Browser tabs", shows: "menu" }],
              groups: [{ name: "browser.tabRowActions", place: "browser.tabRow", exclusive: false, items: [{ command: "browser.newTab", arguments: {} }] }]
            }),
            MenuDeclarations.fromJson("terminal", {
              places: [{ name: "terminal.tabRow", title: "Terminal tabs", shows: "menu" }],
              groups: [{ name: "terminal.tabRowActions", place: "terminal.tabRow", exclusive: false, items: [{ command: "terminal.new", arguments: {} }] }]
            })
          ]
        }
      ]
    });
    const none = (): Promise<null> => Promise.resolve(null);
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("browser.newTab", "New tab", "add", null, none),
      new CommandContribution("terminal.new", "New terminal", "add", null, none)
    ]);
    TestBed.inject(MenuService).setActiveModules(["browser", "terminal"]);
    layout = await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openView(shell, registry).openDocument(page).openDocument(otherPage).openDocument(note));
    service = TestBed.inject(TabRowService);
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  function rowsOf(tab: DocumentTab | ViewTab): readonly (readonly [string, JsonObject])[] {
    const group = layout.layout().groupOf(tab);
    if (Object.isNull(group))
      throw new Error(`No group holds ${tab.key}.`);
    return service.rowsOf(group).map((t): readonly [string, JsonObject] => [t.title, t.isSubmenu ? {} : t.commandArguments]);
  }

  it("shows a document's tab-row place once in the group that holds its tabs, with the active document only while it is the module's own", () => {
    const id = layout.layout().groupOf(page)?.id.toString();
    const besideNote = rowsOf(page);
    layout.activate(otherPage);

    expect([besideNote, rowsOf(page)]).toEqual([
      [["New tab", { tabGroup: id }]],
      [["New tab", { tabGroup: id, document: "browser.page", instance: "2" }]]
    ]);
  });

  it("gives a view's place only the group's id beside another module's active document", async () => {
    const base = Layout.createDefault(registry).openView(shell, registry).openDocument(page).openDocument(note);
    const groupId = base.groupOf(page)?.id ?? 0;
    layout = await LayoutServiceFixture.prepareAsync(registry, base.moveTab(shell, groupId, 2));
    layout.activate(page);

    expect([layout.layout().groupOf(shell)?.id, rowsOf(shell)]).toEqual([groupId, [
      ["New terminal", { tabGroup: groupId.toString() }],
      ["New tab", { tabGroup: groupId.toString(), document: "browser.page", instance: "1" }]
    ]]);
  });

  it("shows a view's place and no document's place in a group that holds only the view's tabs", () => {
    const id = layout.layout().groupOf(shell)?.id.toString();

    expect(rowsOf(shell)).toEqual([["New terminal", { tabGroup: id }]]);
  });

  it("shows no rows in a group whose tabs declare no place", () => {
    expect(rowsOf(new ViewTab("files.tree"))).toEqual([]);
  });
});
