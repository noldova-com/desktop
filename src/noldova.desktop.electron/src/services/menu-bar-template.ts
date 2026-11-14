/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MenuItemConstructorOptions } from "electron";

import "@noldova/context.core";
import type { KeyChord } from "@noldova/desktop.protocol";

import { MenuBarRowType } from "../enums/menu-bar-row-type.js";
import { MenuCheck } from "../enums/menu-check.js";
import type { MenuBar } from "../models/menu-bar.js";
import type { MenuBarMenu } from "../models/menu-bar-menu.js";
import type { MenuBarRow } from "../models/menu-bar-row.js";
import { Resources } from "../resources.js";

export class MenuBarTemplate {
  private static readonly SEPARATOR: MenuItemConstructorOptions = { type: Resources.separatorMenuType };
  private static readonly EDIT_ITEMS: readonly MenuItemConstructorOptions[] = [
    { role: Resources.undoRole }, { role: Resources.redoRole }, MenuBarTemplate.SEPARATOR, { role: Resources.cutRole }, { role: Resources.copyRole }, { role: Resources.pasteRole }, { role: Resources.pasteAndMatchStyleRole },
    { role: Resources.deleteRole }, { role: Resources.selectAllRole }, MenuBarTemplate.SEPARATOR, { label: Resources.speechLabel, submenu: [{ role: Resources.startSpeakingRole }, { role: Resources.stopSpeakingRole }] }
  ];
  private static readonly APP_ITEMS: readonly MenuItemConstructorOptions[] = [
    { role: Resources.servicesRole }, MenuBarTemplate.SEPARATOR, { role: Resources.hideRole }, { role: Resources.hideOthersRole }, { role: Resources.unhideRole }, MenuBarTemplate.SEPARATOR, { role: Resources.quitRole }
  ];
  private static readonly WINDOW_ITEMS: readonly MenuItemConstructorOptions[] = [
    { role: Resources.minimizeRole }, { role: Resources.zoomRole }, MenuBarTemplate.SEPARATOR, { role: Resources.closeRole, label: Resources.closeWindowLabel, accelerator: Resources.closeWindowAccelerator },
    MenuBarTemplate.SEPARATOR, { role: Resources.frontRole }
  ];

  public static build(bar: MenuBar, run: (id: string) => void): MenuItemConstructorOptions[] {
    const app = bar.menus.find(t => t.place === Resources.appMenu)?.rows.map(t => MenuBarTemplate.itemOf(t, run)) ?? [];
    return [MenuBarTemplate.appMenu(app), ...bar.menus.filter(t => t.place !== Resources.appMenu).flatMap(t => MenuBarTemplate.menuOf(t, run))];
  }

  public static standard(): MenuItemConstructorOptions[] {
    return [MenuBarTemplate.appMenu([]), MenuBarTemplate.editMenu(Resources.editTitle, []), MenuBarTemplate.windowMenu(Resources.windowTitle, [])];
  }

  private static appMenu(rows: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions {
    return { label: Resources.applicationName, submenu: [{ role: Resources.aboutRole }, MenuBarTemplate.SEPARATOR, ...MenuBarTemplate.before(rows, MenuBarTemplate.APP_ITEMS)] };
  }

  private static editMenu(title: string, rows: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions {
    return { label: title, submenu: MenuBarTemplate.after(MenuBarTemplate.EDIT_ITEMS, rows) };
  }

  private static windowMenu(title: string, rows: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions {
    return { label: title, role: Resources.windowRole, submenu: MenuBarTemplate.after(MenuBarTemplate.WINDOW_ITEMS, rows) };
  }

  private static menuOf(menu: MenuBarMenu, run: (id: string) => void): MenuItemConstructorOptions[] {
    const rows = menu.rows.map(t => MenuBarTemplate.itemOf(t, run));
    if (menu.place === Resources.editMenu)
      return [MenuBarTemplate.editMenu(menu.title, rows)];
    if (menu.place === Resources.windowMenu)
      return [MenuBarTemplate.windowMenu(menu.title, rows)];
    if (rows.length === 0)
      return [];
    return [{ label: menu.title, submenu: rows, ...menu.place === Resources.helpMenu ? { role: Resources.helpRole } : {} }];
  }

  private static before(rows: readonly MenuItemConstructorOptions[], native: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
    return rows.length === 0 ? [...native] : [...rows, MenuBarTemplate.SEPARATOR, ...native];
  }

  private static after(native: readonly MenuItemConstructorOptions[], rows: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
    return rows.length === 0 ? [...native] : [...native, MenuBarTemplate.SEPARATOR, ...rows];
  }

  private static itemOf(row: MenuBarRow, run: (id: string) => void): MenuItemConstructorOptions {
    if (row.type === MenuBarRowType.Separator)
      return MenuBarTemplate.SEPARATOR;
    if (row.type === MenuBarRowType.Submenu)
      return { label: row.label, submenu: row.rows.map(t => MenuBarTemplate.itemOf(t, run)) };
    const id = String(row.id);
    return {
      id,
      label: row.label,
      enabled: row.isEnabled,
      type: row.check === MenuCheck.Checkbox ? Resources.checkboxMenuType : row.check === MenuCheck.Radio ? Resources.radioMenuType : Resources.normalMenuType,
      checked: row.isChecked,
      ...Object.isNull(row.key) ? {} : { accelerator: MenuBarTemplate.acceleratorOf(row.key), registerAccelerator: false },
      click: () => run(id)
    };
  }

  private static acceleratorOf(key: KeyChord): string {
    const modifiers = [[key.hasCtrl, Resources.controlKey], [key.hasAlt, Resources.altKey], [key.hasShift, Resources.shiftKey], [key.hasMod, Resources.commandKey]] as const;
    return [...modifiers.filter(t => t[0]).map(t => t[1]), key.key.label(false)].join(Resources.acceleratorSeparator);
  }
}
