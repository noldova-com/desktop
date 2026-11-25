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
export class MenuBarTests {
  @TestMethod
  @TestData("{}", "$.menus: ")
  @TestData("{\"menus\":\"File\"}", "$.menus: ")
  @TestData("[]", "$: ")
  @TestData("{\"menus\":[]}", "$.undo: ")
  @TestData("{\"menus\":[],\"undo\":\"Undo\"}", "$.undo: ")
  @TestData("{\"menus\":[],\"undo\":{\"enabled\":true}}", "$.undo.id: ")
  @TestData("{\"menus\":[],\"undo\":{\"id\":\"desktop.undo\"}}", "$.undo.enabled: ")
  public refusesAMenuBarWithoutItsMenusOrItsUndo(menuBar: string, reason: string): Promise<void> {
    return MainProcessStartFixture.verifyMenuBarRefusedAsync(menuBar, reason);
  }
}
