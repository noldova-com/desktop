/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { ModuleMenus } from "../../../src/services/modules/module-menus.js";

@TestClass
export class ModuleMenusTests {
  private static readonly ID: string = "notes";
  private static readonly FILE: string = "notes/menus.json";
  private static readonly OWNER: string = "notes's menus.json";
  private static readonly DECLARED: readonly string[] = ["notes.file", "notes.bar", "notes.recent", "notes.tools", "notes.view", "notes.row"];
  private static readonly PAGES: readonly string[] = ["notes.page", "notes.editor"];
  private static readonly MENUS: Readonly<Record<string, unknown>> = {
    places: [
      { name: "notes.file", title: "File" },
      { name: "notes.bar", title: "Notes", shows: "menuBar" },
      { name: "notes.recent", title: "Recent", shows: "menu" },
      { name: "notes.tools", title: "Tools", shows: "toolbar", after: "shell.main" },
      { name: "notes.view", title: "View", shows: "toolbar", shown: false, before: "notes.tools" },
      { name: "notes.row", title: "Row", shows: "toolbar", newRow: true, band: "notes.page" }
    ],
    groups: [
      {
        name: "notes.fileItems",
        place: "shell.file",
        exclusive: true,
        items: [{ command: "notes.export", arguments: { all: true }, label: "Export all" }, { command: "notes.print" }, { submenu: "notes.recent" }, { choice: "notes.file" }]
      },
      { name: "notes.recentItems", place: "notes.recent", dynamic: true }
    ]
  };
  private static readonly FILE_PLACE: Readonly<Record<string, unknown>> = { name: "notes.file", title: "File" };

  @TestMethod
  public async readsThePlacesAndGroupsAsync(): Promise<void> {
    const menus = await ModuleMenusTests.readAsync(ModuleMenusTests.MENUS, ModuleMenusTests.DECLARED);

    Assert.areEqual(
      "notes.file:File:false:none notes.bar:Notes:true:none notes.recent:Recent:false:none notes.tools:Tools:false:true,shell.main,,false, notes.view:View:false:false,,notes.tools,false, notes.row:Row:false:true,,,true,notes.page",
      menus.places.map(t => `${t.name}:${t.title}:${t.isMenuBar}:${Object.isNull(t.toolbar) ? "none" : [t.toolbar.isShown, t.toolbar.after, t.toolbar.before, t.toolbar.startsRow, t.toolbar.band].join()}`).join(" "));
    Assert.areEqual("notes.fileItems:shell.file:true:false notes.recentItems:notes.recent:false:true", menus.groups.map(t => `${t.name}:${t.place}:${t.isExclusive}:${t.isDynamic}`).join(" "));
    Assert.areEqual(
      JSON.stringify([["notes.export", { all: true }, null, "Export all", null], ["notes.print", {}, null, null, null], [null, {}, "notes.recent", null, null], [null, {}, null, null, "notes.file"]]),
      JSON.stringify(menus.groups[0]?.items.map(t => [t.command, t.commandArguments, t.submenu, t.label, t.choice])));
    Assert.areEqual(0, menus.groups[1]?.items.length);
    Assert.areEqual(JSON.stringify({ places: menus.places.map(t => t.toJson()), groups: menus.groups.map(t => t.toJson()) }), JSON.stringify(menus.toJson()));
  }

  @TestMethod
  public async readsNoMenusWithoutAFileOrAnyDeclaredAsync(): Promise<void> {
    Assert.areEqual(ModuleMenus.EMPTY, await ModuleMenusTests.readAsync(undefined, []));
  }

  @TestMethod
  public async refusesDeclaredMenusWithoutAFileAsync(): Promise<void> {
    await ModuleMenusTests.assertRefusedAsync(undefined, ["notes.file"], Resources.formatMenusMissing(ModuleMenusTests.ID, ModuleMenusTests.FILE));
  }

  @TestMethod
  public async refusesAFileThatIsNotJsonAsync(): Promise<void> {
    await ModuleMenusTests.assertRefusedAsync("{", [], Resources.formatJsonFileUnreadable(ModuleMenusTests.FILE));
  }

  @TestMethod
  @TestData({ places: [], groups: [], other: 1 }, Resources.menusFileInvalid)
  @TestData({ places: {}, groups: [] }, Resources.formatModuleListMissing("places"))
  @TestData({ places: [1], groups: [] }, Resources.menusPlaceInvalid)
  @TestData({ places: [{ name: "notes.file", title: "File", icon: "f" }], groups: [] }, Resources.menusPlaceInvalid)
  @TestData({ places: [{ name: "notes.other", title: "Other" }], groups: [] }, Resources.formatMenusPlaceUndeclared("notes.other"))
  @TestData({ places: [{ name: 1, title: "Other" }], groups: [] }, Resources.formatMenusPlaceUndeclared(1))
  @TestData({ places: [{ name: "notes.file", title: " " }], groups: [] }, Resources.formatMenusPlaceTitleMissing("notes.file"))
  @TestData({ places: [{ name: "notes.file" }], groups: [] }, Resources.formatMenusPlaceTitleMissing("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "panel" }], groups: [] }, Resources.formatMenusPlaceShowsInvalid("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: 1 }], groups: [] }, Resources.formatMenusPlaceShowsInvalid("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", shown: true }], groups: [] }, Resources.formatMenusToolbarFieldsMisplaced("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "toolbar", shown: "yes" }], groups: [] }, Resources.formatMenusToolbarShownInvalid("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "toolbar", newRow: 1 }], groups: [] }, Resources.formatMenusToolbarNewRowInvalid("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "toolbar", after: "shell.a", before: "shell.b" }], groups: [] }, Resources.formatMenusToolbarAnchorsRepeated("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "toolbar", after: "shell.a", newRow: true }], groups: [] }, Resources.formatMenusToolbarAnchorsRepeated("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "toolbar", after: "Shell" }], groups: [] }, Resources.formatMenusToolbarAnchorInvalid("notes.file", "after"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "toolbar", after: "notes.file" }], groups: [] }, Resources.formatMenusToolbarAnchorInvalid("notes.file", "after"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "toolbar", before: 1 }], groups: [] }, Resources.formatMenusToolbarAnchorInvalid("notes.file", "before"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "toolbar", band: "notes.other" }], groups: [] }, Resources.formatMenusToolbarBandInvalid("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", shows: "toolbar", band: 1 }], groups: [] }, Resources.formatMenusToolbarBandInvalid("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File", band: "notes.page" }], groups: [] }, Resources.formatMenusToolbarFieldsMisplaced("notes.file"))
  @TestData({ places: [{ name: "notes.file", title: "File" }, { name: "notes.file", title: "Again" }], groups: [] }, Resources.menusPlaceRepeated)
  @TestData({ places: [], groups: [] }, Resources.formatMenusPlacesUndescribed(["notes.file"]))
  public async refusesPlacesThatBreakTheContractAsync(menus: unknown, problem: string): Promise<void> {
    await ModuleMenusTests.assertRefusedAsync(menus, ["notes.file"], Resources.formatModuleFileProblem(ModuleMenusTests.FILE, problem));
  }

  @TestMethod
  @TestData({}, Resources.formatModuleListMissing("groups"))
  @TestData([1], Resources.menusGroupInvalid)
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ command: "notes.run" }], icon: "g" }], Resources.menusGroupInvalid)
  @TestData([{ name: "other.g", place: "shell.file", items: [{ command: "notes.run" }] }], Resources.formatMenusGroupNameInvalid("notes"))
  @TestData([{ name: "notes.Group", place: "shell.file", items: [{ command: "notes.run" }] }], Resources.formatMenusGroupNameInvalid("notes"))
  @TestData([{ name: 1, place: "shell.file", items: [{ command: "notes.run" }] }], Resources.formatMenusGroupNameInvalid("notes"))
  @TestData([{ name: "notes.g", place: "Shell", items: [{ command: "notes.run" }] }], Resources.formatMenusGroupPlaceInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: 1, items: [{ command: "notes.run" }] }], Resources.formatMenusGroupPlaceInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", exclusive: "yes", items: [{ command: "notes.run" }] }], Resources.formatMenusGroupExclusiveInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", dynamic: 1 }], Resources.formatMenusGroupDynamicInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", dynamic: true, items: [] }], Resources.formatMenusDynamicGroupItems("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file" }], Resources.formatModuleListMissing(Resources.formatMenusGroupItemsLabel("notes.g")))
  @TestData([{ name: "notes.g", place: "shell.file", items: [] }], Resources.formatMenusGroupEmpty("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [1] }], Resources.formatMenusItemInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ submenu: "notes.file", label: "s" }] }], Resources.formatMenusItemInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ choice: "notes.file", label: "c" }] }], Resources.formatMenusItemInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ command: "notes.run", icon: "r" }] }], Resources.formatMenusItemInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ choice: "notes.other" }] }], Resources.formatMenusChoiceUnknown("notes.other", "notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ choice: 1 }] }], Resources.formatMenusChoiceUnknown(1, "notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ submenu: "notes.other" }] }], Resources.formatMenusSubmenuUnknown("notes.other", "notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ submenu: 1 }] }], Resources.formatMenusSubmenuUnknown(1, "notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ command: "Run" }] }], Resources.formatMenusItemCommandInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ label: "Run" }] }], Resources.formatMenusItemCommandInvalid("notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ command: "notes.run", arguments: [] }] }], Resources.formatMenusItemArgumentsInvalid("notes.run", "notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ command: "notes.run", label: " " }] }], Resources.formatMenusItemLabelInvalid("notes.run", "notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ command: "notes.run", label: 1 }] }], Resources.formatMenusItemLabelInvalid("notes.run", "notes.g"))
  @TestData([{ name: "notes.g", place: "shell.file", items: [{ command: "notes.run" }] }, { name: "notes.g", place: "shell.edit", items: [{ command: "notes.run" }] }], Resources.menusGroupRepeated)
  public async refusesGroupsThatBreakTheContractAsync(groups: unknown, problem: string): Promise<void> {
    await ModuleMenusTests.assertRefusedAsync({ places: [ModuleMenusTests.FILE_PLACE], groups }, ["notes.file"], Resources.formatModuleFileProblem(ModuleMenusTests.FILE, problem));
  }

  @TestMethod
  public async refusesAPlaceThatOpensInsideItselfAsync(): Promise<void> {
    const menus = {
      places: [ModuleMenusTests.FILE_PLACE, { name: "notes.recent", title: "Recent" }],
      groups: [{ name: "notes.first", place: "notes.file", items: [{ submenu: "notes.recent" }] }, { name: "notes.second", place: "notes.recent", items: [{ choice: "notes.file" }] }]
    };

    await ModuleMenusTests.assertRefusedAsync(menus, ["notes.file", "notes.recent"],
      Resources.formatModuleFileProblem(ModuleMenusTests.FILE, Resources.formatMenusCycle("notes.file", ["notes.file", "notes.recent"])));
  }

  @TestMethod
  public async acceptsReferencesToKnownPlacesToolbarsAndCommandsAsync(): Promise<void> {
    const menus = await ModuleMenusTests.readAsync(ModuleMenusTests.MENUS, ModuleMenusTests.DECLARED);

    Assert.doesNotThrow(() => menus.checkReferences(ModuleMenusTests.ID, new Set(["shell.file", "notes.recent"]), new Set(["shell.main", "notes.tools"]), new Set(["notes.export", "notes.print"])));
  }

  @TestMethod
  public async refusesReferencesToUnknownToolbarsPlacesOrCommandsAsync(): Promise<void> {
    const menus = await ModuleMenusTests.readAsync(ModuleMenusTests.MENUS, ModuleMenusTests.DECLARED);
    const places = new Set(["shell.file", "notes.recent"]);
    const toolbars = new Set(["shell.main", "notes.tools"]);
    const commands = new Set(["notes.export", "notes.print"]);

    const anchor = Assert.throws(() => menus.checkReferences(ModuleMenusTests.ID, places, new Set(["notes.tools"]), commands), BuildException);
    const before = Assert.throws(() => menus.checkReferences(ModuleMenusTests.ID, places, new Set(["shell.main"]), commands), BuildException);
    const place = Assert.throws(() => menus.checkReferences(ModuleMenusTests.ID, new Set(["notes.recent"]), toolbars, commands), BuildException);
    const command = Assert.throws(() => menus.checkReferences(ModuleMenusTests.ID, places, toolbars, new Set(["notes.export"])), BuildException);

    Assert.areEqual(Resources.formatMenusToolbarAnchorUnknown(ModuleMenusTests.OWNER, "notes.tools", "shell.main"), anchor.message);
    Assert.areEqual(Resources.formatMenusToolbarAnchorUnknown(ModuleMenusTests.OWNER, "notes.view", "notes.tools"), before.message);
    Assert.areEqual(Resources.formatMenusGroupPlaceUnknown(ModuleMenusTests.OWNER, "notes.fileItems", "shell.file"), place.message);
    Assert.areEqual(Resources.formatMenusCommandUnknown(ModuleMenusTests.OWNER, "notes.print"), command.message);
  }

  @TestMethod
  public async refusesOpeningItsOwnToolbarAsAMenuAsync(): Promise<void> {
    const menus = await ModuleMenusTests.readAsync({
      places: [{ name: "notes.tools", title: "Tools", shows: "toolbar" }],
      groups: [{ name: "notes.g", place: "shell.file", items: [{ submenu: "notes.tools" }] }]
    }, ["notes.tools"]);

    const error = Assert.throws(() => menus.checkReferences(ModuleMenusTests.ID, new Set(["shell.file"]), new Set(), new Set()), BuildException);

    Assert.areEqual(Resources.formatMenusToolbarAsMenu(ModuleMenusTests.OWNER, "notes.tools", "notes.g"), error.message);
  }

  private static async assertRefusedAsync(content: unknown, declared: readonly string[], message: string): Promise<void> {
    const error = await Assert.throwsAsync(() => ModuleMenusTests.readAsync(content, declared), BuildException);

    Assert.areEqual(message, error.message);
  }

  private static async readAsync(content: unknown, declared: readonly string[]): Promise<ModuleMenus> {
    const root = await mkdtemp(path.join(tmpdir(), "module-menus-"));
    try {
      await mkdir(path.join(root, ModuleMenusTests.ID));
      if (Object.isString(content))
        await writeFile(path.join(root, ModuleMenusTests.FILE), content);
      else if (!Object.isUndefined(content))
        await writeFile(path.join(root, ModuleMenusTests.FILE), JSON.stringify(content));
      return await ModuleMenus.readAsync(root, ModuleMenusTests.ID, ModuleMenusTests.ID, declared, ModuleMenusTests.PAGES);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}
