/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SettingKey, SettingScope } from "@noldova/desktop.protocol";

@TestClass
export class SettingKeyTests {
  @TestMethod
  public pinsItsWireFormWithAndWithoutAScopeAndADevice(): void {
    const scope = new SettingScope(QualifiedName.parse("chat.conversation"), "c42");
    const keys = [
      new SettingKey(QualifiedName.parse("desktop.mode")),
      new SettingKey(QualifiedName.parse("chat.sendWithEnter"), scope),
      new SettingKey(QualifiedName.parse("desktop.doNotDisturb"), null, "d1")
    ];
    const texts = keys.map(t => JSON.stringify(t.toJson()));

    Assert.areEqual(JSON.stringify([
      "{\"name\":\"desktop.mode\"}",
      "{\"name\":\"chat.sendWithEnter\",\"scope\":{\"name\":\"chat.conversation\",\"id\":\"c42\"}}",
      "{\"name\":\"desktop.doNotDisturb\",\"device\":\"d1\"}"
    ]), JSON.stringify(texts));
    Assert.areEqual(JSON.stringify(texts), JSON.stringify(texts.map(t => JSON.stringify(SettingKey.fromJson(JsonReader.parse(t).toJson()).toJson()))));
    Assert.isNull(keys[0]?.scope);
    Assert.areEqual("c42,d1", [keys[1]?.scope?.id, keys[2]?.device].join(","));
  }

  @TestMethod
  public refusesABlankDevice(): void {
    Assert.areEqual("device", Assert.throws(() => new SettingKey(QualifiedName.parse("desktop.mode"), null, " "), ArgumentException).parameterName);
  }

  @TestMethod
  @TestData("{\"name\":\"mode\"}", "$.name")
  @TestData("{\"name\":\"desktop.mode\",\"device\":\"\"}", "$.device")
  @TestData("{\"name\":\"desktop.mode\",\"scope\":{\"name\":\"chat.conversation\",\"id\":\"\"}}", "$.scope.id")
  @TestData("{\"name\":\"desktop.mode\",\"value\":\"Dark\"}", "$.value")
  public rejectsAWireKeyThatIsNotOne(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => SettingKey.fromJson(JsonReader.parse(text).toJson()), JsonException).path);
  }
}
