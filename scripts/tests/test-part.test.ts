/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TestPart } from "../test-part.ts";
import { TestResources } from "../test.resources.ts";

const STAGES: readonly (readonly string[])[] = [["Documents", "Comments"], ["Packages", "Package tests", "Script tests", "Angular tests"]];
const PACKAGE_TESTS = "Package tests";
const PACKAGES = "Packages";

function select(part: number | null): readonly (readonly string[])[] {
  return TestPart.select(STAGES, part, t => t === PACKAGE_TESTS, t => t === PACKAGES);
}

describe("TestPart", () => {
  it("keeps every check when no part is named", () => {
    assert.deepEqual(select(null), STAGES);
  });

  it("gives the first part every check but the package tests, with Packages, in their order", () => {
    assert.deepEqual(select(1), [["Documents", "Comments"], ["Packages", "Script tests", "Angular tests"]]);
  });

  it("gives the second part Packages and the package tests alone", () => {
    assert.deepEqual(select(2), [[], ["Packages", "Package tests"]]);
  });

  it("names what each part runs and that only both together are the gate", () => {
    assert.equal(TestResources.formatPartNotice(1), "Part run: 1 of 2, every check but the package tests. Only both parts together are the complete gate.\n");
    assert.equal(TestResources.formatPartNotice(2), "Part run: 2 of 2, Packages and the package tests. Only both parts together are the complete gate.\n");
  });
});
