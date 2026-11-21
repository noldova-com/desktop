/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Resources } from "../resources.ts";
import { TestOptionsProblem } from "../test-options-problem.ts";
import { TestOptions } from "../test-options.ts";
import { TestOptionsException } from "../test-options.exception.ts";

function refusal(args: readonly string[]): TestOptionsException {
  try {
    TestOptions.parse(args);
  }
  catch (error) {
    if (error instanceof TestOptionsException)
      return error;
    throw error;
  }
  assert.fail(`${JSON.stringify(args)} was accepted.`);
}

describe("TestOptions", () => {
  it("runs every check when no part is named", () => {
    assert.equal(TestOptions.parse([]).part, null);
  });

  it("reads the part the shared workflow names beside its other options", () => {
    const first = TestOptions.parse(["--skip-test-details", "--skip-coverage-details", "--shard=1/2"]);
    const second = TestOptions.parse(["--shard=2/2", "--rerun-failed"]);

    assert.equal(first.part, 1);
    assert.equal(first.isSkippingTestDetails, true);
    assert.equal(second.part, 2);
    assert.equal(second.isRerunningFailed, true);
  });

  for (const option of ["--shard=3/2", "--shard=1/3", "--shard=0/2", "--shard=1/", "--shard=a/2", "--shard="])
    it(`refuses ${option}, since the tests split into two parts`, () => {
      const error = refusal([option]);

      assert.equal(error.problem, TestOptionsProblem.SHARD_VALUE);
      assert.equal(error.message, "--shard takes 1/2, every check but the package tests, or 2/2, Packages and the package tests.");
    });

  it("names in the --shard refusal the checks of each part by its number", () => {
    const message = refusal(["--shard=3/2"]).message;
    const other = Resources.testOptionsShardParts + 1 - Resources.testPartPackageTests;

    assert.match(message, new RegExp(`\\b${Resources.testPartPackageTests}/2, Packages and the package tests\\b`, "u"));
    assert.match(message, new RegExp(`\\b${other}/2, every check but the package tests\\b`, "u"));
  });

  it("refuses a second part", () => {
    assert.equal(refusal(["--shard=1/2", "--shard=2/2"]).problem, TestOptionsProblem.SHARD_ONCE);
  });

  it("refuses a part with a filter, since a part runs whole checks", () => {
    assert.equal(refusal(["--filter", "Tests", "--shard=1/2"]).problem, TestOptionsProblem.SHARD_FILTERED);
    assert.equal(refusal(["--shard=2/2", "--filter", "Tests"]).problem, TestOptionsProblem.SHARD_FILTERED);
  });

  it("keeps a documents run whole", () => {
    assert.equal(TestOptions.parse(["documents"]).part, null);
  });
});
