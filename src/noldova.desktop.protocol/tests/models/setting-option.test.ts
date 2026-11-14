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
import { SettingOption } from "@noldova/desktop.protocol";

@TestClass
export class SettingOptionTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"value\":\"Dark\",\"title\":\"Dark\"}";

    Assert.areEqual(text, JSON.stringify(new SettingOption("Dark", "Dark").toJson()));
    Assert.areEqual(text, JSON.stringify(SettingOption.fromJson(JsonReader.parse(text).toJson()).toJson()));
  }

  @TestMethod
  public namesTheBlankPart(): void {
    Assert.areEqual("value", Assert.throws(() => new SettingOption(" ", "Dark"), ArgumentException).parameterName);
    Assert.areEqual("title", Assert.throws(() => new SettingOption("Dark", String.empty), ArgumentException).parameterName);
    Assert.areEqual("title", Assert.throws(() => new SettingOption(String.empty, " "), ArgumentException).parameterName);
  }

  @TestMethod
  public takesAnEmptyValueWithATitle(): void {
    const option = SettingOption.fromJson(JsonReader.parse("{\"value\":\"\",\"title\":\"Provider default\"}").toJson());

    Assert.areEqual("{\"value\":\"\",\"title\":\"Provider default\"}", JSON.stringify(option.toJson()));
  }

  @TestMethod
  @TestData("{\"value\":\"Dark\"}", "$.title")
  @TestData("{\"value\":\"Dark\",\"title\":\"Dark\",\"icon\":\"moon\"}", "$.icon")
  public rejectsAWireOptionThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingOption.fromJson(JsonReader.parse(text).toJson()), JsonException).path);
  }
}
