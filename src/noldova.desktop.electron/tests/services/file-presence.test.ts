/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FilePresence } from "../../src/services/file-presence.js";

@TestClass
export class FilePresenceTests {
  @TestMethod
  public async findsAFileAndAFolderButNotAMissingPathOrOneUnderAFile(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "desktop-file-presence-"));
    try {
      await writeFile(join(folder, "notes.txt"), "notes");
      await mkdir(join(folder, "nested"));

      const found = await Promise.all(["notes.txt", "nested", "missing.txt", join("notes.txt", "below")].map(t => FilePresence.existsAsync(join(folder, t))));

      Assert.areEqual("true,true,false,false", found.join(","));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
