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
import { SecretAnswered, SecretFailureKind } from "@noldova/desktop.protocol";

@TestClass
export class SecretAnsweredTests {
  @TestMethod
  public pinsAnAnswerWithExactlyOneOfAValueAndAFailure(): void {
    const value = "{\"call\":2,\"value\":\"AAEC\"}";
    const failure = "{\"call\":2,\"failure\":\"Unprotected\"}";

    Assert.areEqual(value, JSON.stringify(SecretAnswered.fromJson(JsonReader.parse(value).toJson()).toJson()));
    Assert.areEqual(failure, JSON.stringify(SecretAnswered.fromJson(JsonReader.parse(failure).toJson()).toJson()));
    Assert.areEqual(SecretFailureKind.Unprotected, SecretAnswered.fromJson(JsonReader.parse(failure).toJson()).failure);
    Assert.areEqual("value", Assert.throws(() => new SecretAnswered(2, "AAEC", SecretFailureKind.Undecryptable), ArgumentException).parameterName);
    Assert.areEqual("value", Assert.throws(() => new SecretAnswered(2), ArgumentException).parameterName);
    Assert.areEqual("call", Assert.throws(() => new SecretAnswered(-1, "AAEC"), ArgumentException).parameterName);
    Assert.areEqual("$.failure", Assert.throws(() => SecretAnswered.fromJson({ call: 2, failure: "Lost" }), JsonException).path);
  }
}
