/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProcessTimeoutException } from "../../../src/exceptions/process-timeout.exception.js";
import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { CoverageEnvironmentFixture } from "../../fixtures/coverage-environment.fixture.js";

@TestClass
export class ProcessRunnerTests {
  private static readonly LIMIT: number = 30_000;
  private static readonly MISSING: string = "no-such-program-for-this-test";

  @TestMethod
  public async capturesTheExitCodeAndBothOutputsInTheGivenEnvironment(): Promise<void> {
    const script = "process.stdout.write(process.env.SAMPLE_VALUE ?? 'none'); process.stderr.write('err'); process.exit(2)";

    const result = await new ProcessRunner().captureAsync(process.execPath, ["-e", script], tmpdir(), ProcessRunnerTests.LIMIT, { ...process.env, SAMPLE_VALUE: "given" });
    const inherited = await new ProcessRunner().captureAsync(process.execPath, ["-e", script], tmpdir(), ProcessRunnerTests.LIMIT);

    Assert.areEqual("2|given|err", [result.exitCode, result.output, result.errorOutput].join("|"));
    Assert.areEqual("none", inherited.output);
  }

  @TestMethod
  public async stopsAProcessThatWritesMoreThanTheLimit(): Promise<void> {
    const script = `process.stdout.write("x".repeat(${Resources.processOutputLimit + 1}))`;

    const error = await Assert.throwsAsync(() => new ProcessRunner().captureAsync(process.execPath, ["-e", script], tmpdir(), ProcessRunnerTests.LIMIT), BuildException);

    Assert.areEqual(`"${process.execPath}" wrote more than ${Resources.processOutputLimit} bytes.`, error.message);
  }

  @TestMethod
  public async stopsAProcessThatRunsPastItsTimeout(): Promise<void> {
    const error = await Assert.throwsAsync(
      () => new ProcessRunner().captureAsync(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], tmpdir(), 200), ProcessTimeoutException);

    Assert.areEqual(`"${process.execPath}" did not finish within 200 ms.`, error.message);
  }

  @TestMethod
  public async refusesAProgramThatCannotStart(): Promise<void> {
    const runner = new ProcessRunner();
    const folder = await mkdtemp(path.join(tmpdir(), "process-runner-"));
    try {
      const captured = await Assert.throwsAsync(() => runner.captureAsync(ProcessRunnerTests.MISSING, [], folder, ProcessRunnerTests.LIMIT), BuildException);
      const run = await Assert.throwsAsync(() => runner.runAsync(ProcessRunnerTests.MISSING, [], folder), BuildException);
      const watched = await Assert.throwsAsync(() => runner.runAsync(ProcessRunnerTests.MISSING, [], folder, process.env, () => undefined), BuildException);
      const started = await Assert.throwsAsync(() => runner.startAsync(ProcessRunnerTests.MISSING, [], folder, path.join(folder, "log.txt")), BuildException);

      for (const error of [captured, run, watched, started]) {
        Assert.areEqual(`"${ProcessRunnerTests.MISSING}" could not start.`, error.message);
        Assert.isInstanceOf(error.cause, Error);
      }
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public async requiresAProcessToSucceedAndNamesItsFailure(): Promise<void> {
    const runner = new ProcessRunner();

    await runner.requireAsync(process.execPath, ["-e", "process.exit(0)"], tmpdir(), ProcessRunnerTests.LIMIT);
    const error = await Assert.throwsAsync(() => runner.requireAsync(process.execPath, ["-e", "process.stderr.write('broken'); process.exit(3)"], tmpdir(), ProcessRunnerTests.LIMIT,
      process.env), BuildException);

    Assert.areEqual(Resources.formatProcessFailed(path.basename(process.execPath), ["-e", "process.stderr.write('broken'); process.exit(3)"], 3, "broken"), error.message);
  }

  @TestMethod
  public async runsAProcessOnTheConsoleAndAnswersItsExitCode(): Promise<void> {
    const runner = new ProcessRunner();

    Assert.areEqual(4, await runner.runAsync(process.execPath, ["-e", "process.exit(4)"], tmpdir()));
    Assert.areEqual(0, await runner.runAsync(process.execPath, ["-e", "process.exit(0)"], tmpdir(), process.env));
  }

  @TestMethod
  public async showsAWatchedProcessOutputAndHandsEachChunkToTheWatchInTheGivenEnvironment(): Promise<void> {
    const script = "process.stdout.write(process.env.SAMPLE_VALUE ?? 'none'); process.stderr.write('|err'); process.exit(5)";
    const given: string[] = [];
    const inherited: string[] = [];

    const exitCode = await new ProcessRunner().runAsync(process.execPath, ["-e", script], tmpdir(), { ...process.env, SAMPLE_VALUE: "given" }, t => given.push(t));
    const inheritedExitCode = await new ProcessRunner().runAsync(process.execPath, ["-e", script], tmpdir(), undefined, t => inherited.push(t));

    Assert.areEqual("5|5", `${exitCode}|${inheritedExitCode}`);
    Assert.areEqual("given|err", [...given].sort().join(String.empty));
    Assert.areEqual("none|err", [...inherited].sort().join(String.empty));
  }

  @TestMethod
  public async passesAWatchedProcessOutputOnToItsOwnOutputs(): Promise<void> {
    const inner = "process.stdout.write('out'); process.stderr.write('err'); process.exit(3)";
    const outer = `const { ProcessRunner } = await import(${JSON.stringify(import.meta.resolve("../../../src/services/processes/process-runner.js"))}); `
      + `process.exitCode = await new ProcessRunner().runAsync(process.execPath, ["-e", ${JSON.stringify(inner)}], process.cwd(), process.env, () => undefined);`;

    const result = await new ProcessRunner().captureAsync(process.execPath, ["--input-type=module", "-e", outer], tmpdir(), ProcessRunnerTests.LIMIT,
      CoverageEnvironmentFixture.forChild(process.env));

    Assert.areEqual("3|out|err", [result.exitCode, result.output, result.errorOutput].join("|"));
  }

  @TestMethod
  public async tellsWhetherAProcessRunsAndKillsIt(): Promise<void> {
    const runner = new ProcessRunner();
    const folder = await mkdtemp(path.join(tmpdir(), "process-runner-"));
    try {
      const started = await runner.startAsync(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], folder, path.join(folder, "log.txt"));
      const wasRunning = runner.isRunning(started.id);

      runner.kill(started.id);

      Assert.isTrue(wasRunning);
      Assert.isTrue(await started.waitAsync(ProcessRunnerTests.LIMIT));
      Assert.isFalse(runner.isRunning(started.id));
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public passesOnAFailureToSignalOtherThanAMissingProcess(): void {
    Assert.throws(() => new ProcessRunner().isRunning(Number.NaN), Error);
  }
}
