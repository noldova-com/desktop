/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { MenuPlace } from "../../../src/models/modules/menu-place.js";
import { ToolbarPlacement } from "../../../src/models/modules/toolbar-placement.js";

@TestClass
export class MenuPlaceTests {
  @TestMethod
  public writesWhereItShows(): void {
    Assert.areEqual(JSON.stringify({ name: "notes.menu", title: "Notes", shows: "menu" }), JSON.stringify(new MenuPlace("notes.menu", "Notes", false).toJson()));
    Assert.areEqual(JSON.stringify({ name: "notes.bar", title: "Notes", shows: "menuBar" }), JSON.stringify(new MenuPlace("notes.bar", "Notes", true).toJson()));
    Assert.areEqual(JSON.stringify({ name: "notes.tools", title: "Notes", shows: "toolbar", shown: true, after: "edit" }),
      JSON.stringify(new MenuPlace("notes.tools", "Notes", false, new ToolbarPlacement(true, "edit", null, false)).toJson()));
  }
}
