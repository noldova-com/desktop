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

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackagedUnpackedFiles } from "../../../src/services/packaging/packaged-unpacked-files.js";

@TestClass
export class PackagedUnpackedFilesTests {
  private static readonly FILE: string = "node_modules/@sample/runtime/jxa/script.js";
  private static readonly PATTERNS: readonly string[] = ["**/*.node", PackagedUnpackedFilesTests.FILE];

  @TestMethod
  public async findsEachNamedFileOutsideTheArchiveMarkedUnpackedAndReadable(): Promise<void> {
    await using folder = await PackagedUnpackedFilesTests.createAsync(PackagedUnpackedFilesTests.PATTERNS, true, true);

    const result = await PackagedUnpackedFiles.verifyAsync(folder.resources, folder.configuration);

    Assert.areEqual(`The installed package keeps outside app.asar, each marked unpacked and readable: ${PackagedUnpackedFilesTests.FILE}.`, result);
  }

  @TestMethod
  public writesEachPackagesFileAsAPatternWhereverItsPackageLiesAndTheAppsOwnFilesByPath(): void {
    const patterns = PackagedUnpackedFiles.toPatterns(["resources/helper.exe", "node_modules/host/node_modules/inner/bin/helper", "node_modules/@sample/runtime/jxa/script.js",
      "node_modules/inner/bin/helper"]);

    Assert.areEqual(JSON.stringify(["**/node_modules/@sample/runtime/jxa/script.js", "**/node_modules/inner/bin/helper", "resources/helper.exe"]), JSON.stringify(patterns));
  }

  @TestMethod
  public async findsANestedPackagesFileAtThePathTheArchiveHoldsItAndReportsThatPath(): Promise<void> {
    const patterns = ["**/*.node", ...PackagedUnpackedFiles.toPatterns(["node_modules/host/node_modules/@sample/runtime/jxa/script.js"])];
    await using folder = await PackagedUnpackedFilesTests.createAsync(patterns, true, true);

    const result = await PackagedUnpackedFiles.verifyAsync(folder.resources, folder.configuration);

    Assert.areEqual(`The installed package keeps outside app.asar, each marked unpacked and readable: ${PackagedUnpackedFilesTests.FILE}.`, result);
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async refusesAPatternNoEntryOfTheArchiveMatches(isEmpty: boolean): Promise<void> {
    const pattern = "**/node_modules/@sample/runtime/jxa/other.js";
    await using folder = await PackagedUnpackedFilesTests.createAsync(["**/*.node", pattern], true, true);
    const archive = path.join(folder.resources, "app.asar");
    if (isEmpty)
      await writeFile(archive, PackagedUnpackedFilesTests.createArchive({}));

    const error = await Assert.throwsAsync(() => PackagedUnpackedFiles.verifyAsync(folder.resources, folder.configuration), BuildException);

    Assert.areEqual(`The installed ${archive} has no entry that ${pattern} matches, which the package's configuration keeps outside app.asar.`, error.message);
  }

  @TestMethod
  public async saysSoWhenTheConfigurationNamesOnlyPatterns(): Promise<void> {
    await using folder = await PackagedUnpackedFilesTests.createAsync(["**/*.node"], false, false);

    const result = await PackagedUnpackedFiles.verifyAsync(folder.resources, folder.configuration);

    Assert.areEqual("The package's configuration keeps no named file outside app.asar.", result);
  }

  @TestMethod
  @TestData(null, true, "has no entry for")
  @TestData(false, true, "holds")
  @TestData(true, false, "can't be read in")
  public async refusesANamedFileTheInstalledPackageDoesNotKeepOutsideTheArchive(unpacked: boolean | null, isWritten: boolean, words: string): Promise<void> {
    await using folder = await PackagedUnpackedFilesTests.createAsync(PackagedUnpackedFilesTests.PATTERNS, unpacked, isWritten);
    const archive = path.join(folder.resources, "app.asar");
    const unpackedFolder = path.join(folder.resources, "app.asar.unpacked");
    const messages: Readonly<Record<string, string>> = {
      "has no entry for": `The installed ${archive} has no entry for ${PackagedUnpackedFilesTests.FILE}, which the package's configuration keeps outside app.asar.`,
      "holds": `The installed ${archive} holds ${PackagedUnpackedFilesTests.FILE} inside it, though the package's configuration keeps it outside app.asar.`,
      "can't be read in": `The installed package's ${PackagedUnpackedFilesTests.FILE} can't be read in ${unpackedFolder}, though the package's configuration keeps it outside app.asar.`
    };

    const error = await Assert.throwsAsync(() => PackagedUnpackedFiles.verifyAsync(folder.resources, folder.configuration), BuildException);

    Assert.areEqual(messages[words], error.message);
  }

  @TestMethod
  @TestData("{}")
  @TestData("{ \"asarUnpack\": [1] }")
  @TestData("[]")
  public async refusesAConfigurationWithoutAListOfPathsAndPatterns(text: string): Promise<void> {
    await using folder = await PackagedUnpackedFilesTests.createAsync(PackagedUnpackedFilesTests.PATTERNS, true, true);
    await writeFile(folder.configuration, text);

    const error = await Assert.throwsAsync(() => PackagedUnpackedFiles.verifyAsync(folder.resources, folder.configuration), BuildException);

    Assert.areEqual(`${folder.configuration} gives no asarUnpack list of paths and patterns.`, error.message);
  }

  private static async createAsync(patterns: readonly string[], unpacked: boolean | null, isWritten: boolean):
    Promise<{ resources: string, configuration: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "packaged-unpacked-"));
    const resources = path.join(folder, "resources");
    await mkdir(resources);
    const segments = PackagedUnpackedFilesTests.FILE.split("/");
    const entry = Object.isNull(unpacked) ? {} : { [segments.at(-1) ?? String.empty]: unpacked ? { size: 6, unpacked: true } : { size: 6, offset: "0" } };
    const files = segments.slice(0, -1).reduceRight<Readonly<Record<string, unknown>>>((inner, segment) => ({ [segment]: { files: inner } }), entry);
    await writeFile(path.join(resources, "app.asar"), PackagedUnpackedFilesTests.createArchive({ files }));
    if (isWritten) {
      const file = path.join(resources, "app.asar.unpacked", ...segments);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "script");
    }
    const configuration = path.join(folder, "electron-builder.json");
    await writeFile(configuration, JSON.stringify({ asarUnpack: patterns }));
    return { resources, configuration, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }

  private static createArchive(header: Readonly<Record<string, unknown>>): Buffer {
    const json = Buffer.from(JSON.stringify(header));
    const padded = Math.ceil(json.length / 4) * 4;
    const pickle = Buffer.alloc(8 + padded);
    pickle.writeUInt32LE(4 + padded, 0);
    pickle.writeUInt32LE(json.length, 4);
    json.copy(pickle, 8);
    const sizes = Buffer.alloc(8);
    sizes.writeUInt32LE(4, 0);
    sizes.writeUInt32LE(pickle.length, 4);
    return Buffer.concat([sizes, pickle, Buffer.from("script")]);
  }
}
