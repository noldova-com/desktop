/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppShortcut, AppShortcutList, KeyChord } from "@noldova/desktop.protocol";

@TestClass
export class AppShortcutListTests {
  @TestMethod
  public copiesTheShortcutsItIsGiven(): void {
    const shortcuts = [new AppShortcut(KeyChord.parse("Mod+B"), "desktop.toggleLeftDock", false)];
    const list = new AppShortcutList(shortcuts);
    shortcuts.pop();

    Assert.areEqual(1, list.shortcuts.length);
  }

  @TestMethod
  public namesAMissingField(): void {
    Assert.areEqual("$.shortcuts", Assert.throws(() => AppShortcutList.fromJson({}), JsonException).path);
  }
}
