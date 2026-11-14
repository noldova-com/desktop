/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type Event, QualifiedName } from "@noldova/desktop.protocol";
import { EventDeclaredException, EventRegistry, EventWithdrawnException, type IEventSink } from "@noldova/desktop.runtime";

import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";

@TestClass
export class EventRegistryTests {
  private static readonly NAME: QualifiedName = new QualifiedName("notes", "changed");

  @TestMethod
  public publishesADeclaredEventToTheSink(): void {
    const events: Event[] = [];
    const registry = new EventRegistry(EventRegistryTests.createSink(events));

    registry.declare(EventRegistryTests.NAME).publish({ path: "notes.md" });

    Assert.areEqual(1, events.length);
    Assert.areEqual("notes.changed", events[0]?.name.text);
    Assert.areEqual("{\"path\":\"notes.md\"}", JSON.stringify(events[0]?.payload));
  }

  @TestMethod
  public publishesToOneConnectionForOneWindowOrForNone(): void {
    const sink = new EventSinkFixture();
    const channel = new EventRegistry(sink).declare(EventRegistryTests.NAME);

    channel.publishTo(2, 3, { path: "notes.md" });
    channel.publishTo(4, null, null);
    channel[Symbol.dispose]();

    Assert.areEqual(0, sink.broadcasts.length);
    Assert.areEqual(
      "2:{\"kind\":\"Event\",\"name\":\"notes.changed\",\"payload\":{\"path\":\"notes.md\"},\"window\":3}|4:{\"kind\":\"Event\",\"name\":\"notes.changed\",\"payload\":null}",
      sink.sent.map(([event, connection]) => `${connection}:${event.toText()}`).join("|"));
    Assert.throws(() => channel.publishTo(2, 3, null), EventWithdrawnException);
  }

  @TestMethod
  public refusesASecondDeclarationOfOneName(): void {
    const registry = new EventRegistry(EventRegistryTests.createSink([]));
    registry.declare(EventRegistryTests.NAME);

    const exception = Assert.throws(() => registry.declare(EventRegistryTests.NAME), EventDeclaredException);

    Assert.areEqual("The event notes.changed is already declared.", exception.message);
  }

  @TestMethod
  public aWithdrawnChannelNoLongerPublishes(): void {
    const events: Event[] = [];
    const registry = new EventRegistry(EventRegistryTests.createSink(events));
    const channel = registry.declare(EventRegistryTests.NAME);

    channel[Symbol.dispose]();
    const exception = Assert.throws(() => channel.publish(null), EventWithdrawnException);

    Assert.areEqual("The event notes.changed is no longer declared.", exception.message);
    Assert.areEqual(0, events.length);
    registry.declare(EventRegistryTests.NAME).publish(null);
    Assert.areEqual(1, events.length);
  }

  private static createSink(events: Event[]): IEventSink {
    return { broadcast: t => events.push(t), send: () => undefined };
  }
}
