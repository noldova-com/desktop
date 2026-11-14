/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { gunzipSync, gzipSync } from "node:zlib";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { TarArchive } from "../../../src/models/packaging/tar-archive.js";
import { TarFile } from "../../../src/models/packaging/tar-file.js";
import { InstalledAppFixture } from "../../fixtures/installed-app.fixture.js";
import { type ITarballEntry, TarballFixture } from "../../fixtures/tarball.fixture.js";

@TestClass
export class TarArchiveTests {
  private static readonly PEER_HOST: string = "peer-host";
  private static readonly TARBALL: string = `1 The tarball of peer-host@1.0.0 from ${InstalledAppFixture.UNREACHABLE_REGISTRY}/peer-host-1.0.0.tgz`;
  private static readonly PEER_HOST_MANIFEST: ITarballEntry = {
    name: `${TarballFixture.FOLDER}package.json`, text: JSON.stringify({ name: TarArchiveTests.PEER_HOST, version: "1.0.0", license: "MIT" })
  };
  private static readonly PEER_HOST_FILES: readonly ITarballEntry[] = [TarArchiveTests.PEER_HOST_MANIFEST, { name: `${TarballFixture.FOLDER}LICENSE`, text: "Peer host license" }];
  private static readonly LONG_SCRIPT: string = `dist/${"nested-folder/".repeat(7)}index.mjs`;

  @TestMethod
  public async refusesATarHeaderWhoseChecksumDoesNotMatch(): Promise<void> {
    const result = await TarArchiveTests.packagePeerHostAsync([{ ...TarArchiveTests.PEER_HOST_MANIFEST, hasBadChecksum: true }]);

    Assert.areEqual(`${TarArchiveTests.TARBALL} has a tar header at byte 0 whose checksum does not match, so it cannot ship.\n`, result);
  }

  @TestMethod
  public async refusesATarSizeThatIsNotAnOctalNumber(): Promise<void> {
    const result = await TarArchiveTests.packagePeerHostAsync([{ ...TarArchiveTests.PEER_HOST_MANIFEST, size: "0000000001z\0" }]);

    Assert.areEqual(`${TarArchiveTests.TARBALL} has a tar header whose size is not an octal number, so it cannot ship.\n`, result);
  }

  @TestMethod
  public async refusesATarEntryThatRunsPastTheArchivesEnd(): Promise<void> {
    const result = await TarArchiveTests.packagePeerHostAsync([{ ...TarArchiveTests.PEER_HOST_MANIFEST, size: "00000010000\0" }]);

    Assert.areEqual(`${TarArchiveTests.TARBALL} has a tar entry at byte 0 that runs past the archive's end, so it cannot ship.\n`, result);
  }

  @TestMethod
  public async refusesATarArchiveWithoutItsClosingBlock(): Promise<void> {
    const result = await TarArchiveTests.packagePeerHostAsync(TarArchiveTests.PEER_HOST_FILES, false);

    Assert.areEqual(`${TarArchiveTests.TARBALL} ends without the empty block that closes a tar archive, so it cannot ship.\n`, result);
  }

  @TestMethod
  public async readsAGnuLongNameForTheEntryAfterIt(): Promise<void> {
    const name = `${TarballFixture.FOLDER}${TarArchiveTests.LONG_SCRIPT}`;

    const result = await TarArchiveTests.packagePeerHostAsync([...TarArchiveTests.PEER_HOST_FILES,
      { name: "././@LongLink", type: "L", text: name }, { name: name.slice(0, 100), text: "import { schema } from \"types-only\";" }]);

    Assert.areEqual(`1 peer-host@1.0.0 loads types-only in ${TarArchiveTests.LONG_SCRIPT}, so it would fail at runtime without it, `
      + "but the app names types-only as a types-only peer of peer-host@1.0.0.\n", result);
  }

  @TestMethod
  public async readsAContiguousFileAsAFile(): Promise<void> {
    const result = await TarArchiveTests.packagePeerHostAsync([...TarArchiveTests.PEER_HOST_FILES,
      { name: `${TarballFixture.FOLDER}dist/index.mjs`, type: "7", text: "import { schema } from \"types-only\";" }]);

    Assert.areEqual("1 peer-host@1.0.0 loads types-only in dist/index.mjs, so it would fail at runtime without it, "
      + "but the app names types-only as a types-only peer of peer-host@1.0.0.\n", result);
  }

  @TestMethod
  public async warnsOfThirdPartyEntriesThatAreNeitherFilesNorFolders(): Promise<void> {
    const { FOLDER } = TarballFixture;

    const result = await TarArchiveTests.packagePeerHostAsync([...TarArchiveTests.PEER_HOST_FILES, { name: `${FOLDER}dist/`, type: "5" },
      { name: `${FOLDER}dist/symbolic.js`, type: "2" }, { name: `${FOLDER}dist/hard.js`, type: "1" }, { name: `${FOLDER}dist/device`, type: "3" }, { name: "outside", type: "2" }]);

    Assert.isTrue(result.includes("Warning: The tarball of peer-host@1.0.0 holds dist/symbolic.js as a symbolic link, which the stage's checks of its scripts and license do not read.\n"
      + "Warning: The tarball of peer-host@1.0.0 holds dist/hard.js as a hard link, which the stage's checks of its scripts and license do not read.\n"
      + "Warning: The tarball of peer-host@1.0.0 holds dist/device as a tar entry of type 3, which the stage's checks of its scripts and license do not read.\n"
      + "Warning: The tarball of peer-host@1.0.0 holds outside as a symbolic link, which the stage's checks of its scripts and license do not read.\n"), result);
    Assert.areEqual(4, result.split("Warning: The tarball of").length - 1, result);
  }

  @TestMethod
  public async refusesAGnuLongLinkName(): Promise<void> {
    const result = await TarArchiveTests.packagePeerHostAsync([...TarArchiveTests.PEER_HOST_FILES, { name: "././@LongLink", type: "K", text: "package/index.js" }]);

    Assert.areEqual(`${TarArchiveTests.TARBALL} has a GNU long link name at byte 2048, which packaging does not read, so it cannot ship.\n`, result);
  }

  @TestMethod
  public async refusesAPaxHeaderWhoseRecordsCannotBeRead(): Promise<void> {
    const result = await TarArchiveTests.packagePeerHostAsync([{ name: "PaxHeader", type: "x", text: "x path=index.js\n" }, ...TarArchiveTests.PEER_HOST_FILES]);

    Assert.areEqual(`${TarArchiveTests.TARBALL} has a pax header at byte 0 whose records cannot be read, so it cannot ship.\n`, result);
  }

  @TestMethod
  public readsThePaxPathAfterOtherRecordsAndKeepsTheNameWithoutOne(): void {
    const archive = TarArchive.fromGzip(TarballFixture.createEntries([
      { name: "PaxHeader", type: "x", text: "20 mtime=1700000000\n24 path=package/long.js\n" }, { name: "package/short.js", text: "long" },
      { name: "PaxHeader", type: "x", text: "20 mtime=1700000000\n" }, { name: "package/kept.js", text: "kept" },
      { name: "GlobalHead", type: "g", text: "20 mtime=1700000000\n" }
    ]), "sample");

    Assert.areEqual("package/long.js|package/kept.js", archive.entries.map(t => t.name).join("|"));
    Assert.areEqual("long.js,kept.js", [...archive.topLevelFiles.keys()].join(","));
  }

  @TestMethod
  public joinsTheUstarPrefixAndReadsAnOldHeaderWithoutIt(): void {
    const prefixed = TarArchive.fromGzip(TarArchiveTests.rewriteHeader(TarballFixture.createEntries([{ name: "index.js", text: "a" }]), 345, "package"), "sample");
    const old = TarArchive.fromGzip(TarArchiveTests.rewriteHeader(TarballFixture.createEntries([{ name: "package/index.js", text: "a" }]), 257, "\0\0\0\0\0\0"), "sample");

    Assert.areEqual("package/index.js", prefixed.entries.map(t => t.name).join("|"));
    Assert.areEqual("package/index.js 420", old.entries.map(t => `${t.name} ${t.mode}`).join("|"));
  }

  @TestMethod
  public refusesAModeThatIsNotAnOctalNumber(): void {
    const error = Assert.throws(() => TarArchive.fromGzip(TarArchiveTests.rewriteHeader(TarballFixture.createEntries([{ name: "package/index.js", text: "a" }]), 100, "rw-r--r"),
      "sample"), BuildException);

    Assert.areEqual("sample has a tar header whose mode is not an octal number, so it cannot ship.", error.message);
  }

  @TestMethod
  public describesAnEntryOfAnUnknownType(): void {
    Assert.areEqual("a symbolic link", TarArchive.describeEntry(new TarFile("link", "2", Buffer.alloc(0), 0)));
    Assert.areEqual("a tar entry of type 6", TarArchive.describeEntry(new TarFile("fifo", "6", Buffer.alloc(0), 0)));
  }

  private static rewriteHeader(tarball: Buffer, offset: number, text: string): Buffer {
    const archive = gunzipSync(tarball);
    archive.write(text, offset, "latin1");
    archive.fill(" ", 148, 156);
    const sum = archive.subarray(0, 512).reduce((total, t) => total + t, 0);
    archive.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "latin1");
    return gzipSync(archive);
  }

  private static async packagePeerHostAsync(entries: readonly ITarballEntry[], hasEnd: boolean = true): Promise<string> {
    await using app = await InstalledAppFixture.createAsync({}, true,
      { typeOnlyPeers: { "peer-host@1.0.0": { peers: ["types-only"], reason: "The host bundles it and names it only in its declarations." } } });
    await app.installAsync(InstalledAppFixture.CLI, null, { [TarArchiveTests.PEER_HOST]: "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyTarballAsync(TarArchiveTests.PEER_HOST, TarballFixture.createEntries(entries, hasEnd));
    return await app.packageAsync("linux");
  }
}
