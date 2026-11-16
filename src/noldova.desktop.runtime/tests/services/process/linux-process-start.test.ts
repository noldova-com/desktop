/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { ProcessTableRowUnreadableException } from "../../../src/exceptions/process-table-row-unreadable.exception.js";
import { LinuxProcessStart } from "../../../src/services/process/linux-process-start.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class LinuxProcessStartTests {
  @TestMethod
  public async readsTheStartTimeAfterANameThatHoldsSpacesAndParentheses(): Promise<void> {
    await using folder = await LinuxProcessStartTests.createAsync("4120 (a (b) c) S 1 4120 4120 0 -1 4194560 0 0 0 0 0 0 0 0 20 0 1 0 88123 0 0\n");

    Assert.areEqual("88123", LinuxProcessStart.read(folder.path, 4120));
  }

  @TestMethod
  @TestData("4120 noldova S 1 4120 4120 0 -1 4194560 0 0 0 0 0 0 0 0 20 0 1 0 88123 0 0")
  @TestData("4120 (noldova) S 1 4120")
  @TestData("4120 (noldova) S 1 4120 4120 0 -1 4194560 0 0 0 0 0 0 0 0 20 0 1 0 -5 0 0")
  public async refusesARowWithoutANameEndOrAStartTime(row: string): Promise<void> {
    await using folder = await LinuxProcessStartTests.createAsync(row);

    Assert.throws(() => LinuxProcessStart.read(folder.path, 4120), ProcessTableRowUnreadableException);
  }

  @TestMethod
  @PlatformFixture.linuxOnly()
  public readsItsOwnStartTimeFromTheProcessFolder(): void {
    Assert.isTrue(/^[0-9]+$/u.test(LinuxProcessStart.read("/proc", process.pid)));
  }

  private static async createAsync(row: string): Promise<TemporaryFolderFixture> {
    const folder = await TemporaryFolderFixture.createAsync();
    await mkdir(path.join(folder.path, "4120"));
    await writeFile(path.join(folder.path, "4120", "stat"), row);
    return folder;
  }
}
