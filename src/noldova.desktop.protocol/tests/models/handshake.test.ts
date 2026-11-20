/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { BuildIdentity, Handshake, WireMessageKind } from "@noldova/desktop.protocol";

@TestClass
export class HandshakeTests {
  @TestMethod
  public roundTripsItsWireForm(): void {
    const handshake = Handshake.fromJson(new Handshake("h1", new BuildIdentity("0.0.1", 1, "abc"), "secret", "main").toJson());

    Assert.areEqual(WireMessageKind.Handshake, handshake.kind);
    Assert.areEqual("h1", handshake.id);
    Assert.areEqual("abc", handshake.identity.fingerprint);
    Assert.areEqual("secret", handshake.token);
    Assert.areEqual("main", handshake.client);
    Assert.areEqual(
      "{\"kind\":\"Handshake\",\"id\":\"h1\",\"identity\":{\"productVersion\":\"0.0.1\",\"protocolVersion\":1,\"fingerprint\":\"abc\"},\"token\":\"secret\",\"client\":\"main\"}",
      handshake.toText());
  }

  @TestMethod
  @TestData(" ", "secret", "main")
  @TestData("h1", " ", "main")
  @TestData("h1", "secret", " ")
  public rejectsBlankFields(id: string, token: string, client: string): void {
    Assert.throws(() => new Handshake(id, new BuildIdentity("0.0.1", 1, "abc"), token, client), ArgumentException);
  }

  @TestMethod
  @TestData("{\"kind\":\"Handshake\",\"id\":\"h1\",\"identity\":{\"productVersion\":\"0.0.1\",\"protocolVersion\":1,\"fingerprint\":\"abc\"},\"token\":\"t\",\"client\":\"cli\",\"scope\":\"all\"}", "$.scope")
  @TestData("{\"id\":\"h1\",\"identity\":{\"productVersion\":\"0.0.1\",\"protocolVersion\":1,\"fingerprint\":\"abc\",\"admin\":true},\"token\":\"t\",\"client\":\"cli\"}", "$.identity.admin")
  public rejectsUnknownFields(text: string, path: string): void {
    const failure = Assert.throws(() => Handshake.fromJson(JsonReader.parse(text).toJson()), JsonException);

    Assert.areEqual(path, failure.path);
    Assert.isTrue(failure.message.includes("accepts no unknown fields"), failure.message);
  }

  @TestMethod
  public namesTheInvalidFieldOnTheWire(): void {
    const identity = { productVersion: "0.0.1", protocolVersion: 1, fingerprint: "abc" };

    Assert.areEqual("$.token", Assert.throws(() => Handshake.fromJson({ id: "h1", identity, token: String.empty, client: "cli" }), JsonException).path);
    Assert.areEqual("$.identity.fingerprint", Assert.throws(() => Handshake.fromJson({ id: "h1", identity: { ...identity, fingerprint: 1 }, token: "t", client: "cli" }), JsonException).path);
    Assert.areEqual("$.identity", Assert.throws(() => Handshake.fromJson({ id: "h1", token: "t", client: "cli" }), JsonException).path);
  }

  @TestMethod
  public takesAnIdOfAtMost256Characters(): void {
    const identity = new BuildIdentity("0.0.1", 1, "abc");

    Assert.areEqual(256, new Handshake("h".repeat(256), identity, "t", "cli").id.length);
    Assert.throws(() => new Handshake("h".repeat(257), identity, "t", "cli"), ArgumentOutOfRangeException);
    Assert.areEqual("$.id", Assert.throws(() => Handshake.fromJson({ id: "h".repeat(257), identity: identity.toJson(), token: "t", client: "cli" }), JsonException).path);
  }
}
