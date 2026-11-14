/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ExitCodeUnreadableException, ExitWaitTimedOutException, JobAssignmentFailedException, JobClosedBeforeExitException } from "@noldova/desktop.runtime";

import { WindowsProcessJob } from "../../../src/services/process/windows-process-job.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

@TestClass
export class WindowsProcessJobTests {
  @TestMethod
  public putsARunningProcessInAJobOfItsOwnAndClosesTheJob(): void {
    const windows = new WindowsProcessApiFixture();

    const job = WindowsProcessJob.open(windows, process.pid, true);
    const listed = job.listProcessIds().join(",");
    job.close();

    Assert.areEqual(String(process.pid), listed);
    Assert.areEqual("true", windows.createdJobs.join(","));
    Assert.areEqual(`${process.pid} ${WindowsProcessApiFixture.JOB}`, windows.opened.join(","));
    Assert.areEqual(0, windows.openHandles);
  }

  @TestMethod
  public opensAJobThatLetsWhatItsProcessStartsLeaveIt(): void {
    const windows = new WindowsProcessApiFixture();

    const job = WindowsProcessJob.open(windows, process.pid, false);
    job.close();

    Assert.areEqual("false", windows.createdJobs.join(","));
    Assert.areEqual(0, windows.openHandles);
  }

  @TestMethod
  public opensAnEmptyJobThatHoldsAProcessThatEndedBeforeItsAssignment(): void {
    using simulated = new SimulatedProcessesFixture();
    const windows = new WindowsProcessApiFixture();

    const job = WindowsProcessJob.open(windows, 900_401, true);
    const listed = job.listProcessIds().length;
    const open = windows.openHandles;
    job.close();

    Assert.areEqual(0, listed);
    Assert.areEqual(2, open);
    Assert.areEqual(String.empty, simulated.signals.join(","));
  }

  @TestMethod
  public refusesAProcessItCannotOpenAndClosesTheJob(): void {
    const windows = new WindowsProcessApiFixture();
    windows.denied.set(process.pid, WindowsProcessApiFixture.JOB);

    const failure = Assert.throws(() => WindowsProcessJob.open(windows, process.pid, true), JobAssignmentFailedException);

    Assert.areEqual(`Process ${process.pid} could not be put in a job of its own, with Windows error 5, so what it starts is found only by its parent.`, failure.message);
    Assert.areEqual(0, windows.openHandles);
  }

  @TestMethod
  public refusesARunningProcessWindowsWouldNotPutInTheJobAndClosesBothHandles(): void {
    const windows = new WindowsProcessApiFixture();
    windows.assignmentError = 8;

    const failure = Assert.throws(() => WindowsProcessJob.open(windows, process.pid, true), JobAssignmentFailedException);

    Assert.areEqual(`Process ${process.pid} could not be put in a job of its own, with Windows error 8, so what it starts is found only by its parent.`, failure.message);
    Assert.areEqual(0, windows.openHandles);
  }

  @TestMethod
  public async readsTheExitCodeOfItsProcessOnceItEndsAsNodePtyGivesIt(): Promise<void> {
    using simulated = new SimulatedProcessesFixture();
    const windows = new WindowsProcessApiFixture();
    simulated.add(900_402, 0);
    windows.exitCodes.set(900_402, -1_073_741_510);
    const job = WindowsProcessJob.open(windows, 900_402, false);

    const reading = job.readExitCodeAsync(60_000);
    const hasWaited = await WaitFixture.untilAsync(() => windows.exitChecks >= 2, 60_000);
    simulated.remove(900_402);
    const code = await reading;
    job.close();

    Assert.isTrue(hasWaited, "The read did not check the process again while it ran.");
    Assert.areEqual(-1_073_741_510, code);
    Assert.areEqual(0, windows.openHandles);
  }

  @TestMethod
  public async refusesToReadTheCodeOfAProcessStillRunningAtTheLimit(): Promise<void> {
    using simulated = new SimulatedProcessesFixture();
    const windows = new WindowsProcessApiFixture();
    simulated.add(900_403, 0);
    windows.exitCodes.set(900_403, 7);
    const job = WindowsProcessJob.open(windows, 900_403, false);

    const failure = await Assert.throwsAsync(() => job.readExitCodeAsync(100), ExitWaitTimedOutException);
    job.close();

    Assert.areEqual("Process 900403 was still running 100 ms after its output closed, so its exit code could not be read.", failure.message);
  }

  @TestMethod
  public async refusesAnEndedProcessWhoseCodeWindowsDoesNotGive(): Promise<void> {
    using simulated = new SimulatedProcessesFixture();
    const windows = new WindowsProcessApiFixture();
    const job = WindowsProcessJob.open(windows, 900_404, false);

    const failure = await Assert.throwsAsync(() => job.readExitCodeAsync(5_000), ExitCodeUnreadableException);
    job.close();

    Assert.areEqual("Windows gave no exit code for process 900404.", failure.message);
    Assert.areEqual(String.empty, simulated.signals.join(","));
  }

  @TestMethod
  public async stopsWaitingForTheCodeOnceTheJobCloses(): Promise<void> {
    using simulated = new SimulatedProcessesFixture();
    const windows = new WindowsProcessApiFixture();
    simulated.add(900_405, 0);
    const job = WindowsProcessJob.open(windows, 900_405, false);

    const reading = job.readExitCodeAsync(60_000);
    const checks = windows.exitChecks;
    job.close();
    const failure = await Assert.throwsAsync(() => reading, JobClosedBeforeExitException);

    Assert.areEqual("The job of process 900405 closed before its exit code was read.", failure.message);
    Assert.areEqual(checks, windows.exitChecks);
    Assert.areEqual(0, windows.openHandles);
  }
}
