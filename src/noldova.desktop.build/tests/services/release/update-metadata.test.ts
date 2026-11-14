/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { PackageDigest } from "../../../src/models/release/package-digest.js";
import { ReleaseFile } from "../../../src/models/release/release-file.js";
import { UpdateMetadata } from "../../../src/services/release/update-metadata.js";

@TestClass
export class UpdateMetadataTests {
  private static readonly DATE: string = "2026-11-01T00:00:00.000Z";

  @TestMethod
  public listsTheUpdateFileFirstAndNamesItAsThePath(): void {
    const blockmap = new ReleaseFile("App's Setup.exe.blockmap", new PackageDigest("a", "blockmap512", 3));
    const installer = new ReleaseFile("App's Setup.exe", new PackageDigest("b", "installer512", 9));

    const text = new UpdateMetadata("1.2.3", "App's Setup.exe", [blockmap, installer], UpdateMetadataTests.DATE).format();

    Assert.areEqual([
      "version: 1.2.3",
      "files:",
      "  - url: 'App''s Setup.exe'",
      "    sha512: installer512",
      "    size: 9",
      "  - url: 'App''s Setup.exe.blockmap'",
      "    sha512: blockmap512",
      "    size: 3",
      "path: 'App''s Setup.exe'",
      "sha512: installer512",
      `releaseDate: '${UpdateMetadataTests.DATE}'`,
      String.empty
    ].join("\n"), text);
  }

  @TestMethod
  public refusesFilesWithoutTheUpdateFile(): void {
    const error = Assert.throws(() => new UpdateMetadata("1.2.3", "App.AppImage", [], UpdateMetadataTests.DATE), BuildException);

    Assert.areEqual("The update metadata of 1.2.3 needs its update file App.AppImage among its files.", error.message);
  }

  @TestMethod
  public namesEachTargetsFile(): void {
    Assert.areEqual("latest-macos-arm64.yml", UpdateMetadata.formatFileName(new PackageTarget("macos", "arm64")));
  }

  @TestMethod
  public readsTheReleaseDateOrRefusesTextWithoutOne(): void {
    const date = UpdateMetadata.readReleaseDate(`version: 1.2.3\nreleaseDate: '${UpdateMetadataTests.DATE}'\n`, "latest-linux-x64.yml");
    const error = Assert.throws(() => UpdateMetadata.readReleaseDate("version: 1.2.3\nreleaseDate: \n", "latest-linux-x64.yml"), BuildException);

    Assert.areEqual(UpdateMetadataTests.DATE, date);
    Assert.areEqual("latest-linux-x64.yml names no release date.", error.message);
  }
}
