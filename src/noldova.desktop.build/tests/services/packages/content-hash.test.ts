/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ContentHash } from "../../../src/services/packages/content-hash.js";

@TestClass
export class ContentHashTests {
  @TestMethod
  public separatesThePartsSoThatJoinedPartsHashDifferently(): void {
    const parted = ContentHash.ofParts(["ab", "c"]);

    Assert.areEqual(parted, ContentHash.ofParts(["ab", "c"]));
    Assert.areNotEqual(parted, ContentHash.ofParts(["a", "bc"]));
    Assert.areNotEqual(parted, ContentHash.ofParts(["abc"]));
  }

  @TestMethod
  public async hashesAFileByItsContentAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "content-hash-"));
    try {
      await writeFile(path.join(folder, "a.txt"), "same");
      await writeFile(path.join(folder, "b.txt"), "same");
      await writeFile(path.join(folder, "c.txt"), "other");

      const first = await ContentHash.ofFileAsync(path.join(folder, "a.txt"));

      Assert.areEqual(first, await ContentHash.ofFileAsync(path.join(folder, "b.txt")));
      Assert.areNotEqual(first, await ContentHash.ofFileAsync(path.join(folder, "c.txt")));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async hashesATreeByItsPathsAndContentsButNotItsInstalledPackagesAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "content-hash-"));
    try {
      await mkdir(path.join(folder, "src", "node_modules", "left"), { recursive: true });
      await writeFile(path.join(folder, "src", "main.ts"), "main");
      await writeFile(path.join(folder, "package.json"), "{}");

      const first = await ContentHash.ofTreeAsync(folder);
      await writeFile(path.join(folder, "src", "node_modules", "left", "index.js"), "installed");
      const withInstalled = await ContentHash.ofTreeAsync(folder);
      await writeFile(path.join(folder, "src", "main.ts"), "changed");
      const changed = await ContentHash.ofTreeAsync(folder);

      Assert.areEqual(first, withInstalled);
      Assert.areNotEqual(first, changed);
      Assert.areEqual(ContentHash.ofParts(["package.json", await ContentHash.ofFileAsync(path.join(folder, "package.json")), "src/main.ts", await ContentHash.ofFileAsync(path.join(folder, "src", "main.ts"))]), changed);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
