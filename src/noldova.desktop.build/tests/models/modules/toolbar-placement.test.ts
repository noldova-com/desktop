/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ToolbarPlacement } from "../../../src/models/modules/toolbar-placement.js";

@TestClass
export class ToolbarPlacementTests {
  @TestMethod
  public writesOnlyThePlacementItHas(): void {
    Assert.areEqual(JSON.stringify({ shown: true }), JSON.stringify(new ToolbarPlacement(true, null, null, false).toJson()));
    Assert.areEqual(JSON.stringify({ shown: false, after: "edit", before: "view", newRow: true }), JSON.stringify(new ToolbarPlacement(false, "edit", "view", true).toJson()));
  }
}
