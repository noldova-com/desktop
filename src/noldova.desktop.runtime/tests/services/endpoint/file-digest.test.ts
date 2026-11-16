/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { open, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FileDigest } from "../../../src/services/endpoint/file-digest.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class FileDigestTests {
  @TestMethod
  public async givesTheSameDigestForTheSameContentAndAnotherForOtherContent(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const content = "electron ".repeat(300_000);

    const [first, second, other] = await Promise.all([
      FileDigestTests.digestAsync(folder.path, "first", content),
      FileDigestTests.digestAsync(folder.path, "second", content),
      FileDigestTests.digestAsync(folder.path, "other", `${content.slice(0, -1)}!`)
    ]);

    Assert.areEqual(first, second);
    Assert.areNotEqual(first, other);
    Assert.isTrue(/^[0-9a-f]{64}$/u.test(first));
  }

  @TestMethod
  public async stopsAtTheEndOfAFileShorterThanTheSizeItWasGiven(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();

    const [shorter, same] = await Promise.all([
      FileDigestTests.digestAsync(folder.path, "shorter", "app", 64),
      FileDigestTests.digestAsync(folder.path, "same", "app", 64)
    ]);

    Assert.areEqual(shorter, same);
    Assert.areNotEqual(shorter, await FileDigestTests.digestAsync(folder.path, "exact", "app"));
  }

  private static async digestAsync(folder: string, name: string, content: string, size: number = Buffer.byteLength(content)): Promise<string> {
    const file = path.join(folder, name);
    await writeFile(file, content);
    const handle = await open(file, "r");
    try {
      return await FileDigest.computeAsync(handle, size);
    }
    finally {
      await handle.close();
    }
  }
}
