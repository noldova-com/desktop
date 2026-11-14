/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile, lstat, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FileIdentity } from "@noldova/desktop.runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class FileIdentityTests {
  @TestMethod
  public namesTheDeviceInodeSizeAndModificationTime(): Promise<void> {
    return FileIdentityTests.runAsync(async file => {
      const stats = await lstat(file, { bigint: true });

      const identity = FileIdentity.of(stats);

      Assert.areEqual(`${stats.dev}:${stats.ino}:${stats.size}:${stats.mtimeNs}`, identity);
    });
  }

  @TestMethod
  public staysTheSameForAnUnchangedFileAndChangesWithItsContent(): Promise<void> {
    return FileIdentityTests.runAsync(async file => {
      const first = FileIdentity.of(await lstat(file, { bigint: true }));
      const again = FileIdentity.of(await lstat(file, { bigint: true }));
      await appendFile(file, " and more");

      const changed = FileIdentity.of(await lstat(file, { bigint: true }));

      Assert.areEqual(first, again);
      Assert.areNotEqual(first, changed);
    });
  }

  private static async runAsync(test: (file: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "notes.txt");
    await writeFile(file, "kept notes");
    await test(file);
  }
}
