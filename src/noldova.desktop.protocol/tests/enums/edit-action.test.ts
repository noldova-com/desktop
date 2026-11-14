/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { EditAction } from "@noldova/desktop.protocol";

@TestClass
export class EditActionTests {
  @TestMethod
  public namesEveryActionByItsMember(): void {
    Assert.areEqual("Undo,Redo,Cut,Copy,Paste,SelectAll", Object.values(EditAction).join(","));
  }
}
