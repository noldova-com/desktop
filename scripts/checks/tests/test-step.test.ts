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

import { TestStep } from "../test-step.ts";

describe("TestStep", () => {
  it("names a step that ended with how long it took", () => {
    const step = new TestStep("copying Node.js", 100.4);

    step.end(230.2);

    assert.equal(step.isRunning, false);
    assert.equal(step.format(5_000), "copying Node.js 130 ms");
  });

  it("names a step that hasn't ended as still running, with how long it has run", () => {
    const step = new TestStep("checking Node.js", 1_000);

    assert.equal(step.isRunning, true);
    assert.equal(step.format(36_000.6), "checking Node.js still running after 35001 ms");
  });

  it("says no step is running and how long ago the last one ended, and names a step still running as such", () => {
    const ended = new TestStep("checking the copy of Node.js", 1_000);
    const running = new TestStep("checking Node.js", 1_000);

    ended.end(2_000.4);

    assert.equal(ended.formatAfter(36_000), "no step running, 34000 ms after checking the copy of Node.js ended");
    assert.equal(running.formatAfter(36_000), "checking Node.js still running after 35000 ms");
  });
});
