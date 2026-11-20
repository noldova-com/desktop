/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { QualifiedName, Request, WireMessageKind } from "@noldova/desktop.protocol";

@TestClass
export class RequestTests {
  @TestMethod
  public roundTripsARequestWithoutATimeLimit(): void {
    const request = Request.fromJson(new Request("r1", QualifiedName.parse("notes.capture"), { folder: "a" }).toJson());

    Assert.areEqual(WireMessageKind.Request, request.kind);
    Assert.areEqual("r1", request.id);
    Assert.areEqual("notes.capture", request.method.text);
    Assert.areEqual("{\"folder\":\"a\"}", JSON.stringify(request.payload));
    Assert.isUndefined(request.timeoutMilliseconds);
    Assert.areEqual("{\"kind\":\"Request\",\"id\":\"r1\",\"method\":\"notes.capture\",\"payload\":{\"folder\":\"a\"}}", request.toText());
  }

  @TestMethod
  public roundTripsATimeLimit(): void {
    const request = Request.fromJson(new Request("r1", QualifiedName.parse("desktop.ping"), null, 250).toJson());

    Assert.areEqual(250, request.timeoutMilliseconds);
    Assert.isNull(request.payload);
    Assert.areEqual("{\"kind\":\"Request\",\"id\":\"r1\",\"method\":\"desktop.ping\",\"payload\":null,\"timeoutMilliseconds\":250}", request.toText());
  }

  @TestMethod
  public roundTripsTheWindowItWasSentFor(): void {
    const request = Request.fromJson(new Request("r1", QualifiedName.parse("terminal.open"), null, undefined, 3).toJson());
    const timed = Request.fromJson(new Request("r2", QualifiedName.parse("terminal.open"), null, 250, 3).toJson());

    Assert.areEqual(3, request.window);
    Assert.isUndefined(request.timeoutMilliseconds);
    Assert.areEqual("{\"kind\":\"Request\",\"id\":\"r1\",\"method\":\"terminal.open\",\"payload\":null,\"window\":3}", request.toText());
    Assert.areEqual("{\"kind\":\"Request\",\"id\":\"r2\",\"method\":\"terminal.open\",\"payload\":null,\"timeoutMilliseconds\":250,\"window\":3}", timed.toText());
    Assert.isUndefined(Request.fromJson({ id: "r3", method: "desktop.ping", payload: null }).window);
  }

  @TestMethod
  public roundTripsThePageOfTheWindowItWasSentFor(): void {
    const request = Request.fromJson(new Request("r1", QualifiedName.parse("terminal.open"), null, undefined, 3, 2).toJson());

    Assert.areEqual("3,2", `${request.window},${request.page}`);
    Assert.areEqual("{\"kind\":\"Request\",\"id\":\"r1\",\"method\":\"terminal.open\",\"payload\":null,\"window\":3,\"page\":2}", request.toText());
    Assert.isUndefined(Request.fromJson({ id: "r2", method: "terminal.open", payload: null, window: 3 }).page);
  }

  @TestMethod
  @TestData(3, 0)
  @TestData(3, -1)
  @TestData(3, 1.5)
  @TestData(undefined, 2)
  public rejectsAnInvalidPageOrOneWithoutAWindow(window: number | undefined, page: number): void {
    Assert.throws(() => new Request("r1", QualifiedName.parse("desktop.ping"), null, undefined, window, page), ArgumentOutOfRangeException);
  }

  @TestMethod
  @TestData(0)
  @TestData(-1)
  @TestData(1.5)
  public rejectsAnInvalidTimeLimit(timeout: number): void {
    Assert.throws(() => new Request("r1", QualifiedName.parse("desktop.ping"), null, timeout), ArgumentOutOfRangeException);
  }

  @TestMethod
  @TestData(0)
  @TestData(-1)
  @TestData(1.5)
  public rejectsAnInvalidWindow(window: number): void {
    Assert.throws(() => new Request("r1", QualifiedName.parse("desktop.ping"), null, undefined, window), ArgumentOutOfRangeException);
  }

  @TestMethod
  public rejectsABlankId(): void {
    Assert.throws(() => new Request(" ", QualifiedName.parse("desktop.ping"), null), ArgumentException);
  }

  @TestMethod
  public takesAnIdOfAtMost256Characters(): void {
    Assert.areEqual(256, new Request("r".repeat(256), QualifiedName.parse("desktop.ping"), null).id.length);
    Assert.throws(() => new Request("r".repeat(257), QualifiedName.parse("desktop.ping"), null), ArgumentOutOfRangeException);
    Assert.areEqual("$.id", Assert.throws(() => Request.fromJson({ id: "r".repeat(257), method: "desktop.ping", payload: null }), JsonException).path);
  }

  @TestMethod
  @TestData("{\"id\":\"r1\",\"method\":\"ping\",\"payload\":null}", "$.method")
  @TestData("{\"id\":\"r1\",\"method\":\"desktop.ping\",\"payload\":null,\"timeoutMilliseconds\":0}", "$.timeoutMilliseconds")
  @TestData("{\"id\":\"r1\",\"method\":\"desktop.ping\",\"payload\":null,\"timeoutMilliseconds\":\"5\"}", "$.timeoutMilliseconds")
  @TestData("{\"id\":\"r1\",\"method\":\"desktop.ping\",\"payload\":null,\"window\":0}", "$.window")
  @TestData("{\"id\":\"r1\",\"method\":\"desktop.ping\",\"payload\":null,\"window\":\"3\"}", "$.window")
  @TestData("{\"id\":\"r1\",\"method\":\"desktop.ping\",\"payload\":null,\"window\":3,\"page\":0}", "$.page")
  @TestData("{\"id\":\"r1\",\"method\":\"desktop.ping\",\"payload\":null,\"window\":3,\"page\":\"2\"}", "$.page")
  @TestData("{\"id\":\"r1\",\"method\":\"desktop.ping\",\"payload\":null,\"page\":2}", "$.page")
  @TestData("{\"id\":\"\",\"method\":\"desktop.ping\",\"payload\":null}", "$.id")
  @TestData("{\"id\":\"r1\",\"method\":\"desktop.ping\"}", "$.payload")
  public namesTheInvalidFieldOnTheWire(text: string, path: string): void {
    Assert.areEqual(path, Assert.throws(() => Request.fromJson(JsonReader.parse(text).toJson()), JsonException).path);
  }
}
