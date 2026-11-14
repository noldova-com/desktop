/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { MenuItem } from "../../../src/models/modules/menu-item.js";

@TestClass
export class MenuItemTests {
  @TestMethod
  public writesASubmenuAChoiceOrACommandWithItsArgumentsAndLabel(): void {
    const items = [
      new MenuItem(null, {}, "notes.recent"),
      new MenuItem(null, {}, null, null, "notes.sort"),
      new MenuItem("notes.open", { kind: "draft" }, null),
      new MenuItem("notes.open", {}, null, "Open")
    ];

    Assert.areEqual(JSON.stringify([
      { submenu: "notes.recent" },
      { choice: "notes.sort" },
      { command: "notes.open", arguments: { kind: "draft" } },
      { command: "notes.open", arguments: {}, label: "Open" }
    ]), JSON.stringify(items.map(t => t.toJson())));
  }
}
