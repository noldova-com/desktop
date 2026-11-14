/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ModuleInventory } from "../../../src/models/modules/module-inventory.js";

@TestClass
export class ModuleInventoryTests {
  @TestMethod
  public keepsTheDeclarationsAndTheProblems(): void {
    const inventory = new ModuleInventory([], ["src/modules/broken/module.json could not be read as JSON."]);

    Assert.areEqual(0, inventory.declarations.length);
    Assert.areEqual("src/modules/broken/module.json could not be read as JSON.", inventory.problems.join());
  }
}
