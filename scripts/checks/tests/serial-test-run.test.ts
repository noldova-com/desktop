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

interface SerialTestRunOutcome {
  readonly code: unknown;
  readonly output: string;
  readonly errors: string;
}

const runAsync = async (source: string): Promise<SerialTestRunOutcome> => {
  await mkdir(path.join(ROOT, "_build"), { recursive: true });
  const folder = await mkdtemp(path.join(ROOT, "_build", "serial-test-run-"));
  const tests = path.join(folder, "tests");
  const temporary = path.join(folder, "temporary");
  try {
    await mkdir(tests);
    await mkdir(temporary);
    await writeFile(path.join(tests, "hanging.test.js"), source);
    const environment: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      [Resources.serialTestFiltersVariable]: "[]",
      [Resources.serialTestTimeoutVariable]: "200",
      [Resources.serialTestTemporaryRootVariable]: temporary
    };
    if (!Object.isUndefined(process.env.SystemRoot))
      environment.SystemRoot = process.env.SystemRoot;
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
});
