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
import { WindowStateKey } from "@noldova/desktop.protocol";

@TestClass
export class WindowStateKeyTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"device\":\"d1\",\"window\":\"main\"}";

    Assert.areEqual(text, JSON.stringify(new WindowStateKey("d1", "main").toJson()));
    Assert.areEqual(text, JSON.stringify(WindowStateKey.fromJson(JsonReader.parse(text).toJson()).toJson()));
  }

  @TestMethod
  @TestData(" ", "main")
  @TestData("d1", String.empty)
  public needsADeviceAndAWindow(device: string, window: string): void {
    Assert.throws(() => new WindowStateKey(device, window), ArgumentException);
  }

  @TestMethod
  @TestData("{\"window\":\"main\"}", "$.device")
  @TestData("{\"device\":\"d1\",\"window\":\" \"}", "$.window")
  @TestData("{\"device\":\"d1\",\"window\":\"main\",\"screen\":1}", "$.screen")
  public rejectsAKeyThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => WindowStateKey.fromJson(JsonReader.parse(text).toJson()), JsonException).path);
  }
}
