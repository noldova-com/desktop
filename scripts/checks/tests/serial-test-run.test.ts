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
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

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

interface ISerialTestRunOutcome {
  readonly code: unknown;
  readonly output: string;
  readonly errors: string;
}

const runAsync = async (source: string, variables: Readonly<Record<string, string>> = {}): Promise<ISerialTestRunOutcome> => {
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
      return { code, output, errors };
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

  it("prints each suite's slowest tests under its limit after the summary", async () => {
    const { code, output, errors } = await runAsync(PASSING_SUITES, { [Resources.serialTestPackagingTimeoutVariable]: "300" });

    assert.equal(code, 0, errors);
    assert.match(output, /Passed:\s+2\b[\s\S]*General suite, limit 200 ms:\nSlowest tests:\n {2}\d+ ms {2}Hanging\/hanging\.test\.js — OtherTests\.passes\nPackaging suite, limit 300 ms:\nSlowest tests:\n {2}\d+ ms {2}Hanging\/hanging\.test\.js — PackagingTests\.packages\n/u);
  });
});
