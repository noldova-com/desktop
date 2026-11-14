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
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SecretAction, SecretCommand } from "@noldova/desktop.protocol";

@TestClass
export class SecretCommandTests {
  @TestMethod
  public pinsACommandForEachActionInItsWireForm(): void {
    for (const text of ["{\"call\":1,\"action\":\"Device\"}", "{\"call\":2,\"action\":\"Encrypt\",\"value\":\"s3cret\"}", "{\"call\":3,\"action\":\"Decrypt\",\"value\":\"AAEC\"}"])
      Assert.areEqual(text, JSON.stringify(SecretCommand.fromJson(JsonReader.parse(text).toJson()).toJson()));
    Assert.areEqual(SecretAction.Decrypt, SecretCommand.fromJson({ call: 3, action: "Decrypt", value: "AAEC" }).action);
  }

  @TestMethod
  public refusesACommandWhoseValueDoesntSuitItsAction(): void {
    for (const [action, value] of [[SecretAction.Device, "x"], [SecretAction.Encrypt, null], [SecretAction.Encrypt, String.empty], [SecretAction.Encrypt, "s".repeat(16385)],
      [SecretAction.Decrypt, null], [SecretAction.Decrypt, String.empty], [SecretAction.Decrypt, "A".repeat(131073)]] as const)
      Assert.areEqual("value", Assert.throws(() => new SecretCommand(1, action, value), ArgumentException).parameterName);
    Assert.areEqual(131072, new SecretCommand(1, SecretAction.Decrypt, "A".repeat(131072)).value?.length);
    Assert.areEqual("call", Assert.throws(() => new SecretCommand(0, SecretAction.Device), ArgumentException).parameterName);
    Assert.areEqual("$.action", Assert.throws(() => SecretCommand.fromJson({ call: 1, action: "Erase" }), JsonException).path);
  }
}
