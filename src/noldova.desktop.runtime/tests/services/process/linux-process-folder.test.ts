/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { ProcessTableRowUnreadableException } from "../../../src/exceptions/process-table-row-unreadable.exception.js";
import { LinuxProcessFolder } from "../../../src/services/process/linux-process-folder.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class LinuxProcessFolderTests {
  private static readonly STAT: string = "4120 (tool) S 1 4120 4120 34816 4120 4194560 1 0 0 0 0 0 0 0 20 0 1 0 12345 0";

  @TestMethod
  @TestData("EACCES")
  @TestData("EPERM")
  public async skipsAProcessWhoseStatFileItMayNotReadAsWhenTheFolderHidesOtherUsersProcesses(code: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await mkdir(path.join(folder.path, "4120"));
    await mkdir(path.join(folder.path, "4188"));
    const read = (file: string): Promise<string> => path.basename(path.dirname(file)) === "4188"
      ? Promise.reject(Object.assign(new Error("hidden"), { code }))
      : Promise.resolve(LinuxProcessFolderTests.STAT);

    const rows = await new LinuxProcessFolder(folder.path, 100, read).readAsync();

    Assert.areEqual("[[4120,1,4120,34816,123450,0]]", JSON.stringify(rows));
  }

  @TestMethod
  @TestData("1284403 (ps) X 0 -1 -1 0 -1 4194316 0 0 0 0 0 0 0 0 20 0 1 0 98765 0")
  @TestData("1284403 (ps) X 0 0 0 0 -1 4194316 0 0 0 0 0 0 0 0 20 0 1 0 98765 0")
  @TestData("1284403 (ps) S 0 -1 -1 0 -1 4194316 0 0 0 0 0 0 0 0 20 0 1 0 98765 0")
  public async skipsTheRowOfAProcessThatIsEndingDeadOrWithoutAGroup(ending: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await mkdir(path.join(folder.path, "4120"));
    await mkdir(path.join(folder.path, "1284403"));
    const read = (file: string): Promise<string> => Promise.resolve(path.basename(path.dirname(file)) === "1284403" ? ending : LinuxProcessFolderTests.STAT);

    const rows = await new LinuxProcessFolder(folder.path, 100, read).readAsync();

    Assert.areEqual("[[4120,1,4120,34816,123450,0]]", JSON.stringify(rows));
  }

  @TestMethod
  @TestData("4188 (tool) S -1 4188 4188 0 4188 4194560 1 0 0 0 0 0 0 0 20 0 1 0 12345 0")
  @TestData("4188 (tool) S 1 4188 4188 -1 4188 4194560 1 0 0 0 0 0 0 0 20 0 1 0 12345 0")
  @TestData("4188 (tool) S 1 x 4188 0 4188 4194560 1 0 0 0 0 0 0 0 20 0 1 0 12345 0")
  @TestData("4188 (tool) S 1 4188 4188 0 4188 4194560 1 0 0 0 0 0 0 0 20 0 1 0 -5 0")
  @TestData("4188 tool X 1 -1 4188 0 4188")
  @TestData("4188 (tool) X -1 4188 4188 0 4188 4194560 1 0 0 0 0 0 0 0 20 0 1 0 12345 0")
  @TestData("4188 (tool) S 1 -1 4188 x 4188 4194560 1 0 0 0 0 0 0 0 20 0 1 0 12345 0")
  public async stillFailsOnARowThatIsMalformedForAnyOtherReason(row: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await mkdir(path.join(folder.path, "4188"));

    const exception = await Assert.throwsAsync(() => new LinuxProcessFolder(folder.path, 100, () => Promise.resolve(row)).readAsync(), ProcessTableRowUnreadableException);

    Assert.areEqual(`The process table has a row that could not be read: ${row}`, exception.message);
  }

  @TestMethod
  public async readsAtMost64StatFilesAtOnce(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const names = Array.from({ length: 150 }, (_, t) => String(5000 + t));
    await Promise.all(names.map(t => mkdir(path.join(folder.path, t))));
    let reading = 0;
    let most = 0;
    const read = async (): Promise<string> => {
      reading++;
      most = Math.max(most, reading);
      await Promise.resolve();
      reading--;
      return LinuxProcessFolderTests.STAT;
    };

    const rows = await new LinuxProcessFolder(folder.path, 100, read).readAsync();

    Assert.areEqual(64, most);
    Assert.areEqual(names.join(","), rows.map(([t]) => t).sort((a, b) => a - b).join(","));
  }
}
