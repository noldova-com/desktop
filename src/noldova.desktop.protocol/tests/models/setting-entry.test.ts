/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SettingEntry } from "@noldova/desktop.protocol";

@TestClass
export class SettingEntryTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"name\":\"desktop.mode\",\"value\":\"System\",\"isSet\":false}";
    const entry = SettingEntry.fromJson(JsonReader.parse(text).toJson());

    Assert.areEqual(text, JSON.stringify(new SettingEntry(QualifiedName.parse("desktop.mode"), "System", false).toJson()));
    Assert.areEqual(text, JSON.stringify(entry.toJson()));
    Assert.areEqual("desktop.mode,System,false", [entry.name.text, entry.value, entry.isSet].join(","));
  }

  @TestMethod
  @TestData("{\"name\":\"desktop.mode\",\"value\":\"Dark\"}", "$.isSet")
  @TestData("{\"name\":\"desktop.mode\",\"value\":\"Dark\",\"isSet\":true,\"scope\":null}", "$.scope")
  public rejectsAWireEntryThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingEntry.fromJson(JsonReader.parse(text).toJson()), JsonException).path);
  }
}
