/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QuitAnswer } from "@noldova/desktop.protocol";

@TestClass
export class QuitAnswerTests {
  @TestMethod
  public namesEveryAnswerByItsMember(): void {
    Assert.areEqual("Stayed,SaveFailed", Object.values(QuitAnswer).join(","));
  }
}
