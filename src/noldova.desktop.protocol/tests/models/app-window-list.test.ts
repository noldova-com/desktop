/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppWindow, AppWindowList } from "@noldova/desktop.protocol";

@TestClass
export class AppWindowListTests {
  @TestMethod
  public copiesTheWindowsItIsGiven(): void {
    const windows = [new AppWindow(7, 1)];
    const list = new AppWindowList(windows);
    windows.pop();

    Assert.areEqual(1, list.windows.length);
  }

  @TestMethod
  public namesAMissingOrUnknownField(): void {
    Assert.areEqual("$.windows", Assert.throws(() => AppWindowList.fromJson({}), JsonException).path);
    Assert.areEqual("$.focused", Assert.throws(() => AppWindowList.fromJson({ windows: [], focused: 1 }), JsonException).path);
  }
}
