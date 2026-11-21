/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FailingFileCallFixture } from "./failing-file-call.fixture.js";

@TestClass
export class FailingFileCallFixtureTests {
  @TestMethod
  public restoresOnlyTheCallItPatchedWhateverPatchedTheOthersMeanwhile(): void {
    const file = join(tmpdir(), "failing-file-call-fixture");
    const { link, rename } = fs;

    const renaming = new FailingFileCallFixture("rename", file, "EPERM");
    const linking = new FailingFileCallFixture("link", file, "EACCES");
    renaming[Symbol.dispose]();
    linking[Symbol.dispose]();

    Assert.isTrue(fs.rename === rename, "The rename the fixture found was not put back.");
    Assert.isTrue(fs.link === link, "The link the fixture found was not put back.");
  }
}
