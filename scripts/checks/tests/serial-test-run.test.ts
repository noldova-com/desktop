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

describe("SerialTestRun", () => {
  it("names the test that reaches its time limit, its limit and what it was waiting on, and reports it as failed though its class never completed", async () => {
    await mkdir(path.join(ROOT, "_build"), { recursive: true });
    const folder = await mkdtemp(path.join(ROOT, "_build", "serial-test-run-"));
    try {
      await writeFile(path.join(folder, "hanging.test.js"), HANGING);
      const environment: NodeJS.ProcessEnv = { ...process.env, [Resources.serialTestFiltersVariable]: "[]", [Resources.serialTestTimeoutVariable]: "200" };
      for (const variable of [Resources.summaryVariable, Resources.serialTestGroupVariable, Resources.serialTestPartsVariable, Resources.serialTestResultFileVariable,
        Resources.serialTestResultsFileVariable, Resources.serialTestNodeCoverageVariable])
        delete environment[variable];
      const run = spawn(process.execPath, [path.join(ROOT, "scripts", "checks", "serial-test-run.ts"), "Hanging", folder], { cwd: ROOT, env: environment });
      let errors = String.empty;
      let output = String.empty;
      run.stderr.setEncoding(Resources.encoding).on("data", (t: string) => {
        errors += t;
      });
      run.stdout.setEncoding(Resources.encoding).on("data", (t: string) => {
        output += t;
      });

      const [code] = await once(run, "close");

      assert.equal(code, Resources.failedExitCode, errors);
      assert.match(output, /waitsForATimerThatNeverFires/u);
      assert.doesNotMatch(output, /wouldRunNext/u);
      assert.match(output, /Failed:\s+1\b/u);
      assert.match(errors, /The test Hanging\/hanging\.test\.js › HangingTests\.waitsForATimerThatNeverFires exceeded its time limit of 200 ms while waiting on [^;]*\bTimeout\b[^;]*;/u);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
