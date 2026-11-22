/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import { RecordedTestRun } from "../recorded-test-run.ts";
import { SerialTestRunOutcomeFixture } from "../../tests/fixtures/serial-test-run-outcome.fixture.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

const HANGING = [
  "import \"@noldova/context.core\";",
  "import { TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class HangingTests {",
  "  waitsForATimerThatNeverFires() {",
  "    return new Promise(resolve => setTimeout(resolve, 600_000));",
  "  }",
  "  wouldRunNext() {",
  "  }",
  "}",
  "TestMethod(HangingTests.prototype.waitsForATimerThatNeverFires);",
  "TestMethod(HangingTests.prototype.wouldRunNext);",
  "TestClass(HangingTests);"
].join("\n");

const HANGING_IN_A_STEP = [
  "import \"@noldova/context.core\";",
  "import { channel } from \"node:diagnostics_channel\";",
  "import { TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class SteppingTests {",
  "  hangsInItsSecondStep() {",
  `    channel(${JSON.stringify(Resources.serialTestStepStartedChannel)}).publish("copying");`,
  `    channel(${JSON.stringify(Resources.serialTestStepEndedChannel)}).publish("copying");`,
  `    channel(${JSON.stringify(Resources.serialTestStepStartedChannel)}).publish("checking");`,
  "    return new Promise(resolve => setTimeout(resolve, 600_000));",
  "  }",
  "}",
  "TestMethod(SteppingTests.prototype.hangsInItsSecondStep);",
  "TestClass(SteppingTests);"
].join("\n");

const HANGING_AFTER_ITS_STEPS = [
  "import \"@noldova/context.core\";",
  "import { channel } from \"node:diagnostics_channel\";",
  "import { TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class SteppingTests {",
  "  hangsAfterItsLastStep() {",
  `    channel(${JSON.stringify(Resources.serialTestStepStartedChannel)}).publish("copying");`,
  `    channel(${JSON.stringify(Resources.serialTestStepEndedChannel)}).publish("copying");`,
  "    return new Promise(resolve => setTimeout(resolve, 600_000));",
  "  }",
  "}",
  "TestMethod(SteppingTests.prototype.hangsAfterItsLastStep);",
  "TestClass(SteppingTests);"
].join("\n");

const HANGING_LAST = [
  "import \"@noldova/context.core\";",
  "import { TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class HangingLastTests {",
  "  passesFirst() {",
  "  }",
  "  waitsForATimerThatNeverFires() {",
  "    return new Promise(resolve => setTimeout(resolve, 600_000));",
  "  }",
  "}",
  "TestMethod(HangingLastTests.prototype.passesFirst);",
  "TestMethod(HangingLastTests.prototype.waitsForATimerThatNeverFires);",
  "TestClass(HangingLastTests);"
].join("\n");

const HANGING_PACKAGING = [
  "import \"@noldova/context.core\";",
  "import { Category, TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class PackagingTests {",
  "  waitsForATimerThatNeverFires() {",
  "    return new Promise(resolve => setTimeout(resolve, 600_000));",
  "  }",
  "}",
  "export class OtherTests {",
  "  passes() {",
  "  }",
  "}",
  "TestMethod(PackagingTests.prototype.waitsForATimerThatNeverFires);",
  "Category(\"Packaging\")(PackagingTests);",
  "TestClass(PackagingTests);",
  "TestMethod(OtherTests.prototype.passes);",
  "TestClass(OtherTests);"
].join("\n");

const HANGING_PACKAGING_WITH_ITS_OWN_LIMIT = [
  "import \"@noldova/context.core\";",
  "import { Category, TestClass, TestMethod, Timeout } from \"@noldova/context.testing\";",
  "export class PackagingTests {",
  "  waitsForATimerThatNeverFires() {",
  "    return new Promise(resolve => setTimeout(resolve, 600_000));",
  "  }",
  "}",
  "Timeout(250)(PackagingTests.prototype.waitsForATimerThatNeverFires);",
  "TestMethod(PackagingTests.prototype.waitsForATimerThatNeverFires);",
  "Category(\"Packaging\")(PackagingTests);",
  "TestClass(PackagingTests);"
].join("\n");

const PASSING_SUITES = [
  "import \"@noldova/context.core\";",
  "import { Category, TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class PackagingTests {",
  "  packages() {",
  "  }",
  "}",
  "export class OtherTests {",
  "  passes() {",
  "  }",
  "}",
  "TestMethod(PackagingTests.prototype.packages);",
  "Category(\"Packaging\")(PackagingTests);",
  "TestClass(PackagingTests);",
  "TestMethod(OtherTests.prototype.passes);",
  "TestClass(OtherTests);"
].join("\n");

const REJECTING_DURING_PACKAGING = [
  "import \"@noldova/context.core\";",
  "import { Category, TestClass, TestMethod } from \"@noldova/context.testing\";",
  "let open = () => {};",
  "const gate = new Promise(resolve => {",
  "  open = resolve;",
  "});",
  "export class PackagingTests {",
  "  async opensTheGateTheOtherTestWaitsOn() {",
  "    open();",
  "    await new Promise(resolve => setImmediate(resolve));",
  "  }",
  "}",
  "export class OtherTests {",
  "  leavesWorkThatRejectsLater() {",
  "    gate.then(() => {",
  "      throw new Error(\"The general test's work failed late\");",
  "    });",
  "  }",
  "}",
  "TestMethod(PackagingTests.prototype.opensTheGateTheOtherTestWaitsOn);",
  "Category(\"Packaging\")(PackagingTests);",
  "TestClass(PackagingTests);",
  "TestMethod(OtherTests.prototype.leavesWorkThatRejectsLater);",
  "TestClass(OtherTests);"
].join("\n");

const LOCKING = (hangs: boolean, leaves: boolean = true): string => [
  "import \"@noldova/context.core\";",
  "import fs from \"node:fs\";",
  "import { syncBuiltinESMExports } from \"node:module\";",
  "import os from \"node:os\";",
  "import path from \"node:path\";",
  "import { TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class LockingTests {",
  "  holdsItsFolder() {",
  leaves ? "    fs.writeFileSync(path.join(os.tmpdir(), \"builder.lock\"), \"\");" : String.empty,
  "    fs.rmSync = () => {",
  "      throw Object.assign(new Error(\"EBUSY: resource busy or locked\"), { code: \"EBUSY\" });",
  "    };",
  "    syncBuiltinESMExports();",
  hangs ? "    return new Promise(resolve => setTimeout(resolve, 600_000));" : String.empty,
  "  }",
  "}",
  "TestMethod(LockingTests.prototype.holdsItsFolder);",
  "TestClass(LockingTests);"
].join("\n");

const MOUNTING = [
  "import \"@noldova/context.core\";",
  "import fs from \"node:fs\";",
  "import { syncBuiltinESMExports } from \"node:module\";",
  "import os from \"node:os\";",
  "import path from \"node:path\";",
  "import { TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class MountingTests {",
  "  leavesAVolumeMounted() {",
  "    const volume = path.join(os.tmpdir(), \"mounted-volume\");",
  "    fs.mkdirSync(path.join(volume, \"discovery\"), { recursive: true });",
  "    fs.mkdirSync(path.join(os.tmpdir(), \"emptied\", \"nested\"), { recursive: true });",
  "    fs.writeFileSync(path.join(os.tmpdir(), \"emptied\", \"nested\", \"file\"), \"\");",
  "    const { lstatSync, rmSync } = fs;",
  "    fs.lstatSync = (item, ...rest) => {",
  "      const stats = lstatSync(item, ...rest);",
  "      if (path.basename(String(item)) === \"mounted-volume\")",
  "        stats.dev += 1;",
  "      return stats;",
  "    };",
  "    fs.rmSync = (item, ...rest) => {",
  "      if (String(item).includes(\"mounted-volume\"))",
  "        throw new Error(\"The removal entered the volume.\");",
  "      return rmSync(item, ...rest);",
  "    };",
  "    syncBuiltinESMExports();",
  "  }",
  "}",
  "TestMethod(MountingTests.prototype.leavesAVolumeMounted);",
  "TestClass(MountingTests);"
].join("\n");

const RELEASING = (fails: boolean): string => [
  "import \"@noldova/context.core\";",
  "import { channel } from \"node:diagnostics_channel\";",
  "import fs from \"node:fs\";",
  "import os from \"node:os\";",
  "import path from \"node:path\";",
  "import { setTimeout } from \"node:timers/promises\";",
  "import { TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class ReleasingTests {",
  "  leavesItsReleaseToTheRunsEnd() {",
  "    const image = path.join(os.tmpdir(), \"held-image\");",
  "    fs.writeFileSync(image, \"\");",
  `    channel(${JSON.stringify(Resources.serialTestReleaseChannel)}).publish(setTimeout(500).then(() => {`,
  fails ? "      throw new Error(\"The image stayed busy\");" : "      fs.rmSync(image);",
  "    }));",
  "  }",
  "}",
  "TestMethod(ReleasingTests.prototype.leavesItsReleaseToTheRunsEnd);",
  "TestClass(ReleasingTests);"
].join("\n");

const FAILING = [
  "import \"@noldova/context.core\";",
  "import { Assert, TestClass, TestMethod } from \"@noldova/context.testing\";",
  "export class FailingTests {",
  "  failsAnAssertion() {",
  "    Assert.areEqual(1, 2);",
  "  }",
  "  throwsADatabaseError() {",
  "    throw Object.assign(new Error(\"disk I/O error\"), { code: \"ERR_SQLITE_ERROR\", errcode: 266, errstr: \"disk I/O error\" });",
  "  }",
  "}",
  "TestMethod(FailingTests.prototype.failsAnAssertion);",
  "TestMethod(FailingTests.prototype.throwsADatabaseError);",
  "TestClass(FailingTests);"
].join("\n");

const runAsync = async (source: string, variables: Readonly<Record<string, string>> = {}): Promise<SerialTestRunOutcomeFixture> => {
  await mkdir(path.join(ROOT, "_build"), { recursive: true });
  const folder = await mkdtemp(path.join(ROOT, "_build", "serial-test-run-"));
  const tests = path.join(folder, "tests");
  const temporary = path.join(folder, "temporary");
  try {
    await mkdir(tests);
    await mkdir(temporary);
    await writeFile(path.join(tests, "hanging.test.js"), source);
    const environment: NodeJS.ProcessEnv = {
      PATH: process.env["PATH"],
      [Resources.serialTestFiltersVariable]: "[]",
      [Resources.serialTestTimeoutVariable]: "200",
      [Resources.serialTestTemporaryRootVariable]: temporary,
      ...variables
    };
    if (!Object.isUndefined(process.env["SystemRoot"]))
      environment["SystemRoot"] = process.env["SystemRoot"];
    const run = spawn(process.execPath, [path.join(ROOT, "scripts", "checks", "serial-test-run.ts"), "Hanging", tests], { cwd: ROOT, env: environment });
    const closed = once(run, "close");
    try {
      let errors = String.empty;
      let output = String.empty;
      run.stderr.setEncoding(Resources.encoding).on("data", (t: string) => {
        errors += t;
      });
      run.stdout.setEncoding(Resources.encoding).on("data", (t: string) => {
        output += t;
      });
      const [code] = await closed;
      const runs = await readdir(temporary);
      const left = (await Promise.all(runs.map(t => readdir(path.join(temporary, t), { recursive: true })))).flat().sort();
      return new SerialTestRunOutcomeFixture(code, output, errors, left);
    }
    finally {
      run.kill();
      await closed;
    }
  }
  finally {
    await rm(folder, { recursive: true, force: true });
  }
};

describe("SerialTestRun", () => {
  it("names the test that reaches its time limit, its limit and what it was waiting on, and reports it as failed though its class never completed", async () => {
    const { code, output, errors } = await runAsync(HANGING);

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(output, /waitsForATimerThatNeverFires/u);
    assert.doesNotMatch(output, /wouldRunNext/u);
    assert.match(output, /Failed:\s+1\b/u);
    assert.match(errors, /The test Hanging\/hanging\.test\.js › HangingTests\.waitsForATimerThatNeverFires exceeded its time limit of 200 ms while waiting on [^;]*\bTimeout\b[^;]*;/u);
  });

  it("names the step a test was still in when it reached its time limit, and how long each earlier step took", async () => {
    const { code, errors } = await runAsync(HANGING_IN_A_STEP);

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(errors, /SteppingTests\.hangsInItsSecondStep exceeded its time limit of 200 ms while waiting on [^;]*; its steps: copying \d+ ms, checking still running after (\d+) ms; the run ended/u);
    assert.ok(Number(/checking still running after (\d+) ms/u.exec(errors)?.[1] ?? 0) >= 150, errors);
  });

  it("says no step was running when a test reached its time limit after its last step ended, and how long after", async () => {
    const { code, errors } = await runAsync(HANGING_AFTER_ITS_STEPS);

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(errors, /SteppingTests\.hangsAfterItsLastStep exceeded its time limit of 200 ms while waiting on [^;]*; its steps: copying \d+ ms, no step running, (\d+) ms after copying ended; the run ended/u);
    assert.ok(Number(/no step running, (\d+) ms after/u.exec(errors)?.[1] ?? 0) >= 150, errors);
  });

  it("names a test that reaches its time limit as its class's last method and counts its class once", async () => {
    const { code, output, errors } = await runAsync(HANGING_LAST);

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(output, /Passed:\s+1\b/u);
    assert.match(output, /Failed:\s+1\b/u);
    assert.match(errors, /The test Hanging\/hanging\.test\.js › HangingLastTests\.waitsForATimerThatNeverFires exceeded its time limit of 200 ms while waiting on [^;]*\bTimeout\b[^;]*;/u);
  });

  it("runs the Packaging category after the other tests, as its own suite under its own limit", async () => {
    const { code, output, errors } = await runAsync(HANGING_PACKAGING, { [Resources.serialTestPackagingTimeoutVariable]: "300" });

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(output, /Passed:\s+1\b/u);
    assert.match(output, /Failed:\s+1\b/u);
    assert.match(errors, /The test Hanging\/hanging\.test\.js › PackagingTests\.waitsForATimerThatNeverFires exceeded its time limit of 300 ms while waiting on [^;]*\bTimeout\b[^;]*;/u);
    assert.match(output, /General suite, limit 200 ms:\nSlowest tests:\n {2}\d+ ms {2}Hanging\/hanging\.test\.js — OtherTests\.passes\n/u);
    assert.match(output, /Packaging suite, limit 300 ms:\nSlowest tests:\n {2}\d+ ms {2}Hanging\/hanging\.test\.js — PackagingTests\.waitsForATimerThatNeverFires\n/u);
  });

  it("keeps a Packaging test's own time limit over the Packaging suite's", async () => {
    const { code, output, errors } = await runAsync(HANGING_PACKAGING_WITH_ITS_OWN_LIMIT, { [Resources.serialTestPackagingTimeoutVariable]: "300" });

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(errors, /The test Hanging\/hanging\.test\.js › PackagingTests\.waitsForATimerThatNeverFires exceeded its time limit of 250 ms while waiting on [^;]*\bTimeout\b[^;]*;/u);
    assert.match(output, /Packaging suite, limit 300 ms:\nSlowest tests:\n {2}\d+ ms {2}Hanging\/hanging\.test\.js — PackagingTests\.waitsForATimerThatNeverFires\n/u);
  });

  it("fails the run, naming the test, when a general test's promise rejects unhandled while a Packaging class runs", async () => {
    const { code, errors } = await runAsync(REJECTING_DURING_PACKAGING, { [Resources.serialTestPackagingTimeoutVariable]: "300" });

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(errors, /leavesWorkThatRejectsLater left a promise that rejected after the test ended, unhandled;/u);
  });

  it("names the test that reaches its time limit though the run's temporary folder can't be removed while it holds it", async () => {
    const { code, errors } = await runAsync(LOCKING(true));

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(errors, /The test Hanging\/hanging\.test\.js › LockingTests\.holdsItsFolder exceeded its time limit of 200 ms while waiting on [^;]*\bTimeout\b[^;]*;/u);
    assert.doesNotMatch(errors, /EBUSY/u);
  });

  it("fails the run, naming what is left, when the run's temporary folder can't be removed", async () => {
    const { code, errors } = await runAsync(LOCKING(false));

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(errors, /Tests finished but left builder\.lock in the run's temporary folder;/u);
    assert.doesNotMatch(errors, /EBUSY/u);
  });

  it("fails the run, naming the folder and the error, when the run's temporary folder is empty but can't be removed", async () => {
    const { code, errors } = await runAsync(LOCKING(false, false));

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(errors, /Tests finished but the run's temporary folder could not be removed: Error: EBUSY: resource busy or locked\. Failing the run\.\n/u);
    assert.doesNotMatch(errors, /Tests finished but left /u);
  });

  it("fails the run, naming a folder on another file system that it left without entering, and removes the rest", async () => {
    const { code, errors, left } = await runAsync(MOUNTING);

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(errors, /Tests finished but left emptied, mounted-volume in the run's temporary folder; a test must remove what it creates\. The run left unremoved, without entering them, what is on another file system, such as a volume still mounted: .+mounted-volume\. Failing the run\.\n/u);
    assert.deepEqual(left, ["mounted-volume", path.join("mounted-volume", "discovery")]);
  });

  it("waits for a release a test left to the run's end before it checks the run's temporary folder", async () => {
    const { code, output, errors, left } = await runAsync(RELEASING(false));

    assert.equal(code, 0, errors);
    assert.match(output, /Passed:\s+1\b/u);
    assert.deepEqual(left, []);
  });

  it("fails the run, naming the error, when a release a test left to the run's end fails", async () => {
    const { code, output, errors } = await runAsync(RELEASING(true));

    assert.equal(code, Resources.failedExitCode, errors);
    assert.match(output, /Passed:\s+1\b/u);
    assert.match(errors, /Tests finished but a release a test left to the run's end failed: Error: The image stayed busy\. Failing the run\.\n/u);
    assert.match(errors, /Tests finished but left held-image in the run's temporary folder;/u);
  });

  it("records a failed release and what the run left in its results file, so a rerun of the failed tests can't hide them", async () => {
    await mkdir(path.join(ROOT, "_build"), { recursive: true });
    const folder = await mkdtemp(path.join(ROOT, "_build", "serial-test-results-"));
    try {
      const results = path.join(folder, "results.json");
      const { code, errors } = await runAsync(RELEASING(true), { [Resources.serialTestResultsFileVariable]: results });
      const recorded = RecordedTestRun.parse(await readFile(results, Resources.encoding));

      assert.equal(code, Resources.failedExitCode, errors);
      assert.equal(recorded.runFailures.length, 2);
      assert.match(recorded.runFailures.join(String.empty), /^Tests finished but a release a test left to the run's end failed: Error: The image stayed busy\.[^\n]*\nTests finished but left held-image in the run's temporary folder;/u);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

  it("prints after the summary the stack and fields of each error a test threw, but not of a failed assertion", async () => {
    const { code, output } = await runAsync(FAILING);

    assert.equal(code, Resources.failedExitCode);
    assert.match(output, /Failed:\s+2\b[\s\S]*\nHanging\/hanging\.test\.js — FailingTests\.throwsADatabaseError failed with:\nError: disk I\/O error\n {4}at FailingTests\.throwsADatabaseError \([^\n]*hanging\.test\.js:8:\d+\)\n[\s\S]*errcode: 266,[\s\S]*\nGeneral suite, limit 200 ms:/u);
    assert.doesNotMatch(output, /failsAnAssertion failed with/u);
  });

  it("prints each suite's slowest tests under its limit after the summary", async () => {
    const { code, output, errors } = await runAsync(PASSING_SUITES, { [Resources.serialTestPackagingTimeoutVariable]: "300" });

    assert.equal(code, 0, errors);
    assert.match(output, /Passed:\s+2\b[\s\S]*General suite, limit 200 ms:\nSlowest tests:\n {2}\d+ ms {2}Hanging\/hanging\.test\.js — OtherTests\.passes\nPackaging suite, limit 300 ms:\nSlowest tests:\n {2}\d+ ms {2}Hanging\/hanging\.test\.js — PackagingTests\.packages\n/u);
  });
});
