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

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { SourceArchives } from "../../../src/services/packaging/source-archives.js";
import { FolderFixture } from "../../fixtures/folder.fixture.js";

@TestClass
export class SourceArchivesTests {
  private static readonly SOURCE: { readonly url: string; readonly size: number; readonly sha256: string } =
    { url: "https://example.com/releases/download/sources-1/sample-source.tar", size: 10, sha256: "ab".repeat(32) };

  @TestMethod
  public async listsEachInstalledPackageThatNamesItsSourceArchiveWithItsLicenceAsync(): Promise<void> {
    const nested = { ...SourceArchivesTests.SOURCE, url: "https://example.com/releases/download/sources-1/inner-source.tar" };
    await using folder = await SourceArchivesTests.createFolderAsync({
      "package.json": JSON.stringify({ name: "sample-app", version: "1.0.0", noldovaDesktop: { sourceArchive: SourceArchivesTests.SOURCE } }),
      "node_modules/@sample/git-linux-x64/package.json": SourceArchivesTests.manifest("@sample/git-linux-x64", SourceArchivesTests.SOURCE),
      "node_modules/@sample/git-linux-x64/LICENSE": "GPL text\n",
      "node_modules/@sample/git-linux-x64/COPYING": "Other text\n",
      "node_modules/@sample/runtime/package.json": JSON.stringify({ name: "@sample/runtime", version: "1.0.0", noldovaDesktop: { unpacked: [] } }),
      "node_modules/plain/package.json": JSON.stringify({ name: "plain", version: "1.0.0" }),
      "node_modules/broken/package.json": "{ \"name\": ",
      "node_modules/plain/node_modules/inner/package.json": SourceArchivesTests.manifest("inner", nested),
      "node_modules/plain/node_modules/inner/LICENSE.md": "Inner text\n"
    });

    const sources = await SourceArchives.listAsync(folder.path);

    Assert.areEqual(JSON.stringify([
      { id: "@sample/git-linux-x64@1.0.0", license: "Other text\n", archive: SourceArchivesTests.SOURCE },
      { id: "inner@1.0.0", license: "Inner text\n", archive: nested }
    ]), JSON.stringify(sources));
  }

  @TestMethod
  public async refusesAPackageWhoseSourceArchiveIsNotAnAddressSizeAndSha256Async(): Promise<void> {
    await using folder = await SourceArchivesTests.createFolderAsync({
      "node_modules/sample/package.json": SourceArchivesTests.manifest("sample", { ...SourceArchivesTests.SOURCE, size: "10" }),
      "node_modules/sample/LICENSE": "GPL text\n"
    });

    const error = await Assert.throwsAsync(() => SourceArchives.listAsync(folder.path), BuildException);

    Assert.areEqual("sample@1.0.0's package.json must give noldovaDesktop.sourceArchive as an object of exactly url, the HTTPS address of one file, size, its size in bytes, "
      + "and sha256, its SHA-256 in lowercase hex.", error.message);
  }

  @TestMethod
  public async refusesAPackageThatNamesItsSourceArchiveButHoldsNoLicenceAsync(): Promise<void> {
    await using folder = await SourceArchivesTests.createFolderAsync({
      "node_modules/sample/package.json": SourceArchivesTests.manifest("sample", SourceArchivesTests.SOURCE),
      "node_modules/sample/README.md": "Sample\n"
    });

    const error = await Assert.throwsAsync(() => SourceArchives.listAsync(folder.path), BuildException);

    Assert.areEqual("sample@1.0.0 names the archive of its source in noldovaDesktop.sourceArchive but holds no licence file for the app's licence notice to give with it.",
      error.message);
  }

  private static manifest(name: string, sourceArchive: unknown): string {
    return JSON.stringify({ name, version: "1.0.0", noldovaDesktop: { unpacked: [], sourceArchive } });
  }

  private static async createFolderAsync(files: Readonly<Record<string, string>>): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "source-archives-"));
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(folder, ...name.split("/"));
      await FolderFixture.ensureAsync(path.dirname(file));
      await writeFile(file, content);
    }
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }
}
