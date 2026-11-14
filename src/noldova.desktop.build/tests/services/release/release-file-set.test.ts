/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ReleaseFileSet } from "../../../src/services/release/release-file-set.js";

@TestClass
export class ReleaseFileSetTests {
  private static readonly PRODUCT: string = "Sample App";
  private static readonly VERSION: string = "0.0.2";
  private static readonly DATE: string = "2026-11-01T00:00:00.000Z";
  private static readonly LINUX: PackageTarget = new PackageTarget("linux", "x64");

  @TestMethod
  public listsOnlyTheFilesOfTheReleasesTargets(): void {
    const targets = [ReleaseFileSetTests.LINUX, new PackageTarget("macos", "arm64")];

    const names = new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, targets).listAll();

    Assert.isTrue(names.length > 0);
    Assert.isTrue(names.every(t => t.includes("-linux-x64") || t.includes("-macos-arm64")), names.join(", "));
    Assert.isTrue(names.some(t => t.includes("-linux-x64")));
    Assert.isTrue(names.some(t => t.includes("-macos-arm64")));
  }

  @TestMethod
  public async verifiesAReleaseWithoutArm64TargetsAsync(): Promise<void> {
    const targets = [ReleaseFileSetTests.LINUX, new PackageTarget("windows", "x64"), new PackageTarget("macos", "x64")];
    await using folder = await ReleaseFileSetTests.createFolderAsync(targets);
    const set = new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, targets);
    for (const target of targets)
      await set.writeAsync(folder.path, target, ReleaseFileSetTests.VERSION, ReleaseFileSetTests.DATE);

    const files = await set.verifyAsync(folder.path, ReleaseFileSetTests.VERSION);

    Assert.areEqual(set.listAll().length, files.length);
    Assert.isTrue(files.every(t => !t.name.includes("arm64")));
  }

  @TestMethod
  public async refusesAMissingFileOfATargetTheReleaseNamesAsync(): Promise<void> {
    const built = [ReleaseFileSetTests.LINUX];
    const named = [ReleaseFileSetTests.LINUX, new PackageTarget("macos", "arm64")];
    await using folder = await ReleaseFileSetTests.createFolderAsync(built);
    await new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, built).writeAsync(folder.path, ReleaseFileSetTests.LINUX, ReleaseFileSetTests.VERSION, ReleaseFileSetTests.DATE);

    const error = await Assert.throwsAsync(() => new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, named).verifyAsync(folder.path, ReleaseFileSetTests.VERSION), BuildException);

    Assert.isTrue(error.message.includes("Missing: Sample App-macos-arm64"), error.message);
    Assert.isTrue(error.message.includes("Not part of a release: none."), error.message);
  }

  @TestMethod
  public async refusesTheFilesOfATargetTheReleaseDoesNotNameAsync(): Promise<void> {
    const built = [ReleaseFileSetTests.LINUX, new PackageTarget("macos", "arm64")];
    const named = [ReleaseFileSetTests.LINUX];
    await using folder = await ReleaseFileSetTests.createFolderAsync(built);
    for (const target of built)
      await new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, built).writeAsync(folder.path, target, ReleaseFileSetTests.VERSION, ReleaseFileSetTests.DATE);

    const error = await Assert.throwsAsync(() => new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, named).verifyAsync(folder.path, ReleaseFileSetTests.VERSION), BuildException);

    Assert.isTrue(error.message.includes("Missing: none."), error.message);
    for (const name of new PackageTarget("macos", "arm64").listFileNames(ReleaseFileSetTests.PRODUCT))
      Assert.isTrue(error.message.includes(name), error.message);
    Assert.isTrue(error.message.includes("latest-macos-arm64.yml"), error.message);
  }

  @TestMethod
  public async refusesAFolderThatDoesNotExistAsync(): Promise<void> {
    const folder = path.join(tmpdir(), "desktop-release-files-missing", "release");

    const error = await Assert.throwsAsync(() => new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, [ReleaseFileSetTests.LINUX]).verifyAsync(folder, ReleaseFileSetTests.VERSION),
      BuildException);

    Assert.areEqual(`The release's folder ${folder} does not exist.`, error.message);
  }

  @TestMethod
  public async refusesToWriteTheFilesOfAPackageThatIsMissingAsync(): Promise<void> {
    await using folder = await ReleaseFileSetTests.createFolderAsync([]);
    const [name = String.empty] = ReleaseFileSetTests.LINUX.listFileNames(ReleaseFileSetTests.PRODUCT);

    const error = await Assert.throwsAsync(
      () => new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, [ReleaseFileSetTests.LINUX]).writeAsync(folder.path, ReleaseFileSetTests.LINUX, ReleaseFileSetTests.VERSION, ReleaseFileSetTests.DATE),
      BuildException);

    Assert.areEqual(`${path.join(folder.path, name)} is missing; npm run package makes it.`, error.message);
  }

  @TestMethod
  public async refusesAChecksumThatNoLongerMatchesItsPackageAsync(): Promise<void> {
    await using folder = await ReleaseFileSetTests.createFolderAsync([ReleaseFileSetTests.LINUX]);
    const set = new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, [ReleaseFileSetTests.LINUX]);
    await set.writeAsync(folder.path, ReleaseFileSetTests.LINUX, ReleaseFileSetTests.VERSION, ReleaseFileSetTests.DATE);
    const [name = String.empty] = ReleaseFileSetTests.LINUX.listFileNames(ReleaseFileSetTests.PRODUCT);
    await writeFile(path.join(folder.path, name), "changed bytes");

    const error = await Assert.throwsAsync(() => set.verifyAsync(folder.path, ReleaseFileSetTests.VERSION), BuildException);

    Assert.areEqual(`${name}.sha256 does not match ${name}.`, error.message);
  }

  @TestMethod
  public async refusesUpdateMetadataForAnotherVersionOrWithoutAReleaseDateAsync(): Promise<void> {
    await using folder = await ReleaseFileSetTests.createFolderAsync([ReleaseFileSetTests.LINUX]);
    const set = new ReleaseFileSet(ReleaseFileSetTests.PRODUCT, [ReleaseFileSetTests.LINUX]);
    await set.writeAsync(folder.path, ReleaseFileSetTests.LINUX, ReleaseFileSetTests.VERSION, ReleaseFileSetTests.DATE);
    const metadata = path.join(folder.path, "latest-linux-x64.yml");
    const text = await readFile(metadata, "utf8");

    const other = await Assert.throwsAsync(() => set.verifyAsync(folder.path, "0.0.3"), BuildException);
    await writeFile(metadata, text.replace(/^releaseDate: .*$/mu, "releaseDate: soon"));
    const undated = await Assert.throwsAsync(() => set.verifyAsync(folder.path, ReleaseFileSetTests.VERSION), BuildException);

    Assert.areEqual(`latest-linux-x64.yml does not describe version 0.0.3 with ${ReleaseFileSetTests.LINUX.listFileNames(ReleaseFileSetTests.PRODUCT).join(" and ")} as they are.`,
      other.message);
    Assert.areEqual("latest-linux-x64.yml names no release date.", undated.message);
  }

  private static async createFolderAsync(targets: readonly PackageTarget[]): Promise<{ readonly path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-release-files-"));
    await mkdir(folder, { recursive: true });
    for (const target of targets)
      for (const name of target.listFileNames(ReleaseFileSetTests.PRODUCT))
        await writeFile(path.join(folder, name), `${name} bytes`);
    return {
      path: folder,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    };
  }
}
