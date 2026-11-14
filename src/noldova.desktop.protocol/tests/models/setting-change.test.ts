/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SettingChange, SettingKey } from "@noldova/desktop.protocol";

@TestClass
export class SettingChangeTests {
  @TestMethod
  public pinsItsWireFormForASetAndAReset(): void {
    const set = "{\"name\":\"desktop.doNotDisturb\",\"device\":\"d1\",\"value\":true,\"isSet\":true}";
    const reset = "{\"name\":\"desktop.mode\",\"value\":\"System\",\"isSet\":false}";
    const change = SettingChange.fromJson(JsonReader.parse(set).toJson());

    Assert.areEqual(set, JSON.stringify(new SettingChange(new SettingKey(QualifiedName.parse("desktop.doNotDisturb"), null, "d1"), true, true).toJson()));
    Assert.areEqual(set, JSON.stringify(change.toJson()));
    Assert.areEqual(reset, JSON.stringify(SettingChange.fromJson(JsonReader.parse(reset).toJson()).toJson()));
    Assert.areEqual("desktop.doNotDisturb,true,true", [change.key.name.text, change.value, change.isSet].join(","));
  }

  @TestMethod
  @TestData("{\"name\":\"desktop.mode\",\"isSet\":true}", "$.value")
  @TestData("{\"name\":\"desktop.mode\",\"value\":\"Dark\"}", "$.isSet")
  @TestData("{\"name\":\"desktop.mode\",\"value\":\"Dark\",\"isSet\":\"yes\"}", "$.isSet")
  @TestData("{\"name\":\"mode\",\"value\":\"Dark\",\"isSet\":true}", "$.name")
  @TestData("{\"name\":\"desktop.mode\",\"value\":\"Dark\",\"isSet\":true,\"extra\":1}", "$.extra")
  public rejectsAWireChangeThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingChange.fromJson(JsonReader.parse(text).toJson()), JsonException).path);
  }
}
