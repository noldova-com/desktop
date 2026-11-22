/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { MenuGroup } from "../../models/modules/menu-group.ts";
import { MenuItem } from "../../models/modules/menu-item.ts";
import { MenuPlace } from "../../models/modules/menu-place.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";
import { ToolbarPlacement } from "../../models/modules/toolbar-placement.ts";

export class ModuleMenus {

  public static readonly EMPTY: ModuleMenus = new ModuleMenus([], []);

  public readonly places: readonly MenuPlace[];
  public readonly groups: readonly MenuGroup[];

  private constructor(places: readonly MenuPlace[], groups: readonly MenuGroup[]) {
    this.places = places;
    this.groups = groups;
  }

  public static async readAsync(root: string, folder: string, id: string, declared: readonly string[], pages: readonly string[]): Promise<ModuleMenus> {
    const file = Resources.formatFolderFile(folder, Resources.menusFileName);
    const fail = (problem: string): BuildException => new BuildException(Resources.formatModuleFileProblem(file, problem));
    if (!existsSync(path.join(root, file))) {
      if (declared.length > 0)
        throw new BuildException(Resources.formatMenusMissing(folder, file));
      return ModuleMenus.EMPTY;
    }
    let value: JsonObject;
    try {
      value = JsonReader.parse(await readFile(path.join(root, file), Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatJsonFileUnreadable(file), new ExceptionOptions(error));
    }
    const record = ModuleMenus.readRecord(value, Resources.menusFields, fail, Resources.menusFileInvalid);
    const places = ModuleMenus.readArray(record.get(Resources.placesField), fail, Resources.placesField).map(t => ModuleMenus.readPlace(t, declared, pages, fail));
    const names = places.map(t => t.name);
    if (new Set(names).size < names.length)
      throw fail(Resources.menusPlaceRepeated);
    const undescribed = declared.filter(t => !names.includes(t));
    if (undescribed.length > 0)
      throw fail(Resources.formatMenusPlacesUndescribed(undescribed));
    const groups = ModuleMenus.readArray(record.get(Resources.groupsField), fail, Resources.groupsField).map(t => ModuleMenus.readGroup(t, id, declared, fail));
    const groupNames = groups.map(t => t.name);
    if (new Set(groupNames).size < groupNames.length)
      throw fail(Resources.menusGroupRepeated);
    ModuleMenus.refuseCycles(groups, fail);
    return new ModuleMenus(places, groups);
  }

  public checkReferences(id: string, places: ReadonlySet<string>, toolbars: ReadonlySet<string>, commands: ReadonlySet<string>): void {
    const file = Resources.formatMenusOwner(id);
    const own = new Set(this.places.filter(t => !Object.isNull(t.toolbar)).map(t => t.name));
    for (const place of this.places)
      for (const anchor of [place.toolbar?.after ?? null, place.toolbar?.before ?? null])
        if (!Object.isNull(anchor) && !toolbars.has(anchor))
          throw new BuildException(Resources.formatMenusToolbarAnchorUnknown(file, place.name, anchor));
    for (const group of this.groups) {
      if (!places.has(group.place))
        throw new BuildException(Resources.formatMenusGroupPlaceUnknown(file, group.name, group.place));
      for (const item of group.items) {
        if (!Object.isNull(item.command) && !commands.has(item.command))
          throw new BuildException(Resources.formatMenusCommandUnknown(file, item.command));
        const opened = item.submenu ?? item.choice;
        if (!Object.isNull(opened) && own.has(opened))
          throw new BuildException(Resources.formatMenusToolbarAsMenu(file, opened, group.name));
      }
    }
  }

  public toJson(): Readonly<Record<string, unknown>> {
    return { places: this.places.map(t => t.toJson()), groups: this.groups.map(t => t.toJson()) };
  }

  private static readPlace(value: unknown, declared: readonly string[], pages: readonly string[], fail: (problem: string) => BuildException): MenuPlace {
    const record = ModuleMenus.readRecord(value, Resources.menuPlaceFields, fail, Resources.menusPlaceInvalid);
    const name = record.get(Resources.nameField);
    if (!Object.isString(name) || !declared.includes(name))
      throw fail(Resources.formatMenusPlaceUndeclared(name));
    const title = record.get(Resources.titleField);
    if (!Object.isString(title) || String.isNullOrWhitespace(title))
      throw fail(Resources.formatMenusPlaceTitleMissing(name));
    const shows = record.get(Resources.showsField) ?? Resources.menuShowsMenu;
    if (!Object.isString(shows) || !Resources.menuShows.includes(shows))
      throw fail(Resources.formatMenusPlaceShowsInvalid(name));
    if (shows !== Resources.menuShowsToolbar) {
      if (Resources.menuToolbarFields.some(t => record.has(t)))
        throw fail(Resources.formatMenusToolbarFieldsMisplaced(name));
      return new MenuPlace(name, title, shows === Resources.menuShowsMenuBar);
    }
    return new MenuPlace(name, title, false, ModuleMenus.readToolbar(record, name, pages, fail));
  }

  private static readToolbar(record: ReadonlyMap<string, unknown>, name: string, pages: readonly string[], fail: (problem: string) => BuildException): ToolbarPlacement {
    const isShown = record.get(Resources.shownField) ?? true;
    if (!Object.isBoolean(isShown))
      throw fail(Resources.formatMenusToolbarShownInvalid(name));
    const startsRow = record.get(Resources.newRowField) ?? false;
    if (!Object.isBoolean(startsRow))
      throw fail(Resources.formatMenusToolbarNewRowInvalid(name));
    const anchors = Resources.menuAnchorFields.filter(t => record.has(t));
    if (anchors.length + (startsRow ? 1 : 0) > 1)
      throw fail(Resources.formatMenusToolbarAnchorsRepeated(name));
    const read = (field: string): string | null => {
      if (!record.has(field))
        return null;
      const anchor = record.get(field);
      if (!Object.isString(anchor) || !Resources.qualifiedNamePattern.test(anchor) || anchor === name)
        throw fail(Resources.formatMenusToolbarAnchorInvalid(name, field));
      return anchor;
    };
    const band = record.get(Resources.bandField) ?? null;
    if (!Object.isNull(band) && !(Object.isString(band) && pages.includes(band)))
      throw fail(Resources.formatMenusToolbarBandInvalid(name));
    return new ToolbarPlacement(isShown, read(Resources.afterField), read(Resources.beforeField), startsRow, band);
  }

  private static readGroup(value: unknown, id: string, declared: readonly string[], fail: (problem: string) => BuildException): MenuGroup {
    const record = ModuleMenus.readRecord(value, Resources.menuGroupFields, fail, Resources.menusGroupInvalid);
    const name = record.get(Resources.nameField);
    if (!Object.isString(name) || !name.startsWith(Resources.formatQualifiedPrefix(id)) || !Resources.camelCaseNamePattern.test(name.slice(id.length + 1)))
      throw fail(Resources.formatMenusGroupNameInvalid(id));
    const place = record.get(Resources.placeField);
    if (!Object.isString(place) || !Resources.qualifiedNamePattern.test(place))
      throw fail(Resources.formatMenusGroupPlaceInvalid(name));
    const exclusive = record.get(Resources.exclusiveField) ?? false;
    if (!Object.isBoolean(exclusive))
      throw fail(Resources.formatMenusGroupExclusiveInvalid(name));
    const isDynamic = record.get(Resources.dynamicField) ?? false;
    if (!Object.isBoolean(isDynamic))
      throw fail(Resources.formatMenusGroupDynamicInvalid(name));
    if (isDynamic) {
      if (record.has(Resources.itemsField))
        throw fail(Resources.formatMenusDynamicGroupItems(name));
      return new MenuGroup(name, place, exclusive, [], true);
    }
    const items = ModuleMenus.readArray(record.get(Resources.itemsField), fail, Resources.formatMenusGroupItemsLabel(name));
    if (items.length === 0)
      throw fail(Resources.formatMenusGroupEmpty(name));
    return new MenuGroup(name, place, exclusive, items.map(t => ModuleMenus.readItem(t, name, declared, fail)));
  }

  private static readItem(value: unknown, group: string, declared: readonly string[], fail: (problem: string) => BuildException): MenuItem {
    const isSubmenu = Object.isPlainObject(value) && Resources.submenuField in value;
    const isChoice = Object.isPlainObject(value) && Resources.choiceField in value;
    const record = ModuleMenus.readRecord(value, isSubmenu ? Resources.menuSubmenuFields : isChoice ? Resources.menuChoiceFields : Resources.menuCommandFields, fail,
      Resources.formatMenusItemInvalid(group));
    if (isChoice) {
      const choice = record.get(Resources.choiceField);
      if (!Object.isString(choice) || !declared.includes(choice))
        throw fail(Resources.formatMenusChoiceUnknown(choice, group));
      return new MenuItem(null, {}, null, null, choice);
    }
    if (isSubmenu) {
      const submenu = record.get(Resources.submenuField);
      if (!Object.isString(submenu) || !declared.includes(submenu))
        throw fail(Resources.formatMenusSubmenuUnknown(submenu, group));
      return new MenuItem(null, {}, submenu);
    }
    const command = record.get(Resources.commandField);
    if (!Object.isString(command) || !Resources.qualifiedNamePattern.test(command))
      throw fail(Resources.formatMenusItemCommandInvalid(group));
    const commandArguments = record.has(Resources.argumentsField) ? record.get(Resources.argumentsField) : {};
    if (!Object.isPlainObject(commandArguments))
      throw fail(Resources.formatMenusItemArgumentsInvalid(command, group));
    const label = record.get(Resources.labelField);
    if (record.has(Resources.labelField) && (!Object.isString(label) || String.isNullOrWhitespace(label)))
      throw fail(Resources.formatMenusItemLabelInvalid(command, group));
    return new MenuItem(command, { ...commandArguments }, null, Object.isString(label) ? label : null);
  }

  private static refuseCycles(groups: readonly MenuGroup[], fail: (problem: string) => BuildException): void {
    const edges = new Map<string, string[]>();
    for (const group of groups)
      for (const item of group.items)
        if (!Object.isNull(item.submenu) || !Object.isNull(item.choice))
          edges.set(group.place, [...edges.get(group.place) ?? [], item.submenu ?? String(item.choice)]);
    const visit = (place: string, path: readonly string[]): void => {
      if (path.includes(place))
        throw fail(Resources.formatMenusCycle(place, path));
      for (const next of edges.get(place) ?? [])
        visit(next, [...path, place]);
    };
    for (const place of edges.keys())
      visit(place, []);
  }

  private static readRecord(value: unknown, fields: readonly string[], fail: (problem: string) => BuildException, problem: string): ReadonlyMap<string, unknown> {
    if (!Object.isPlainObject(value) || Object.keys(value).some(t => !fields.includes(t)))
      throw fail(problem);
    return new Map(Object.entries(value));
  }

  private static readArray(value: unknown, fail: (problem: string) => BuildException, field: string): readonly unknown[] {
    if (!Array.isArray(value))
      throw fail(Resources.formatModuleListMissing(field));

    return value;
  }
}
