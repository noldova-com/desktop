/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import "@noldova/context.core";

import { RecordedTestRun } from "../recorded-test-run.ts";

const IDENTITY = "Hanging/hanging.test.js › HangingTests.fails";
const FILE = "Hanging/hanging.test.js";
const FAILURE = "Error: failed";
const FAILED = [{ identity: IDENTITY, file: FILE, failure: FAILURE }];

const record = (isComplete: boolean, failed: readonly object[], runFailures: readonly string[]): RecordedTestRun =>
  RecordedTestRun.parse(JSON.stringify({ isComplete, failed, runFailures }));

describe("RecordedTestRun", () => {
  it("reads each failed test and lets a complete run with failed tests and no failure of its own run again", () => {
    const run = record(true, FAILED, []);

    assert.deepEqual(run.failed.map(t => `${t.identity}|${t.file}|${t.failure}`), [`${IDENTITY}|${FILE}|${FAILURE}`]);
    assert.equal(run.isRerunnable, true);
  });

  it("refuses to run again a run whose release or temporary folder failed, so a rerun can't hide that failure", () => {
    const run = record(true, FAILED, ["Tests finished but a release a test left to the run's end failed: Error: busy. Failing the run.\n"]);

    assert.equal(run.isRerunnable, false);
    assert.equal(run.runFailures.length, 1);
  });

  it("refuses to run again an incomplete run or one without a failed test", () => {
    assert.equal(record(false, FAILED, []).isRerunnable, false);
    assert.equal(record(true, [], []).isRerunnable, false);
  });
});
