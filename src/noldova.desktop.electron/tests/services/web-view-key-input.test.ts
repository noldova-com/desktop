/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { WebViewKeyInput } from "../../src/services/web-view-key-input.js";

@TestClass
export class WebViewKeyInputTests {
  @TestMethod
  @TestData({ type: "rawKeyDown", key: "F7", code: "F7" }, "keyDown F7")
  @TestData({ type: "keyDown", key: "a", code: "KeyA", text: "a" }, "keyDown a|char a")
  @TestData({ type: "keyDown", key: "Enter", text: "\r" }, "keyDown Enter|char \r")
  @TestData({ type: "keyDown", key: "ArrowUp" }, "keyDown Up")
  @TestData({ type: "keyDown", key: "ArrowDown" }, "keyDown Down")
  @TestData({ type: "keyDown", key: "ArrowRight" }, "keyDown Right")
  @TestData({ type: "keyDown", key: " ", text: " " }, "keyDown Space|char  ")
  @TestData({ type: "keyDown", key: "+", text: "+" }, "keyDown Plus|char +")
  @TestData({ type: "char", key: "é", text: "é" }, "char é")
  @TestData({ type: "char", key: "q" }, "char q")
  @TestData({ type: "char", text: "ab" }, "char a|char b")
  @TestData({ type: "keyUp", key: "a", code: "KeyA" }, "keyUp a")
  public sendsAProtocolKeyEventAsThePageInputsItTakes(params: JsonObject, expected: string): void {
    const events = WebViewKeyInput.read(params);

    Assert.areEqual(expected, events.map(t => `${t.type} ${t.keyCode}`).join("|"));
  }

  @TestMethod
  @TestData({ type: "keyDown", key: "a" }, "linux", "keyDown a |char a ")
  @TestData({ type: "rawKeyDown", key: "A", shift: true }, "linux", "keyDown A shift|char A shift")
  @TestData({ type: "keyDown", key: "Enter" }, "win32", "keyDown Enter |char \r ")
  @TestData({ type: "keyDown", key: "ArrowLeft" }, "linux", "keyDown Left ")
  @TestData({ type: "keyDown", key: "t", control: true }, "linux", "keyDown t control")
  @TestData({ type: "keyDown", key: "t", meta: true }, "darwin", "keyDown t meta")
  @TestData({ type: "keyDown", key: "@", control: true, alt: true }, "win32", "keyDown @ alt+control|char @ alt+control")
  @TestData({ type: "keyDown", key: "f", alt: true }, "win32", "keyDown f alt")
  @TestData({ type: "keyDown", key: "å", alt: true }, "darwin", "keyDown å alt|char å alt")
  @TestData({ type: "keyDown", key: "t", control: true, isAutoRepeat: true }, "linux", "keyDown t control+isautorepeat")
  @TestData({ type: "keyUp", key: "a" }, "linux", "keyUp a ")
  public givesBackAPersonsPressAsThePageInputsItTakes(press: JsonObject, platform: string, expected: string): void {
    const input = { type: "keyDown", key: String.empty, code: String.empty, isAutoRepeat: false, control: false, alt: false, shift: false, meta: false, ...press };
    const events = WebViewKeyInput.fromInput({
      type: String(input.type), key: String(input.key), code: String(input.code), isAutoRepeat: input.isAutoRepeat === true,
      control: input.control === true, alt: input.alt === true, shift: input.shift === true, meta: input.meta === true
    }, platform);

    Assert.areEqual(expected, events.map(t => `${t.type} ${t.keyCode} ${t.modifiers.join("+")}`).join("|"));
  }

  @TestMethod
  public keepsTheHeldKeysAndARepeatOnEachInput(): void {
    const events = WebViewKeyInput.read({ type: "keyDown", key: "a", text: "a", modifiers: 15, autoRepeat: true });

    Assert.areEqual(JSON.stringify(Array.from({ length: 2 }, () => ["alt", "control", "meta", "shift", "isautorepeat"])), JSON.stringify(events.map(t => t.modifiers)));
  }

  @TestMethod
  @TestData({ type: "keyDown", key: "a", modifiers: 2.5, autoRepeat: "yes" })
  @TestData({ type: "keyDown", key: "a", modifiers: "2" })
  public holdsNoKeyForModifiersThatAreNoWholeNumber(params: JsonObject): void {
    const events = WebViewKeyInput.read(params);

    Assert.areEqual(JSON.stringify([[]]), JSON.stringify(events.map(t => t.modifiers)));
  }

  @TestMethod
  @TestData({ type: "keyDown", code: "KeyA", text: "a" })
  @TestData({ type: "rawKeyDown", key: 7 })
  @TestData({ type: "keyUp" })
  @TestData({ type: "char" })
  @TestData({ type: "mouseMoved", key: "a" })
  @TestData({ key: "a" })
  public sendsNothingForAnEventWithNoKeyOrATypeThePageInputDoesntTake(params: JsonObject): void {
    Assert.areEqual(0, WebViewKeyInput.read(params).length);
  }
}
