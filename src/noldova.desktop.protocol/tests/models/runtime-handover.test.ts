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
import { BuildIdentity, RuntimeHandover } from "@noldova/desktop.protocol";

@TestClass
export class RuntimeHandoverTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const handover = new RuntimeHandover(new BuildIdentity("0.0.2", 1, "def"), "C:\\Program Files\\Noldova Desktop Sample\\Noldova Desktop Sample.exe");
    const text = "{\"identity\":{\"productVersion\":\"0.0.2\",\"protocolVersion\":1,\"fingerprint\":\"def\"},\"executablePath\":\"C:\\\\Program Files\\\\Noldova Desktop Sample\\\\Noldova Desktop Sample.exe\"}";

    Assert.areEqual(text, JSON.stringify(handover.toJson()));
    const read = RuntimeHandover.fromJson(JsonReader.parse(text).toJson());
    Assert.areEqual("def", read.identity.fingerprint);
    Assert.areEqual("C:\\Program Files\\Noldova Desktop Sample\\Noldova Desktop Sample.exe", read.executablePath);
  }

  @TestMethod
  public rejectsABlankPath(): void {
    Assert.throws(() => new RuntimeHandover(new BuildIdentity("0.0.2", 1, "def"), " "), ArgumentException);
    const identity = { productVersion: "0.0.2", protocolVersion: 1, fingerprint: "def" };
    Assert.areEqual("$.executablePath", Assert.throws(() => RuntimeHandover.fromJson({ identity, executablePath: String.empty }), JsonException).path);
    Assert.areEqual("$.identity.extra", Assert.throws(() => RuntimeHandover.fromJson({ identity: { ...identity, extra: 1 }, executablePath: "x" }), JsonException).path);
    Assert.areEqual("$.arguments", Assert.throws(() => RuntimeHandover.fromJson({ identity, executablePath: "x", arguments: [] }), JsonException).path);
  }
}
