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
import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/desktop.protocol";

@TestClass
export class SettingDefinitionTests {
  private static readonly NAME: QualifiedName = QualifiedName.parse("chat.sendWithEnter");
  private static readonly CONVERSATION: QualifiedName = QualifiedName.parse("chat.conversation");
  private static readonly TEXT: string =
    "{\"name\":\"chat.sendWithEnter\",\"title\":\"Send with Enter\",\"description\":\"Sends a message when Enter is pressed.\",\"type\":{\"kind\":\"Boolean\"}," +
    "\"default\":true,\"locality\":\"Shared\",\"scopes\":[\"chat.conversation\"],\"page\":\"Chat\",\"group\":\"Composer\"}";

  @TestMethod
  public pinsItsWireForm(): void {
    const definition = SettingDefinition.fromJson(JsonReader.parse(SettingDefinitionTests.TEXT).toJson());

    Assert.areEqual(SettingDefinitionTests.TEXT, JSON.stringify(SettingDefinitionTests.create().toJson()));
    Assert.areEqual(SettingDefinitionTests.TEXT, JSON.stringify(definition.toJson()));
    Assert.areEqual("chat.sendWithEnter|Send with Enter|true|Shared|Chat|Composer", [
      definition.name.text, definition.title, definition.defaultValue, definition.locality, definition.page, definition.group
    ].join("|"));
    Assert.areEqual("Sends a message when Enter is pressed.", definition.description);
    Assert.areEqual("Boolean", definition.type.kind);
  }

  @TestMethod
  public tellsTheScopesThatMayOverrideIt(): void {
    const definition = SettingDefinitionTests.create();

    Assert.isTrue(definition.isScopedBy(QualifiedName.parse("chat.conversation")));
    Assert.isFalse(definition.isScopedBy(QualifiedName.parse("projects.project")));
    Assert.areEqual("chat.conversation", definition.scopes.map(t => t.text).join(","));
  }

  @TestMethod
  public namesWhatMakesItInvalid(): void {
    const name = SettingDefinitionTests.NAME;
    const type = SettingType.boolean();
    const shared = SettingLocality.Shared;
    const create = (build: () => SettingDefinition): ArgumentException => Assert.throws(build, ArgumentException);

    Assert.areEqual("title,description,page,group,default,scopes,scopes", [
      create(() => new SettingDefinition(name, " ", "Sends.", type, true, shared, [], "Chat", "Composer")).parameterName,
      create(() => new SettingDefinition(name, "Send", String.empty, type, true, shared, [], "Chat", "Composer")).parameterName,
      create(() => new SettingDefinition(name, "Send", "Sends.", type, true, shared, [], String.empty, "Composer")).parameterName,
      create(() => new SettingDefinition(name, "Send", "Sends.", type, true, shared, [], "Chat", " ")).parameterName,
      create(() => new SettingDefinition(name, "Send", "Sends.", type, "yes", shared, [], "Chat", "Composer")).parameterName,
      create(() => new SettingDefinition(name, "Send", "Sends.", type, true, shared, [SettingDefinitionTests.CONVERSATION, QualifiedName.parse("chat.conversation")], "Chat", "Composer")).parameterName,
      create(() => new SettingDefinition(name, "Send", "Sends.", type, true, SettingLocality.Device, [SettingDefinitionTests.CONVERSATION], "Chat", "Composer")).parameterName
    ].join(","));
  }

  @TestMethod
  @TestData("type", "{\"kind\":\"Color\"}", "$.type.kind")
  @TestData("default", "\"yes\"", "$.default")
  @TestData("locality", "\"Everywhere\"", "$.locality")
  @TestData("scopes", "[\"conversation\"]", "$.scopes")
  @TestData("extra", "1", "$.extra")
  public rejectsAWireDefinitionThatIsNotOne(field: string, value: string, path: string): void {
    const json = { ...JsonReader.parse(SettingDefinitionTests.TEXT).toJson(), [field]: JSON.parse(value) };

    Assert.areEqual(path, Assert.throws(() => SettingDefinition.fromJson(json), JsonException).path);
  }

  private static create(): SettingDefinition {
    return new SettingDefinition(SettingDefinitionTests.NAME, "Send with Enter", "Sends a message when Enter is pressed.", SettingType.boolean(), true,
      SettingLocality.Shared, [SettingDefinitionTests.CONVERSATION], "Chat", "Composer");
  }
}
