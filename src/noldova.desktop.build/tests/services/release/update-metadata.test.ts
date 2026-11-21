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

    const text = new UpdateMetadata("1.2.3", "App's Setup.exe", [blockmap, installer], UpdateMetadataTests.DATE, new Map()).format();

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
  public writesASignatureAfterTheSizeOfEachSignedFileAndReadsThemBack(): void {
    const image = new ReleaseFile("App's 1.2.3.AppImage", new PackageDigest("a", "image512", 5));
    const debian = new ReleaseFile("App 1.2.3.deb", new PackageDigest("b", "debian512", 6));
    const unsigned = new ReleaseFile("App notes.txt", new PackageDigest("c", "notes512", 7));

    const text = new UpdateMetadata("1.2.3", "App's 1.2.3.AppImage", [image, debian, unsigned], UpdateMetadataTests.DATE,
      new Map([["App's 1.2.3.AppImage", "c2lnbmF0dXJl"], ["App 1.2.3.deb", "b3RoZXI="]])).format();

    Assert.isTrue(text.startsWith([
      "version: 1.2.3",
      "files:",
      "  - url: 'App''s 1.2.3.AppImage'",
      "    sha512: image512",
      "    size: 5",
      "    signature: c2lnbmF0dXJl",
      "  - url: 'App 1.2.3.deb'",
      "    sha512: debian512",
      "    size: 6",
      "    signature: b3RoZXI=",
      "  - url: 'App notes.txt'",
      "    sha512: notes512",
      "    size: 7",
      "path: 'App''s 1.2.3.AppImage'"
    ].join("\n")), text);
    Assert.areEqual(JSON.stringify([["App's 1.2.3.AppImage", "c2lnbmF0dXJl"], ["App 1.2.3.deb", "b3RoZXI="]]), JSON.stringify([...UpdateMetadata.readSignatures(text)]));
    Assert.areEqual("App 1.2.3.deb", UpdateMetadata.unquote("App 1.2.3.deb"));
  }

  @TestMethod
  public refusesFilesWithoutTheUpdateFile(): void {
    const error = Assert.throws(() => new UpdateMetadata("1.2.3", "App.AppImage", [], UpdateMetadataTests.DATE, new Map()), BuildException);

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
