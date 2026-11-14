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
import { QualifiedName, SecretValue } from "@noldova/desktop.protocol";

@TestClass
export class SecretValueTests {
  @TestMethod
  public pinsAValueInItsWireForm(): void {
    const value = "{\"name\":\"notes.syncToken\",\"value\":\"s3cret\"}";

    Assert.areEqual(value, JSON.stringify(SecretValue.fromJson(JsonReader.parse(value).toJson()).toJson()));
    Assert.areEqual("notes", SecretValue.fromJson(JsonReader.parse(value).toJson()).name.owner);
  }

  @TestMethod
  public refusesNoldovaDesktopsNamesAndAnEmptyLongOrMalformedValueWithoutWritingIt(): void {
    const long = "s".repeat(16385);

    Assert.areEqual("name", Assert.throws(() => new SecretValue(QualifiedName.parse("desktop.token"), "s3cret"), ArgumentException).parameterName);
    Assert.areEqual("value", Assert.throws(() => new SecretValue(QualifiedName.parse("notes.syncToken"), String.empty), ArgumentException).parameterName);
    const failure = Assert.throws(() => new SecretValue(QualifiedName.parse("notes.syncToken"), long), ArgumentException);
    Assert.areEqual("value", failure.parameterName);
    Assert.isFalse(failure.message.includes(long));
    Assert.areEqual("value", Assert.throws(() => new SecretValue(QualifiedName.parse("notes.syncToken"), "s3cret\uD800"), ArgumentException).parameterName);
    Assert.areEqual("s3cret🔑", new SecretValue(QualifiedName.parse("notes.syncToken"), "s3cret🔑").value);
    Assert.areEqual(16384, new SecretValue(QualifiedName.parse("notes.syncToken"), "s".repeat(16384)).value.length);
    Assert.areEqual("$.name", Assert.throws(() => SecretValue.fromJson({ name: "desktop.token", value: "s3cret" }), JsonException).path);
    Assert.isFalse(Assert.throws(() => SecretValue.fromJson({ name: "notes.syncToken", value: String.empty }), JsonException).message.includes("s3cret"));
  }
}
