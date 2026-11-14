/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TemporaryFolder } from "../../../src/services/processes/temporary-folder.js";

@TestClass
export class TemporaryFolderTests {
  @TestMethod
  public putsFoldersInTheSystemsTemporaryFolderOnWindowsAndInTmpElsewhere(): void {
    Assert.areEqual(tmpdir(), TemporaryFolder.locateRoot("win32"));
    Assert.areEqual("/tmp", TemporaryFolder.locateRoot("linux"));
    Assert.areEqual("/tmp", TemporaryFolder.locateRoot("darwin"));
  }

  @TestMethod
  public async createsAFolderAtItsRealPathAndRemovesIt(): Promise<void> {
    const folders = new TemporaryFolder();

    const folder = await folders.createAsync(process.platform, "desktop-temporary-");
    const real = await realpath(folder);
    const existed = existsSync(folder);
    await folders.removeAsync(folder);

    Assert.isTrue(existed);
    Assert.areEqual(real, folder);
    Assert.isTrue(path.basename(folder).startsWith("desktop-temporary-"), folder);
    Assert.isFalse(existsSync(folder));
  }
}
