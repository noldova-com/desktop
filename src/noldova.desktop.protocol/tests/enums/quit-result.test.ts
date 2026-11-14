/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QuitResult } from "@noldova/desktop.protocol";

@TestClass
export class QuitResultTests {
  @TestMethod
  public namesEveryResultByItsMember(): void {
    Assert.areEqual("Quit,NoMainProcess", Object.values(QuitResult).join(","));
  }
}
