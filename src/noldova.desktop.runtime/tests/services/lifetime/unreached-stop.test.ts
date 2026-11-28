/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { UnreachedStop } from "../../../src/services/lifetime/unreached-stop.js";

@TestClass
export class UnreachedStopTests {
  @TestMethod
  public isAlwaysIdleAndStopsOnlyWhenItsGraceEnds(): void {
    let stops = 0;
    const participant = new UnreachedStop(() => stops++);

    const idleBefore = participant.isIdle;
    const stopsBefore = stops;
    participant.handleIdle();

    Assert.areEqual("true|0|1", `${idleBefore}|${stopsBefore}|${stops}`);
  }
}
