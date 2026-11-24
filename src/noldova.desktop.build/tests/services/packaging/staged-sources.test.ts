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
import { StagedSources } from "../../../src/services/packaging/staged-sources.js";
import { FolderFixture } from "../../fixtures/folder.fixture.js";

@TestClass
export class StagedSourcesTests {
  private static readonly PAGE: string = "https://example.com/sample/releases/tag/v1.0.0";
  private static readonly FILE: { readonly url: string; readonly size: number; readonly sha256: string } =
    { url: "https://example.com/sources/sample-1.0.0.tar.gz", size: 10, sha256: "ab".repeat(32) };

  @TestMethod
  public async listsEachInstalledPackageThatNamesItsUpstreamSourceWithItsLicenceAsync(): Promise<void> {
    const nested = { url: "https://example.com/sources/inner-1.0.0.tar.xz", size: 20, sha256: "cd".repeat(32) };
    await using folder = await StagedSourcesTests.createFolderAsync({
      "package.json": JSON.stringify({ name: "sample-app", version: "1.0.0", noldovaDesktop: { sourcePages: [StagedSourcesTests.PAGE], sources: [StagedSourcesTests.FILE] } }),
      "node_modules/@sample/git-linux-x64/package.json": StagedSourcesTests.manifest("@sample/git-linux-x64", [StagedSourcesTests.PAGE], [StagedSourcesTests.FILE, nested]),
      "node_modules/@sample/git-linux-x64/LICENSE": "GPL text\n",
      "node_modules/@sample/git-linux-x64/COPYING": "Other text\n",
      "node_modules/@sample/runtime/package.json": JSON.stringify({ name: "@sample/runtime", version: "1.0.0", noldovaDesktop: { unpacked: [] } }),
      "node_modules/plain/package.json": JSON.stringify({ name: "plain", version: "1.0.0" }),
      "node_modules/broken/package.json": "{ \"name\": ",
      "node_modules/plain/node_modules/inner/package.json": StagedSourcesTests.manifest("inner", ["https://example.com/inner"], [nested]),
      "node_modules/plain/node_modules/inner/LICENSE.md": "Inner text\n"
    });

    const sources = await StagedSources.listAsync(folder.path);

    Assert.areEqual(JSON.stringify([
      { id: "@sample/git-linux-x64@1.0.0", license: "Other text\n", source: { pages: [StagedSourcesTests.PAGE], files: [StagedSourcesTests.FILE, nested] } },
      { id: "inner@1.0.0", license: "Inner text\n", source: { pages: ["https://example.com/inner"], files: [nested] } }
    ]), JSON.stringify(sources));
  }

  @TestMethod
  public async refusesAPackageWhoseSourcePagesOrFilesAreMissingOrNotValidAsync(): Promise<void> {
    const pages = [StagedSourcesTests.PAGE];
    const files = [StagedSourcesTests.FILE];
    const desktops: readonly Readonly<Record<string, unknown>>[] = [
      { sourcePages: pages },
      { sources: files },
      { sourcePages: [], sources: files },
      { sourcePages: pages, sources: [] },
      { sourcePages: StagedSourcesTests.PAGE, sources: files },
      { sourcePages: ["http://example.com/sample"], sources: files },
      { sourcePages: pages, sources: [{ ...StagedSourcesTests.FILE, size: "10" }] },
      { sourcePages: pages, sources: [{ ...StagedSourcesTests.FILE, extra: 1 }] },
      { sourcePages: pages, sources: [{ ...StagedSourcesTests.FILE, url: "http://example.com/sample.tar" }] },
      { sourcePages: pages, sources: [{ ...StagedSourcesTests.FILE, sha256: "AB".repeat(32) }] }
    ];

    for (const desktop of desktops) {
      await using folder = await StagedSourcesTests.createFolderAsync({
        "node_modules/sample/package.json": JSON.stringify({ name: "sample", version: "1.0.0", noldovaDesktop: { unpacked: [], ...desktop } }),
        "node_modules/sample/LICENSE": "GPL text\n"
      });

      const error = await Assert.throwsAsync(() => StagedSources.listAsync(folder.path), BuildException);

      Assert.areEqual("sample@1.0.0's package.json must give noldovaDesktop.sourcePages as a non-empty list of HTTPS addresses, and noldovaDesktop.sources as a non-empty list "
        + "of objects of exactly url, the HTTPS address of one file, size, its size in bytes, and sha256, its SHA-256 in lowercase hex.", error.message, JSON.stringify(desktop));
    }
  }

  @TestMethod
  public async namesAPackageWithoutANameAndVersionByItsFolderAsync(): Promise<void> {
    await using folder = await StagedSourcesTests.createFolderAsync({
      "node_modules/sample/package.json": JSON.stringify({ name: "sample", noldovaDesktop: { sourcePages: [StagedSourcesTests.PAGE] } }),
      "node_modules/sample/LICENSE": "GPL text\n"
    });

    const error = await Assert.throwsAsync(() => StagedSources.listAsync(folder.path), BuildException);

    Assert.isTrue(error.message.startsWith("node_modules/sample's package.json must give noldovaDesktop.sourcePages"), error.message);
  }

  @TestMethod
  public async refusesAPackageThatNamesItsUpstreamSourceButHoldsNoLicenceAsync(): Promise<void> {
    await using folder = await StagedSourcesTests.createFolderAsync({
      "node_modules/sample/package.json": StagedSourcesTests.manifest("sample", [StagedSourcesTests.PAGE], [StagedSourcesTests.FILE]),
      "node_modules/sample/README.md": "Sample\n"
    });

    const error = await Assert.throwsAsync(() => StagedSources.listAsync(folder.path), BuildException);

    Assert.areEqual("sample@1.0.0 names its upstream source in noldovaDesktop.sources but holds no licence file for the app's licence notice to give with it.",
      error.message);
  }

  private static manifest(name: string, sourcePages: readonly string[], sources: readonly unknown[]): string {
    return JSON.stringify({ name, version: "1.0.0", noldovaDesktop: { unpacked: [], sourcePages, sources } });
  }

  private static async createFolderAsync(files: Readonly<Record<string, string>>): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "staged-sources-"));
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(folder, ...name.split("/"));
      await FolderFixture.ensureAsync(path.dirname(file));
      await writeFile(file, content);
    }
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }
}
