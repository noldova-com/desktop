/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { Registration } from "@noldova/desktop.runtime";

import { ToolTurns } from "../../src/models/tool-turns.js";

@TestClass
export class ToolTurnsTests {
  @TestMethod
  public async givesAFreeResourceAtOnceAndRefusesItToAnotherSession(): Promise<void> {
    const turns = new ToolTurns();

    const taken = turns.takeAsync("/notes", "session-1");

    Assert.isNotNull(taken);
    await taken;
    Assert.isNull(turns.takeAsync("/notes", "session-2"));
    Assert.isNotNull(turns.takeAsync("/calendar", "session-2"));
  }

  @TestMethod
  public async queuesTheSameSessionsTurnsInOrder(): Promise<void> {
    const turns = new ToolTurns();
    const order: string[] = [];
    const first = await ToolTurnsTests.take(turns, "session-1");
    const second = ToolTurnsTests.take(turns, "session-1").then(t => { order.push("second"); return t; });
    const third = ToolTurnsTests.take(turns, "session-1").then(t => { order.push("third"); return t; });

    first[Symbol.dispose]();
    (await second)[Symbol.dispose]();
    (await third)[Symbol.dispose]();

    Assert.areEqual("second|third", order.join("|"));
  }

  @TestMethod
  public async freesTheResourceForAnotherSessionOnceEveryTurnIsReturned(): Promise<void> {
    const turns = new ToolTurns();
    const first = await ToolTurnsTests.take(turns, "session-1");
    const second = ToolTurnsTests.take(turns, "session-1");

    first[Symbol.dispose]();
    Assert.isNull(turns.takeAsync("/notes", "session-2"));
    (await second)[Symbol.dispose]();

    Assert.isNotNull(turns.takeAsync("/notes", "session-2"));
  }

  private static take(turns: ToolTurns, session: string): Promise<Registration> {
    const taken = turns.takeAsync("/notes", session);
    Assert.isNotNull(taken);
    return taken;
  }
}
