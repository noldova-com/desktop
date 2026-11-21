/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mock } from "node:test";

import { Assert, Category, TestClass, TestMethod } from "@noldova/context.testing";

import { ProcessTimeoutException } from "../../../src/exceptions/process-timeout.exception.js";
import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { CoverageEnvironmentFixture } from "../../fixtures/coverage-environment.fixture.js";
import { RefusingProcessTreeFixture } from "../../fixtures/refusing-process-tree.fixture.js";

@TestClass
export class ProcessRunnerTests {
  private static readonly LIMIT: number = 30_000;
  private static readonly MISSING: string = "no-such-program-for-this-test";
  private static readonly LIFETIME: number = 20_000;
  private static readonly CHILD: RegExp = /child ([0-9]+)\n/;
  private static readonly REFUSED_LIFETIME: number = 3_000;

  @TestMethod
  public async capturesTheExitCodeAndBothOutputsInTheGivenEnvironment(): Promise<void> {
    const script = "process.stdout.write(process.env.SAMPLE_VALUE ?? 'none'); process.stderr.write('err'); process.exit(2)";

    const result = await new ProcessRunner().captureAsync(process.execPath, ["-e", script], tmpdir(), ProcessRunnerTests.LIMIT, { ...process.env, SAMPLE_VALUE: "given" });
    const inherited = await new ProcessRunner().captureAsync(process.execPath, ["-e", script], tmpdir(), ProcessRunnerTests.LIMIT);

    Assert.areEqual("2|given|err", [result.exitCode, result.output, result.errorOutput].join("|"));
    Assert.areEqual("none", inherited.output);
  }

  @TestMethod
  public async passesVerbatimArgumentsUnquotedOnWindowsAndRequiresTheirSuccess(): Promise<void> {
    const script = "process.stdout.write(process.argv.slice(1).join('|'))";
    const runner = new ProcessRunner();

    const verbatim = await runner.captureAsync(process.execPath, ["-e", script, "_?=a b"], tmpdir(), ProcessRunnerTests.LIMIT, undefined, true);
    const quoted = await runner.captureAsync(process.execPath, ["-e", script, "_?=a b"], tmpdir(), ProcessRunnerTests.LIMIT);
    await runner.requireAsync(process.execPath, ["-e", "process.exit(0)"], tmpdir(), ProcessRunnerTests.LIMIT, undefined, true);

    Assert.areEqual(process.platform === "win32" ? "_?=a|b" : "_?=a b", verbatim.output);
    Assert.areEqual("_?=a b", quoted.output);
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

    Assert.areEqual(`"${process.execPath}" did not finish within 200 ms. It wrote nothing before it was stopped.`, error.message);
    Assert.isTrue(Number.isInteger(error.processId) && (error.processId ?? 0) > 0, String(error.processId));
  }

  @TestMethod
  public async stopsARunOrWatchedProcessThatRunsPastItsTimeoutAndAnswersOneThatEndsInTime(): Promise<void> {
    const runner = new ProcessRunner();
    const hang = ["-e", "setInterval(() => undefined, 1000)"];

    const run = await Assert.throwsAsync(() => runner.runAsync(process.execPath, hang, tmpdir(), undefined, undefined, 200), ProcessTimeoutException);
    const watched = await Assert.throwsAsync(() => runner.runAsync(process.execPath, hang, tmpdir(), undefined, () => undefined, 200), ProcessTimeoutException);
    const exitCode = await runner.runAsync(process.execPath, ["-e", "process.exit(6)"], tmpdir(), undefined, () => undefined, ProcessRunnerTests.LIMIT);

    for (const error of [run, watched])
      Assert.areEqual(`"${process.execPath}" did not finish within 200 ms.`, error.message);
    Assert.areEqual(6, exitCode);
  }

  @TestMethod
  public async stopsAWatchedProcessAtItsTimeoutWhileAChildItStartedStillHoldsItsOutput(): Promise<void> {
    const child = `console.log("child " + process.pid); setTimeout(() => undefined, ${ProcessRunnerTests.LIFETIME})`;
    const script = `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(child)}], { stdio: "inherit" }); setTimeout(() => undefined, ${ProcessRunnerTests.LIFETIME})`;
    let output = String.empty;
    let isTimedOut = false;
    const { promise: started, resolve: start } = Promise.withResolvers<void>();
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const running = new ProcessRunner().runAsync(process.execPath, ["-e", script], tmpdir(), undefined, t => {
        output += t;
        if (ProcessRunnerTests.CHILD.test(output))
          start();
      }, ProcessRunnerTests.LIMIT);
      void running.then(() => start(), () => start());
      const failure = Assert.throwsAsync(() => running, ProcessTimeoutException);
      await started;
      ProcessRunnerTests.passTheLimit();
      isTimedOut = true;
      const error = await failure;

      Assert.areEqual(`"${process.execPath}" did not finish within ${ProcessRunnerTests.LIMIT} ms.`, error.message);
      Assert.isTrue(ProcessRunnerTests.CHILD.test(output), output);
      Assert.isFalse(new ProcessRunner().isRunning(Number(ProcessRunnerTests.CHILD.exec(output)?.[1])), "The child still runs after the timeout.");
    }
    finally {
      if (!isTimedOut)
        ProcessRunnerTests.passTheLimit();
      const id = ProcessRunnerTests.CHILD.exec(output)?.[1];
      if (!Object.isUndefined(id))
        new ProcessRunner().kill(Number(id));
    }
  }

  @TestMethod
  public async settlesARunWithTheFailureToEndItsTree(): Promise<void> {
    const runner = new ProcessRunner(new RefusingProcessTreeFixture());
    const hang = ["-e", `setTimeout(() => undefined, ${ProcessRunnerTests.REFUSED_LIFETIME})`];

    const captured = await Assert.throwsAsync(() => runner.captureAsync(process.execPath, hang, tmpdir(), 200), BuildException);
    const run = await Assert.throwsAsync(() => runner.runAsync(process.execPath, hang, tmpdir(), undefined, undefined, 200), BuildException);

    for (const error of [captured, run]) {
      Assert.areEqual(Resources.formatProcessTreeNotEnded(process.execPath), error.message);
      Assert.areEqual(RefusingProcessTreeFixture.MESSAGE, error.cause instanceof Error ? error.cause.message : null);
    }
  }

  @TestMethod
  public async refusesAProgramThatCannotStart(): Promise<void> {
    const runner = new ProcessRunner();
    const folder = await mkdtemp(path.join(tmpdir(), "process-runner-"));
    try {
      const captured = await Assert.throwsAsync(() => runner.captureAsync(ProcessRunnerTests.MISSING, [], folder, ProcessRunnerTests.LIMIT), BuildException);
      const run = await Assert.throwsAsync(() => runner.runAsync(ProcessRunnerTests.MISSING, [], folder), BuildException);
      const watched = await Assert.throwsAsync(() => runner.runAsync(ProcessRunnerTests.MISSING, [], folder, process.env, () => undefined, ProcessRunnerTests.LIMIT),
        BuildException);
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

  private static passTheLimit(): void {
    mock.timers.tick(ProcessRunnerTests.LIMIT);
    mock.timers.reset();
  }

  @TestMethod
  public passesOnAFailureToSignalOtherThanAMissingProcess(): void {
    Assert.throws(() => new ProcessRunner().isRunning(Number.NaN), Error);
  }
}

@TestClass
@Category("Packaging")
export class ProcessRunnerGrandchildTests {
  private static readonly LIMIT: number = 30_000;
  private static readonly LIFETIME: number = 20_000;
  private static readonly GRANDCHILD_LIFETIME: number = 60_000;

  @TestMethod
  public async stopsACapturedProcessAndTheGrandchildHoldingItsOutputAtItsTimeout(): Promise<void> {
    await ProcessRunnerGrandchildTests.stopsAGrandchildHoldingTheOutputAsync(false);
  }

  @TestMethod
  public async stopsACapturedProcessWhoseChildEndedWhileAGrandchildStillHoldsItsOutput(): Promise<void> {
    await ProcessRunnerGrandchildTests.stopsAGrandchildHoldingTheOutputAsync(true);
  }

  private static async stopsAGrandchildHoldingTheOutputAsync(isChildEnded: boolean): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "process-runner-"));
    const started = path.join(folder, "grandchild.pid");
    const ended = path.join(folder, "child.pid");
    const grandchild = `require("node:fs").writeFileSync(${JSON.stringify(started)}, String(process.pid)); setTimeout(() => undefined, ${ProcessRunnerGrandchildTests.GRANDCHILD_LIFETIME})`;
    const childRest = isChildEnded
      ? `require("node:fs").writeFileSync(${JSON.stringify(ended)}, String(process.pid)); process.exit(0)`
      : `setTimeout(() => undefined, ${ProcessRunnerGrandchildTests.GRANDCHILD_LIFETIME})`;
    const isDetached = isChildEnded && process.platform === "win32";
    const child = `require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(grandchild)}], { detached: ${String(isDetached)}, stdio: ["ignore", "inherit", "inherit"] }); ${childRest}`;
    let isTimedOut = false;
    let id = 0;
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const failure = Assert.throwsAsync(() => new ProcessRunner().captureAsync(process.execPath, ["-e", child], folder, ProcessRunnerGrandchildTests.LIMIT),
        ProcessTimeoutException);
      id = await ProcessRunnerGrandchildTests.readIdAsync(started);
      if (isChildEnded)
        await ProcessRunnerGrandchildTests.waitUntilEndedAsync(await ProcessRunnerGrandchildTests.readIdAsync(ended));
      ProcessRunnerGrandchildTests.passTheLimit();
      isTimedOut = true;
      const error = await failure;

      Assert.areEqual(ProcessRunnerGrandchildTests.LIMIT, error.timeout);
      Assert.isTrue(id > 0, "The grandchild never started, so nothing held the output.");
      Assert.isFalse(new ProcessRunner().isRunning(id), "The grandchild still runs after the timeout.");
    }
    finally {
      if (!isTimedOut)
        ProcessRunnerGrandchildTests.passTheLimit();
      if (id > 0 && new ProcessRunner().isRunning(id))
        new ProcessRunner().kill(id);
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  private static async readIdAsync(file: string): Promise<number> {
    const deadline = performance.now() + ProcessRunnerGrandchildTests.LIFETIME;
    let text = String.empty;
    while (text.length === 0 && performance.now() < deadline) {
      await new Promise<void>(resolve => setImmediate(resolve));
      text = existsSync(file) ? readFileSync(file, "utf8") : String.empty;
    }
    return Number(text);
  }

  private static async waitUntilEndedAsync(processId: number): Promise<void> {
    const deadline = performance.now() + ProcessRunnerGrandchildTests.LIFETIME;
    while (processId > 0 && new ProcessRunner().isRunning(processId) && performance.now() < deadline)
      await new Promise<void>(resolve => setImmediate(resolve));
    Assert.isFalse(processId > 0 && new ProcessRunner().isRunning(processId), "The child never ended.");
  }

  private static passTheLimit(): void {
    mock.timers.tick(ProcessRunnerGrandchildTests.LIMIT);
    mock.timers.reset();
  }
}
