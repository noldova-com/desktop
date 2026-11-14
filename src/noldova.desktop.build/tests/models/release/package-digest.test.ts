/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PackageDigest } from "../../../src/models/release/package-digest.js";
import { ReleaseFile } from "../../../src/models/release/release-file.js";

@TestClass
export class PackageDigestTests {
  @TestMethod
  public digestsBytesWithSha256AndSha512(): void {
    const bytes = Buffer.from("the package");

    const digest = PackageDigest.fromBytes(bytes);

    Assert.areEqual(createHash("sha256").update(bytes).digest("hex"), digest.sha256);
    Assert.areEqual(createHash("sha512").update(bytes).digest("base64"), digest.sha512);
    Assert.areEqual(bytes.length, digest.size);
  }

  @TestMethod
  public async digestsAFileAsItsBytesAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-package-digest-"));
    try {
      const bytes = Buffer.alloc(200_000, 7);
      const file = path.join(folder, "App.AppImage");
      await writeFile(file, bytes);

      const read = await PackageDigest.readAsync(file);
      const expected = PackageDigest.fromBytes(bytes);

      Assert.areEqual([expected.sha256, expected.sha512, expected.size].join(), [read.sha256, read.sha512, read.size].join());
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public namesAReleaseFileWithItsDigest(): void {
    const digest = PackageDigest.fromBytes(Buffer.from("notes"));

    const file = new ReleaseFile("notes.txt", digest);

    Assert.areEqual("notes.txt", file.name);
    Assert.areEqual(digest, file.digest);
  }
}
