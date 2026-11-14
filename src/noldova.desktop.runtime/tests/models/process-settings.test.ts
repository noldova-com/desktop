/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessSettings } from "@noldova/desktop.runtime";

@TestClass
export class ProcessSettingsTests {
  @TestMethod
  public givesAProgramThreeSecondsToExitAndKilledProgramsFiveToEndSeesRunningProgramsEveryFiveAndWatchesTerminalsEverySecond(): void {
    const settings = new ProcessSettings();

    Assert.areEqual(3_000, settings.graceMilliseconds);
    Assert.areEqual(5_000, settings.endMilliseconds);
    Assert.areEqual(5_000, settings.seenMilliseconds);
    Assert.areEqual(1_000, settings.terminalWatchMilliseconds);
    Assert.areEqual(1_000, settings.terminalReportMilliseconds);
  }

  @TestMethod
  public keepsTheGivenTimes(): void {
    const settings = new ProcessSettings(10, 20, 30, 40, 50);

    Assert.areEqual(10, settings.graceMilliseconds);
    Assert.areEqual(20, settings.endMilliseconds);
    Assert.areEqual(30, settings.seenMilliseconds);
    Assert.areEqual(40, settings.terminalWatchMilliseconds);
    Assert.areEqual(50, settings.terminalReportMilliseconds);
  }

  @TestMethod
  public boundsAStopByTheGraceAndThreeEndWaits(): void {
    Assert.areEqual(18_000, new ProcessSettings().stopLimit);
    Assert.areEqual(70, new ProcessSettings(10, 20, 30).stopLimit);
  }

  @TestMethod
  public rejectsTimesThatAreNotPositiveIntegers(): void {
    Assert.areEqual("graceMilliseconds", Assert.throws(() => new ProcessSettings(0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("endMilliseconds", Assert.throws(() => new ProcessSettings(1, 1.5), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("seenMilliseconds", Assert.throws(() => new ProcessSettings(1, 1, -1), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("terminalWatchMilliseconds", Assert.throws(() => new ProcessSettings(1, 1, 1, 0), ArgumentOutOfRangeException).parameterName);
    Assert.areEqual("terminalReportMilliseconds", Assert.throws(() => new ProcessSettings(1, 1, 1, 1, 2.5), ArgumentOutOfRangeException).parameterName);
  }
}
