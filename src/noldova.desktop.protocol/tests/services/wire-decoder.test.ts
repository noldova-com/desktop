/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { BuildIdentity, Cancel, Event, Failure, FailureCode, Handshake, QualifiedName, Request, Response, WireDecoder } from "@noldova/desktop.protocol";

@TestClass
export class WireDecoderTests {
  private readonly decoder: WireDecoder = new WireDecoder();

  @TestMethod
  public decodesEveryKind(): void {
    const messages = [
      new Handshake("h1", new BuildIdentity("0.0.1", 1, "abc"), "secret", "cli"),
      new Request("r1", QualifiedName.parse("desktop.ping"), null, 100),
      Response.success("r1", "pong"),
      Response.failure("r2", new Failure(FailureCode.Cancelled, "Cancelled.")),
      new Event(QualifiedName.parse("desktop.changed"), { value: 1 }),
      new Cancel("r3")
    ];

    for (const message of messages) {
      const decoded = this.decoder.decode(message.toText());
      Assert.areEqual(message.kind, decoded.kind);
      Assert.areEqual(message.toText(), decoded.toText());
    }

    Assert.isInstanceOf(this.decoder.decode(messages[0]?.toText() ?? String.empty), Handshake);
    Assert.isInstanceOf(this.decoder.decode(messages[5]?.toText() ?? String.empty), Cancel);
  }

  @TestMethod
  public ignoresUnknownFields(): void {
    Assert.isInstanceOf(this.decoder.decode("{\"kind\":\"Cancel\",\"id\":\"r1\",\"extra\":true}"), Cancel);
  }

  @TestMethod
  @TestData("not json", "$")
  @TestData("[1]", "$")
  @TestData("{\"id\":\"r1\"}", "$.kind")
  @TestData("{\"kind\":\"Unknown\",\"id\":\"r1\"}", "$.kind")
  @TestData("{\"kind\":\"Request\",\"id\":\"r1\",\"method\":\"bad\",\"payload\":null}", "$.method")
  public rejectsAMalformedFrame(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => this.decoder.decode(text), JsonException).path);
  }
}
