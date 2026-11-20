/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { tmpdir } from "node:os";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessTimeoutException } from "../../../src/exceptions/process-timeout.exception.js";
import { Resources } from "../../../src/resources.js";
import { DeadlineRunner } from "../../../src/services/processes/deadline-runner.js";
import { TimedRunnerFixture } from "../../fixtures/timed-runner.fixture.js";

@TestClass
export class DeadlineRunnerTests {
  private static readonly COMMAND: string = "xcrun";
  private static readonly HOUR: number = 3_600_000;
  private static readonly LIMIT: number = 60_000;

  @TestMethod
  public async passesEachTimeoutOnUnchangedWithoutALimit(): Promise<void> {
    const inner = new TimedRunnerFixture(0);
    const runner = new DeadlineRunner(inner);

    await runner.captureAsync(DeadlineRunnerTests.COMMAND, [], tmpdir(), 1_000);
    await runner.runAsync(DeadlineRunnerTests.COMMAND, [], tmpdir());
    await runner.runAsync(DeadlineRunnerTests.COMMAND, [], tmpdir(), undefined, undefined, 500);

    Assert.areEqual("1000|undefined|500", inner.timeouts.map(String).join("|"));
  }

  @TestMethod
  public async capsEachProcessAtTheTimeLeftAndStopsItWithPackagingsOwnError(): Promise<void> {
    const inner = new TimedRunnerFixture(DeadlineRunnerTests.HOUR);
    const runner = new DeadlineRunner(inner);
    runner.start(DeadlineRunnerTests.LIMIT);

    const captured = await Assert.throwsAsync(() => runner.captureAsync(DeadlineRunnerTests.COMMAND, [], tmpdir(), 2 * DeadlineRunnerTests.HOUR), BuildException);
    const run = await Assert.throwsAsync(() => runner.runAsync(DeadlineRunnerTests.COMMAND, [], tmpdir()), BuildException);

    for (const error of [captured, run]) {
      Assert.areEqual(Resources.formatPackagingLimitReached(DeadlineRunnerTests.LIMIT, DeadlineRunnerTests.COMMAND), error.message);
      Assert.isFalse(error instanceof ProcessTimeoutException);
      Assert.isInstanceOf(error.cause, ProcessTimeoutException);
    }
    Assert.isTrue(inner.timeouts.every(t => !Object.isUndefined(t) && t > 0 && t <= DeadlineRunnerTests.LIMIT), inner.timeouts.join());
  }

  @TestMethod
  public async keepsAProcessOwnTimeoutWhenItEndsBeforeTheLimit(): Promise<void> {
    const inner = new TimedRunnerFixture(10_000);
    const runner = new DeadlineRunner(inner);
    runner.start(DeadlineRunnerTests.HOUR);

    const captured = await Assert.throwsAsync(() => runner.captureAsync(DeadlineRunnerTests.COMMAND, [], tmpdir(), 1_000), ProcessTimeoutException);
    const run = await Assert.throwsAsync(() => runner.runAsync(DeadlineRunnerTests.COMMAND, [], tmpdir(), undefined, undefined, 1_000), ProcessTimeoutException);

    for (const error of [captured, run])
      Assert.areEqual(`"${DeadlineRunnerTests.COMMAND}" did not finish within 1000 ms.`, error.message);
    Assert.areEqual("1000|1000", inner.timeouts.join("|"));
  }

  @TestMethod
  public async startsNoProcessOnceTheLimitHasPassedUntilItIsStopped(): Promise<void> {
    const inner = new TimedRunnerFixture(0);
    const runner = new DeadlineRunner(inner);
    runner.start(0);

    const captured = await Assert.throwsAsync(() => runner.captureAsync(DeadlineRunnerTests.COMMAND, [], tmpdir(), 1_000), BuildException);
    const run = await Assert.throwsAsync(() => runner.runAsync(DeadlineRunnerTests.COMMAND, [], tmpdir()), BuildException);
    const started = inner.timeouts.length;
    runner.stop();
    await runner.captureAsync(DeadlineRunnerTests.COMMAND, [], tmpdir(), 1_000);

    for (const error of [captured, run])
      Assert.areEqual(Resources.formatPackagingLimitReached(0, DeadlineRunnerTests.COMMAND), error.message);
    Assert.areEqual(0, started);
    Assert.areEqual("1000", inner.timeouts.join("|"));
  }

  @TestMethod
  public async handsStartingCheckingAndKillingAProcessToTheInnerRunner(): Promise<void> {
    const inner = new TimedRunnerFixture(0);
    const runner = new DeadlineRunner(inner);

    const error = await Assert.throwsAsync(() => runner.startAsync(DeadlineRunnerTests.COMMAND, [], tmpdir(), "log.txt"), Error);
    const isRunning = runner.isRunning(7);
    runner.kill(7);

    Assert.areEqual(DeadlineRunnerTests.COMMAND, error.message);
    Assert.isTrue(isRunning);
    Assert.areEqual("start xcrun|running 7|kill 7", inner.calls.join("|"));
  }
}
