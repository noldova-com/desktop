/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectoryState } from "@noldova/desktop.runtime";

@TestClass
export class DataDirectoryStateTests {
  @TestMethod
  public namesEachStateByItsMember(): void {
    Assert.areEqual("Empty,Current,PreShell", Object.values(DataDirectoryState).join(","));
  }
}
