/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { MenuGroup } from "../../../src/models/modules/menu-group.js";
import { MenuItem } from "../../../src/models/modules/menu-item.js";

@TestClass
export class MenuGroupTests {
  @TestMethod
  public writesItsItemsOrThatItIsDynamic(): void {
    const items = [new MenuItem("notes.open", {}, null)];
    const group = new MenuGroup("notes.files", "file", true, items);
    items.pop();

    Assert.areEqual(JSON.stringify({ name: "notes.files", place: "file", exclusive: true, items: [{ command: "notes.open", arguments: {} }] }), JSON.stringify(group.toJson()));
    Assert.areEqual(JSON.stringify({ name: "notes.recent", place: "file", exclusive: false, dynamic: true }),
      JSON.stringify(new MenuGroup("notes.recent", "file", false, [], true).toJson()));
    Assert.isFalse(group.isDynamic);
  }
}
