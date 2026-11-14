/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";

@TestClass
export class MenuBarMenuTests {
  @TestMethod
  @TestData("{\"menus\":[{\"place\":\"desktop.file\",\"rows\":[]}]}", "$.title: ")
  @TestData("{\"menus\":[{\"title\":\"File\",\"rows\":[]}]}", "$.place: ")
  @TestData("{\"menus\":[{\"place\":\"desktop.file\",\"title\":\"File\"}]}", "$.rows: ")
  public refusesAMenuWithoutItsPlaceTitleOrRows(menuBar: string, reason: string): Promise<void> {
    return MainProcessStartFixture.verifyMenuBarRefusedAsync(menuBar, reason);
  }
}
