/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellNotifications } from "@noldova/desktop.protocol";

@TestClass
export class ShellNotificationsTests {
  @TestMethod
  public namesTheShellsOwnNotificationKinds(): void {
    Assert.areEqual("desktop.saveFailed,desktop.saveUnfinished,desktop.updateReady,desktop.support", ShellNotifications.all.map(t => t.text).join(","));
    Assert.isTrue(ShellNotifications.all.every(t => t.isShell));
  }
}
