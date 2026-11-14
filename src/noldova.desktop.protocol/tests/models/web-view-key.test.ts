/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { KeyChord, WebViewKey } from "@noldova/desktop.protocol";

@TestClass
export class WebViewKeyTests {
  @TestMethod
  public pinsItsWireFormAndTakesTheKeysOnMacOSWithoutMacKeys(): void {
    const full = "{\"name\":\"reload\",\"keys\":[\"Mod+R\",\"F5\"],\"macKeys\":[\"Mod+R\"]}";
    const plain = WebViewKey.fromJson({ name: "newTab", keys: ["Mod+T"] });

    Assert.areEqual(full, JSON.stringify(WebViewKey.fromJson(JsonReader.parse(full).toJson()).toJson()));
    Assert.areEqual("{\"name\":\"newTab\",\"keys\":[\"Mod+T\"],\"macKeys\":[\"Mod+T\"]}", JSON.stringify(plain.toJson()));
    Assert.areEqual("Mod+R,F5", WebViewKey.fromJson(JsonReader.parse(full).toJson()).keysOn("linux").map(t => t.text).join());
    Assert.areEqual("Mod+R", WebViewKey.fromJson(JsonReader.parse(full).toJson()).keysOn("darwin").map(t => t.text).join());
  }

  @TestMethod
  public matchesAPressOnlyByThatPlatformsKeys(): void {
    const key = new WebViewKey("back", [KeyChord.parse("Ctrl+BracketLeft")], [KeyChord.parse("Alt+ArrowLeft")]);
    const press = { key: "[", code: "BracketLeft", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false };
    const macPress = { key: "ArrowLeft", code: "ArrowLeft", ctrlKey: false, altKey: true, shiftKey: false, metaKey: false };

    Assert.isTrue(key.matches(press, "win32"));
    Assert.isFalse(key.matches(press, "darwin"));
    Assert.isTrue(key.matches(macPress, "darwin"));
    Assert.isFalse(key.matches(macPress, "linux"));
  }

  @TestMethod
  @TestData("Reload", "keys", "Mod+R", "Mod+R")
  @TestData("reload", "keys", "R", "Mod+R")
  @TestData("reload", "keys", "Shift+R", "Mod+R")
  @TestData("reload", "macKeys", "Mod+R", "Escape")
  @TestData("reload", "keys", "Mod+C", "Mod+R")
  @TestData("reload", "keys", "Alt+F4", "Mod+R")
  @TestData("reload", "macKeys", "Mod+R", "Mod+H")
  @TestData("reload", "keys", "Alt+ArrowLeft", "Mod+R")
  @TestData("reload", "macKeys", "Mod+R", "Mod+BracketLeft")
  @TestData("reload", "keys", "Ctrl+Tab", "Mod+R")
  @TestData("reload", "macKeys", "Mod+R", "Mod+Shift+Period")
  public refusesABadNameATypingKeyAndAKeyThatEditingTheSystemOrNoldovaDesktopHolds(name: string, parameter: string, key: string, macKey: string): void {
    Assert.areEqual(parameter === "keys" && name !== "reload" ? "name" : parameter,
      Assert.throws(() => new WebViewKey(name, [KeyChord.parse(key)], [KeyChord.parse(macKey)]), ArgumentException).parameterName);
  }

  @TestMethod
  public takesAKeyOnThePlatformWhereNothingHoldsIt(): void {
    const keys = new WebViewKey("both", [KeyChord.parse("Mod+H"), KeyChord.parse("Mod+BracketLeft")], [KeyChord.parse("Alt+F4"), KeyChord.parse("Alt+ArrowLeft")]);

    Assert.areEqual("Mod+H,Mod+BracketLeft", keys.keys.map(t => t.text).join());
    Assert.areEqual("Alt+F4,Alt+ArrowLeft", keys.macKeys.map(t => t.text).join());
  }

  @TestMethod
  public refusesNoKeysMoreThanFourOrOneKeyTwiceOnAPlatform(): void {
    const parse = (texts: readonly string[]): KeyChord[] => texts.map(t => KeyChord.parse(t));

    Assert.areEqual("keys", Assert.throws(() => new WebViewKey("reload", []), ArgumentException).parameterName);
    Assert.areEqual("keys", Assert.throws(() => new WebViewKey("reload", parse(["F1", "F2", "F3", "F4", "F5"])), ArgumentException).parameterName);
    Assert.areEqual(4, new WebViewKey("reload", parse(["F1", "F2", "F3", "F4"])).keys.length);
    Assert.areEqual("keys", Assert.throws(() => new WebViewKey("reload", parse(["Mod+R", "Ctrl+R"]), parse(["Mod+R"])), ArgumentException).parameterName);
    Assert.areEqual(2, new WebViewKey("reload", parse(["Mod+R", "F5"]), parse(["Mod+R", "Ctrl+R"])).macKeys.length);
  }

  @TestMethod
  public namesThePathThatIsInvalid(): void {
    Assert.areEqual("$.keys", Assert.throws(() => WebViewKey.fromJson({ name: "reload", keys: ["Mod+Nope"] }), JsonException).path);
    Assert.areEqual("$.macKeys", Assert.throws(() => WebViewKey.fromJson({ name: "reload", keys: ["Mod+R"], macKeys: ["Mod+Ctrl+R"] }), JsonException).path);
    Assert.areEqual("$.key", Assert.throws(() => WebViewKey.fromJson({ name: "reload", key: ["Mod+R"] }), JsonException).path);
  }
}
