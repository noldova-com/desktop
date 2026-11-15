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

import type { IReportedTest } from "../interfaces/i-reported-test.ts";
import { TestHangGuard } from "../test-hang-guard.ts";

const test = (file: string, fullName: string): IReportedTest => ({ module: { relativeModuleId: file }, fullName });

const watch = (limit: number): { guard: TestHangGuard; reporters: unknown[]; errors: string[]; ended: Promise<void> } => {
  const reporters: unknown[] = [];
  const errors: string[] = [];
  let end: () => void = () => undefined;
  const ended = new Promise<void>(resolve => {
    end = resolve;
  });
  const guard = new TestHangGuard(limit, () => end());
  guard.configureVitest({ vitest: { config: { reporters }, logger: { error: message => errors.push(message) } } });
  return { guard, reporters, errors, ended };
};

describe("TestHangGuard", () => {
  it("adds itself to the run's reporters, with a limit of 60 s, twice Vitest's 30 s browser hook limit", () => {
    const { guard, reporters } = watch(TestHangGuard.LIMIT_MILLISECONDS);

    assert.deepEqual(reporters, [guard]);
    assert.equal(TestHangGuard.LIMIT_MILLISECONDS, 60_000);
  });

  it("names the test a file was running when it reported nothing within the limit, and ends the run", async () => {
    const { guard, errors, ended } = watch(1);

    guard.onTestModuleStart({ relativeModuleId: "tests/a.spec.ts" });
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > opens"));
    guard.onTestCaseResult(test("tests/a.spec.ts", "A > opens"));
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > closes"));
    await ended;

    assert.deepEqual(errors, ["The Angular tests stopped: tests/a.spec.ts reported nothing for 0.001 s while its test \"A > closes\" ran, past Vitest's own limits."]);
  });

  it("names the last finished test when a file stops between its tests or at its end", async () => {
    const { guard, errors, ended } = watch(1);

    guard.onTestModuleStart({ relativeModuleId: "tests/a.spec.ts" });
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > opens"));
    guard.onTestCaseResult(test("tests/a.spec.ts", "A > opens"));
    await ended;

    assert.deepEqual(errors, ["The Angular tests stopped: tests/a.spec.ts reported nothing for 0.001 s after its test \"A > opens\" finished: in an afterAll hook, the next test's start, or the file's end, where the browser cleans up and hands over its coverage."]);
  });

  it("says a file stopped before its first test when it ran none", async () => {
    const { guard, errors, ended } = watch(1);

    guard.onTestModuleStart({ relativeModuleId: "tests/a.spec.ts" });
    await ended;

    assert.deepEqual(errors, ["The Angular tests stopped: tests/a.spec.ts reported nothing for 0.001 s before its first test: while it loaded, collected its tests or ran a beforeAll hook."]);
  });

  it("stops watching a file once it ends, and every file once the run ends", async () => {
    const { guard, errors, ended } = watch(1);

    guard.onTestModuleStart({ relativeModuleId: "tests/a.spec.ts" });
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > opens"));
    guard.onTestModuleEnd({ relativeModuleId: "tests/a.spec.ts" });
    guard.onTestModuleStart({ relativeModuleId: "tests/b.spec.ts" });
    guard.onTestRunEnd();
    guard.onTestModuleStart({ relativeModuleId: "tests/c.spec.ts" });
    await ended;

    assert.deepEqual(errors, ["The Angular tests stopped: tests/c.spec.ts reported nothing for 0.001 s before its first test: while it loaded, collected its tests or ran a beforeAll hook."]);
  });
});
