/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NotificationSeverity } from "@noldova/desktop.protocol";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

@TestClass
export class NotificationSeverityTests {
  @TestMethod
  public namesEveryMemberByItsValue(): void {
    Assert.areEqual("Info,Success,Warning,Error", Object.values(NotificationSeverity).join(","));
    Assert.areEqual("Info,Success,Warning,Error", Object.keys(NotificationSeverity).join(","));
  }
}
