/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, SecretReference } from "@noldova/desktop.protocol";

@TestClass
export class SecretReferenceTests {
  @TestMethod
  public pinsAReferenceInItsWireForm(): void {
    const reference = "{\"name\":\"notes.syncToken\"}";

    Assert.areEqual(reference, JSON.stringify(SecretReference.fromJson(JsonReader.parse(reference).toJson()).toJson()));
  }

  @TestMethod
  public refusesNoldovaDesktopsNamesAndUnknownFields(): void {
    Assert.areEqual("name", Assert.throws(() => new SecretReference(QualifiedName.parse("desktop.token")), ArgumentException).parameterName);
    Assert.areEqual("$.name", Assert.throws(() => SecretReference.fromJson({ name: "token" }), JsonException).path);
    Assert.throws(() => SecretReference.fromJson({ name: "notes.syncToken", value: "s3cret" }), JsonException);
  }
}
