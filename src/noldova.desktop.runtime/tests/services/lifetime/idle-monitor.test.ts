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
import { IdleMonitor } from "@noldova/desktop.runtime";

import { IdleParticipantFixture } from "../../fixtures/idle-participant.fixture.js";

@TestClass
export class IdleMonitorTests {
  private static readonly GRACE: number = 20;

  @TestMethod
  public reportsIdlenessOnceAfterTheGraceAndArmsAgainAfterReporting(): Promise<void> {
    return IdleMonitorTests.runAsync(async (participant, monitor) => {
      const reported = participant.waitForIdleAsync();
      monitor.check();
      monitor.check();

      await reported;
      await IdleMonitorTests.graceEndedAsync();
      const once = participant.idleCount;
      const again = participant.waitForIdleAsync();
      monitor.check();
      await again;

      Assert.areEqual("1 2", `${String(once)} ${String(participant.idleCount)}`);
    });
  }

  @TestMethod
  public disarmsWhenTheParticipantBecomesBusy(): Promise<void> {
    return IdleMonitorTests.runAsync(async (participant, monitor) => {
      monitor.check();
      participant.isIdle = false;
      monitor.check();
      monitor.check();

      await IdleMonitorTests.graceEndedAsync();

      Assert.areEqual("3 0", `${String(participant.queryCount)} ${String(participant.idleCount)}`);
    });
  }

  @TestMethod
  public ignoresTheGraceEndingWhileTheParticipantIsBusyAndStaysDisarmed(): Promise<void> {
    return IdleMonitorTests.runAsync(async (participant, monitor) => {
      monitor.check();
      const graceEnded = participant.waitForQueryAsync();
      participant.isIdle = false;

      await graceEnded;
      participant.isIdle = true;
      await IdleMonitorTests.graceEndedAsync();

      Assert.areEqual("2 0", `${String(participant.queryCount)} ${String(participant.idleCount)}`);
    });
  }

  @TestMethod
  public staysDisarmedOnceDisposed(): Promise<void> {
    return IdleMonitorTests.runAsync(async (participant, monitor) => {
      monitor.check();
      monitor[Symbol.dispose]();
      monitor.check();

      await IdleMonitorTests.graceEndedAsync();

      Assert.areEqual("1 0", `${String(participant.queryCount)} ${String(participant.idleCount)}`);
    });
  }

  @TestMethod
  public requiresAPositiveGrace(): void {
    const exception = Assert.throws(() => new IdleMonitor(0, new IdleParticipantFixture()), ArgumentOutOfRangeException);

    Assert.areEqual("idleGraceMilliseconds", exception.parameterName);
  }

  private static async graceEndedAsync(): Promise<void> {
    const participant = new IdleParticipantFixture();
    using monitor = new IdleMonitor(IdleMonitorTests.GRACE, participant);
    const reported = participant.waitForIdleAsync();
    monitor.check();
    await reported;
  }

  private static async runAsync(test: (participant: IdleParticipantFixture, monitor: IdleMonitor) => Promise<void>): Promise<void> {
    const participant = new IdleParticipantFixture();
    using monitor = new IdleMonitor(IdleMonitorTests.GRACE, participant);
    await test(participant, monitor);
  }
}
