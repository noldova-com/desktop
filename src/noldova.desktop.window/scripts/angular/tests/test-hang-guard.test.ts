/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import "@noldova/context.core";

import type { IReportedModule } from "../interfaces/i-reported-module.ts";
import type { IReportedTest } from "../interfaces/i-reported-test.ts";
import { TestHangGuard } from "../test-hang-guard.ts";

const LIMIT = TestHangGuard.LIMIT_MILLISECONDS;

const file = (relativeModuleId: string): IReportedModule => ({ relativeModuleId });

const test = (name: string, fullName: string): IReportedTest => ({ module: file(name), fullName });

const watch = (files: number = 2): { guard: TestHangGuard; reporters: unknown[]; errors: string[]; ends: () => number } => {
  const reporters: unknown[] = [];
  const errors: string[] = [];
  let ended = 0;
  const guard = new TestHangGuard(LIMIT, () => ended++);
  guard.configureVitest({ vitest: { config: { reporters }, logger: { error: message => errors.push(message) } } });
  guard.onTestRunStart(Array.from({ length: files }, (_, i) => `tests/${i}.spec.ts`));
  return { guard, reporters, errors, ends: () => ended };
};

describe("TestHangGuard", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));

  afterEach(() => mock.timers.reset());

  it("adds itself to the run's reporters, with a limit of 60 s, twice Vitest's 30 s browser hook limit", () => {
    const { guard, reporters } = watch();

    assert.deepEqual(reporters, [guard]);
    assert.equal(LIMIT, 60_000);
  });

  it("names the test a file was running when it reported nothing within the limit, and ends the run once", () => {
    const { guard, errors, ends } = watch();

    guard.onTestModuleQueued(file("tests/a.spec.ts"));
    guard.onTestModuleStart(file("tests/a.spec.ts"));
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > opens"));
    guard.onTestCaseResult(test("tests/a.spec.ts", "A > opens"));
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > closes"));
    mock.timers.tick(LIMIT - 1);
    const early = [...errors];
    mock.timers.tick(LIMIT);

    assert.deepEqual(early, []);
    assert.deepEqual(errors, ["The Angular tests stopped: tests/a.spec.ts reported nothing for 60 s while its test \"A > closes\" ran, past Vitest's own limits."]);
    assert.equal(ends(), 1);
  });

  it("names only the file that stalls while another keeps reporting, whose reports don't reset its watch", () => {
    const { guard, errors, ends } = watch();

    guard.onTestModuleQueued(file("tests/a.spec.ts"));
    guard.onTestModuleQueued(file("tests/b.spec.ts"));
    guard.onTestCaseReady(test("tests/b.spec.ts", "B > waits"));
    for (const name of ["A > one", "A > two", "A > three"]) {
      mock.timers.tick(LIMIT / 4);
      guard.onTestCaseReady(test("tests/a.spec.ts", name));
      guard.onTestCaseResult(test("tests/a.spec.ts", name));
    }
    mock.timers.tick(LIMIT / 4);

    assert.deepEqual(errors, ["The Angular tests stopped: tests/b.spec.ts reported nothing for 60 s while its test \"B > waits\" ran, past Vitest's own limits."]);
    assert.equal(ends(), 1);
  });

  it("lets a test's hooks and body each take most of the limit, and names a hook that runs past it", () => {
    const { guard, errors } = watch();
    const hook = (name: string): { name: string; entity: IReportedTest } => ({ name, entity: test("tests/a.spec.ts", "A > opens") });

    guard.onTestModuleStart(file("tests/a.spec.ts"));
    guard.onHookStart({ name: "beforeAll", entity: file("tests/a.spec.ts") });
    mock.timers.tick(LIMIT - 1);
    guard.onHookEnd({ name: "beforeAll", entity: file("tests/a.spec.ts") });
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > opens"));
    guard.onHookStart(hook("beforeEach"));
    mock.timers.tick(LIMIT - 1);
    guard.onHookEnd(hook("beforeEach"));
    mock.timers.tick(LIMIT - 1);
    guard.onHookStart(hook("afterEach"));
    mock.timers.tick(LIMIT - 1);
    guard.onHookEnd(hook("afterEach"));
    guard.onTestCaseResult(test("tests/a.spec.ts", "A > opens"));
    const early = [...errors];
    guard.onHookStart({ name: "afterAll", entity: { module: file("tests/a.spec.ts") } });
    mock.timers.tick(LIMIT);

    assert.deepEqual(early, []);
    assert.deepEqual(errors, ["The Angular tests stopped: tests/a.spec.ts reported nothing for 60 s in its afterAll hook, past Vitest's own limits."]);
  });

  it("names the last finished test when a file stops between its tests or at its end", () => {
    const { guard, errors } = watch();

    guard.onTestModuleStart(file("tests/a.spec.ts"));
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > opens"));
    guard.onTestCaseResult(test("tests/a.spec.ts", "A > opens"));
    mock.timers.tick(LIMIT);

    assert.deepEqual(errors, ["The Angular tests stopped: tests/a.spec.ts reported nothing for 60 s after its test \"A > opens\" finished: in the next test's start, or the file's end, where the browser cleans up and hands over its coverage."]);
  });

  it("names a file that stops while it loads or collects its tests", () => {
    const { guard, errors } = watch();

    guard.onTestModuleQueued(file("tests/a.spec.ts"));
    mock.timers.tick(LIMIT / 2);
    guard.onTestModuleCollected(file("tests/a.spec.ts"));
    mock.timers.tick(LIMIT);

    assert.deepEqual(errors, ["The Angular tests stopped: tests/a.spec.ts reported nothing for 60 s before its first test: while it loaded or collected its tests."]);
  });

  it("ignores what Vitest reports for a file after its end, from an update the browser sent before it", () => {
    const { guard, errors, ends } = watch();

    guard.onTestModuleStart(file("tests/a.spec.ts"));
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > opens"));
    guard.onTestModuleEnd(file("tests/a.spec.ts"));
    guard.onTestCaseResult(test("tests/a.spec.ts", "A > opens"));
    guard.onHookEnd({ name: "afterAll", entity: file("tests/a.spec.ts") });
    guard.onTestModuleStart(file("tests/b.spec.ts"));
    for (const name of ["B > one", "B > two", "B > three"]) {
      mock.timers.tick(LIMIT / 2);
      guard.onTestCaseReady(test("tests/b.spec.ts", name));
      guard.onTestCaseResult(test("tests/b.spec.ts", name));
    }
    guard.onTestModuleEnd(file("tests/b.spec.ts"));
    mock.timers.tick(LIMIT * 2);

    assert.deepEqual(errors, []);
    assert.equal(ends(), 0);
  });

  it("ends the run when Vitest reports nothing between files", () => {
    const { guard, errors, ends } = watch();

    guard.onTestModuleQueued(file("tests/a.spec.ts"));
    guard.onTestModuleStart(file("tests/a.spec.ts"));
    guard.onTestModuleEnd(file("tests/a.spec.ts"));
    mock.timers.tick(LIMIT - 1);
    const early = [...errors];
    mock.timers.tick(1);

    assert.deepEqual(early, []);
    assert.deepEqual(errors, ["The Angular tests stopped: Vitest reported nothing for 60 s between files, with every file that started ended."]);
    assert.equal(ends(), 1);
  });

  it("stops watching the run once its last file ends, so the coverage that follows without reports never ends it", () => {
    const { guard, errors, ends } = watch();

    for (const name of ["tests/a.spec.ts", "tests/b.spec.ts"]) {
      guard.onTestModuleQueued(file(name));
      guard.onTestModuleStart(file(name));
      guard.onTestCaseReady(test(name, "A > opens"));
      guard.onTestCaseResult(test(name, "A > opens"));
      guard.onTestModuleEnd(file(name));
    }
    mock.timers.tick(LIMIT * 2);

    assert.deepEqual(errors, []);
    assert.equal(ends(), 0);
  });

  it("watches nothing once the run ends", () => {
    const { guard, errors, ends } = watch();

    guard.onTestModuleQueued(file("tests/a.spec.ts"));
    guard.onTestCaseReady(test("tests/a.spec.ts", "A > opens"));
    guard.onTestRunEnd();
    mock.timers.tick(LIMIT * 2);

    assert.deepEqual(errors, []);
    assert.equal(ends(), 0);
  });
});
