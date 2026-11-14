/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { ArchiveReader } from "../../../src/services/packages/archive.reader.js";
import { type ITarballEntry, TarballFixture } from "../../fixtures/tarball.fixture.js";

@TestClass
export class ArchiveReaderTests {
  private static readonly LONG_NAME: string = `package/${"long-folder/".repeat(10)}file.txt`;

  @TestMethod
  public async readsTheFilesWithTheirPrefixesAndLongNamesAndSkipsOtherEntriesAsync(): Promise<void> {
    const files = await ArchiveReaderTests.readAsync([
      { name: "package/plain.txt", text: "plain" },
      { name: "package/old.txt", text: "old", type: "\0" },
      { name: "folder/", type: "5" },
      { name: "prefixed.txt", text: "prefixed", prefix: "package/deep" },
      { name: ArchiveReaderTests.LONG_NAME, text: "long" },
      { name: "PaxHeader", type: "x", text: "17 comment=other\n" },
      { name: "package/after-pax.txt", text: "after" },
      { name: "package/empty.txt" }
    ]);

    Assert.areEqual(["package/plain.txt", "package/old.txt", "package/deep/prefixed.txt", ArchiveReaderTests.LONG_NAME, "package/after-pax.txt", "package/empty.txt"].join("\n"), [...files.keys()].join("\n"));
    Assert.areEqual(["plain", "old", "prefixed", "long", "after", String.empty].join(), [...files.values()].map(t => t.toString("utf8")).join());
  }

  @TestMethod
  public async readsUpToTheEndOfAnArchiveWithoutEndBlocksAsync(): Promise<void> {
    const files = await ArchiveReaderTests.readAsync([{ name: "package/only.txt", text: "only" }], false);

    Assert.areEqual("package/only.txt", [...files.keys()].join());
  }

  @TestMethod
  public async refusesAFileThatIsNotGzippedAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "archive-reader-"));
    try {
      const archive = path.join(folder, "plain.tgz");
      await writeFile(archive, "not gzipped");

      const error = await Assert.throwsAsync(() => new ArchiveReader().readAsync(archive), BuildException);

      Assert.areEqual(Resources.formatArchiveUnreadable(archive), error.message);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async refusesAMissingArchiveAsync(): Promise<void> {
    const archive = path.join(tmpdir(), "archive-reader-missing", "missing.tgz");

    const error = await Assert.throwsAsync(() => new ArchiveReader().readAsync(archive), BuildException);

    Assert.areEqual(Resources.formatArchiveUnreadable(archive), error.message);
  }

  @TestMethod
  public async refusesAnEntryWithASizeThatIsNotANumberAsync(): Promise<void> {
    const error = await Assert.throwsAsync(() => ArchiveReaderTests.readAsync([{ name: "package/a.txt", text: "a" }, { name: "package/b.txt", size: "zzzzzzzzzzz\0" }]), BuildException);

    Assert.isTrue(error.message.endsWith(" has a malformed or truncated entry at offset 1024."));
  }

  @TestMethod
  public async refusesAnEntryLongerThanTheArchiveAsync(): Promise<void> {
    const error = await Assert.throwsAsync(() => ArchiveReaderTests.readAsync([{ name: "package/a.txt", text: "a", size: "00000077777\0" }], false), BuildException);

    Assert.isTrue(error.message.endsWith(" has a malformed or truncated entry at offset 0."));
  }

  private static async readAsync(entries: readonly ITarballEntry[], hasEnd: boolean = true): Promise<ReadonlyMap<string, Buffer>> {
    const folder = await mkdtemp(path.join(tmpdir(), "archive-reader-"));
    try {
      const archive = path.join(folder, "package.tgz");
      await writeFile(archive, TarballFixture.createEntries(entries, hasEnd));
      return await new ArchiveReader().readAsync(archive);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
