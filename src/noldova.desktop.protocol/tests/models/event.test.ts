/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Event, QualifiedName, WireMessageKind } from "@noldova/desktop.protocol";

@TestClass
export class EventTests {
  @TestMethod
  public roundTripsItsWireForm(): void {
    const event = Event.fromJson(new Event(QualifiedName.parse("desktop.layoutChanged"), [1, "two"]).toJson());

    Assert.areEqual(WireMessageKind.Event, event.kind);
    Assert.areEqual("desktop.layoutChanged", event.name.text);
    Assert.areEqual("[1,\"two\"]", JSON.stringify(event.payload));
    Assert.areEqual("{\"kind\":\"Event\",\"name\":\"desktop.layoutChanged\",\"payload\":[1,\"two\"]}", event.toText());
    Assert.isUndefined(event.window);
  }

  @TestMethod
  public roundTripsTheOneWindowItIsFor(): void {
    const event = Event.fromJson(new Event(QualifiedName.parse("terminal.output"), null, 3).toJson());

    Assert.areEqual(3, event.window);
    Assert.areEqual("{\"kind\":\"Event\",\"name\":\"terminal.output\",\"payload\":null,\"window\":3}", event.toText());
  }

  @TestMethod
  @TestData(0)
  @TestData(-1)
  @TestData(1.5)
  public rejectsAnInvalidWindow(window: number): void {
    Assert.throws(() => new Event(QualifiedName.parse("terminal.output"), null, window), ArgumentOutOfRangeException);
    Assert.areEqual("$.window", Assert.throws(() => Event.fromJson({ name: "terminal.output", payload: null, window }), JsonException).path);
  }

  @TestMethod
  public namesAnInvalidNameOnTheWire(): void {
    Assert.areEqual("$.name", Assert.throws(() => Event.fromJson({ name: "layoutChanged", payload: null }), JsonException).path);
  }
}
