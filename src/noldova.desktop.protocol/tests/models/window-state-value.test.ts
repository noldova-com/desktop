/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { WindowStateValue } from "@noldova/desktop.protocol";

@TestClass
export class WindowStateValueTests {
  @TestMethod
  @TestData("{\"value\":{\"width\":1280}}")
  @TestData("{\"value\":null}")
  public pinsItsWireForm(text: string): void {
    const value = WindowStateValue.fromJson(JsonReader.parse(text).toJson());

    Assert.areEqual(text, JSON.stringify(value.toJson()));
    Assert.areEqual(text, JSON.stringify(new WindowStateValue(value.value).toJson()));
  }

  @TestMethod
  @TestData("{}", "$.value")
  @TestData("{\"value\":1}", "$.value")
  @TestData("{\"value\":null,\"extra\":1}", "$.extra")
  public rejectsAnAnswerThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => WindowStateValue.fromJson(JsonReader.parse(text).toJson()), JsonException).path);
  }
}
