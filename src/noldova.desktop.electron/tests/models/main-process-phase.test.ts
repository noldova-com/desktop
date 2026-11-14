/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { MainProcessPhase } from "../../src/models/main-process-phase.js";

@TestClass
export class MainProcessPhaseTests {
  @TestMethod
  public startsBeforeTheBarrierNotReadyAndNotExitingAndKeepsEachStepItIsGiven(): void {
    const phase = new MainProcessPhase();
    const before = [phase.hasPassedBarrier, phase.isReady, phase.isExiting].join(",");

    phase.isReady = true;

    Assert.areEqual("false,false,false", before);
    Assert.areEqual("false,true,false", [phase.hasPassedBarrier, phase.isReady, phase.isExiting].join(","));
  }
}
