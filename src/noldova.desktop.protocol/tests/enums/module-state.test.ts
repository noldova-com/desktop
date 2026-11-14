/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ModuleState } from "@noldova/desktop.protocol";

@TestClass
export class ModuleStateTests {
  @TestMethod
  public namesEveryStateByItsMember(): void {
    Assert.areEqual("Active,Failed,Blocked,Off,Unavailable", Object.values(ModuleState).join(","));
  }
}
