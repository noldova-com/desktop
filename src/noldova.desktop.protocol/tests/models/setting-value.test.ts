/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SettingKey, SettingValue } from "@noldova/desktop.protocol";

@TestClass
export class SettingValueTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"name\":\"desktop.doNotDisturb\",\"device\":\"d1\",\"value\":true}";
    const value = SettingValue.fromJson(JsonReader.parse(text).toJson());

    Assert.areEqual(text, JSON.stringify(new SettingValue(new SettingKey(QualifiedName.parse("desktop.doNotDisturb"), null, "d1"), true).toJson()));
    Assert.areEqual(text, JSON.stringify(value.toJson()));
    Assert.areEqual("desktop.doNotDisturb,true", [value.key.name.text, value.value].join(","));
  }

  @TestMethod
  @TestData("{\"name\":\"desktop.mode\"}", "$.value")
  @TestData("{\"name\":\"mode\",\"value\":\"Dark\"}", "$.name")
  @TestData("{\"name\":\"desktop.mode\",\"value\":\"Dark\",\"extra\":1}", "$.extra")
  public rejectsAWireValueThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingValue.fromJson(JsonReader.parse(text).toJson()), JsonException).path);
  }
}
