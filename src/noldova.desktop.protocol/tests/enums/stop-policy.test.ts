/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { StopPolicy } from "@noldova/desktop.protocol";

@TestClass
export class StopPolicyTests {
  @TestMethod
  public namesEveryPolicyByItsMember(): void {
    Assert.areEqual("IfIdle,StopWork", Object.values(StopPolicy).join(","));
  }
}
