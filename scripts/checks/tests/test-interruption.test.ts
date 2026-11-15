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
import { TestMethodResult, TestOutcome } from "@noldova/context.testing";

import { Resources } from "../../resources.ts";
import { ScriptException } from "../../script.exception.ts";
import { TestInterruption } from "../test-interruption.ts";

describe("TestInterruption", () => {
  it("lists each resource the test added, counting repeated names, and none it closed", () => {
    assert.deepEqual(TestInterruption.listAdded(["Timeout", "TTYWrap", "Timeout"], ["TTYWrap", "Timeout", "Timeout", "Timeout", "FSReqCallback"]), ["Timeout", "FSReqCallback"]);
  });

  it("refuses a method that completed before its class started", () => {
    const interruption = new TestInterruption();

    assert.throws(() => interruption.complete(new TestMethodResult("Hanging", "HangingTests", "passes", undefined, [], TestOutcome.Passed, 1, undefined, undefined)),
      (error: unknown) => error instanceof ScriptException && error.message === Resources.serialTestMethodWithoutClass);
    assert.equal(interruption.isInterrupted, false);
    assert.equal(interruption.collectStopped(), null);
  });
});
