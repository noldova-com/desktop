/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { MenuBarMenu } from "./menu-bar-menu.js";
import { MenuBarUndo } from "./menu-bar-undo.js";

export class MenuBar {
  public readonly menus: readonly MenuBarMenu[];
  public readonly undo: MenuBarUndo | null;

  private constructor(menus: readonly MenuBarMenu[], undo: MenuBarUndo | null) {
    this.menus = [...menus];
    this.undo = undo;
  }

  public static fromJson(value: unknown): MenuBar {
    const json = JsonReader.fromValue(value);
    const menus = json.readObjectArray(Resources.menusField).map(t => MenuBarMenu.fromJson(t.toJson()));
    const undo = json.readNullableObject(Resources.undoField);
    return new MenuBar(menus, Object.isNull(undo) ? null : MenuBarUndo.fromJson(undo));
  }
}
