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
import { UpdateRequest } from "@noldova/desktop.protocol";

@TestClass
export class UpdateRequestTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"installation\":\"/home/person/.local/state/noldova/desktop/installations/0123456789abcdef\"}";

    Assert.areEqual(text, JSON.stringify(new UpdateRequest("/home/person/.local/state/noldova/desktop/installations/0123456789abcdef").toJson()));
    Assert.areEqual(text, JSON.stringify(UpdateRequest.fromJson(JsonReader.parse(text).toJson()).toJson()));
  }

  @TestMethod
  public rejectsABlankInstallationOrAnUnknownField(): void {
    Assert.throws(() => new UpdateRequest(" "), ArgumentException);
    Assert.areEqual("$.installation", Assert.throws(() => UpdateRequest.fromJson({ installation: String.empty }), JsonException).path);
    Assert.areEqual("$.version", Assert.throws(() => UpdateRequest.fromJson({ installation: "i", version: "1" }), JsonException).path);
  }
}
