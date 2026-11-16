/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { KeyChord, ShellKeys } from "@noldova/desktop.protocol";

@TestClass
export class ShellKeysTests {
  @TestMethod
  public listsNoldovaDesktopsDefaultKeysWithTheirCommandsOnEachPlatform(): void {
    const standard = ShellKeys.list("win32").map(([key, command]) => `${key.text} ${command}`);
    const mac = ShellKeys.list("darwin").map(([key, command]) => `${key.text} ${command}`);

    Assert.areEqual(13, standard.length);
    Assert.areEqual(13, mac.length);
    Assert.isTrue(standard.includes("Mod+K desktop.search") && standard.includes("Alt+ArrowLeft desktop.goBack") && standard.includes("Ctrl+PageDown desktop.nextTab"), standard.join());
    Assert.isTrue(mac.includes("Mod+BracketLeft desktop.goBack") && mac.includes("Mod+Alt+ArrowRight desktop.nextTab"), mac.join());
    Assert.areEqual(standard.join(), ShellKeys.list("linux").map(([key, command]) => `${key.text} ${command}`).join());
    Assert.areEqual("Mod+Shift+Period", ShellKeys.stopAgentControl.text);
  }

  @TestMethod
  public listsTheDefaultKeysAFocusedPageKeepsApartFromTheOthers(): void {
    const keys = (platform: string): string => ShellKeys.pageFirst(platform).map(([key, command]) => `${key.text} ${command}`).join();

    Assert.areEqual("Mod+Slash desktop.showShortcuts", keys("win32"));
    Assert.areEqual(keys("win32"), keys("darwin"));
    Assert.isFalse(ShellKeys.has(KeyChord.parse("Mod+Slash"), "win32") || ShellKeys.has(KeyChord.parse("Mod+Slash"), "darwin"));
  }

  @TestMethod
  public listsTheDefaultKeysAPaneMayDeclareApartFromTheOthers(): void {
    const keys = (platform: string): string => ShellKeys.declarable(platform).map(([key, command]) => `${key.text} ${command}`).join();

    Assert.areEqual("F6 desktop.focusNextRegion,Shift+F6 desktop.focusPreviousRegion", keys("win32"));
    Assert.areEqual(keys("win32"), keys("darwin"));
    Assert.isFalse(["F6", "Shift+F6"].some(t => ShellKeys.has(KeyChord.parse(t), "linux") || ShellKeys.has(KeyChord.parse(t), "darwin")));
  }

  @TestMethod
  public knowsADefaultKeyOrTheStopKeyByItsPlatformsMeaning(): void {
    const has = (text: string, platform: string): boolean => ShellKeys.has(KeyChord.parse(text), platform);

    Assert.isTrue(has("Mod+Shift+P", "win32") && has("Mod+Shift+P", "darwin"));
    Assert.isTrue(has("Ctrl+B", "linux"));
    Assert.isFalse(has("Ctrl+B", "darwin"));
    Assert.isTrue(has("Alt+ArrowLeft", "win32"));
    Assert.isFalse(has("Alt+ArrowLeft", "darwin"));
    Assert.isTrue(has("Mod+BracketLeft", "darwin"));
    Assert.isFalse(has("Mod+BracketLeft", "win32"));
    Assert.isTrue(has("Mod+Shift+Period", "win32") && has("Mod+Shift+Period", "darwin"));
    Assert.isFalse(has("Mod+R", "win32") || has("Mod+R", "darwin"));
  }
}
