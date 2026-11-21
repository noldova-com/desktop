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
import { NativeBinaries } from "../../../src/services/packaging/native-binaries.js";
import { FolderFixture } from "../../fixtures/folder.fixture.js";

@TestClass
export class NativeBinariesTests {
  private static readonly PE_OFFSET: number = 0x80;
  private static readonly ELF: Buffer = Buffer.from("7f454c46020101", "hex");
  private static readonly MACH_O: Buffer = Buffer.from("cffaedfe0c000001", "hex");
  private static readonly UNIVERSAL: Buffer = Buffer.from("cafebabe00000002", "hex");
  private static readonly OTHER_MACH_O: Readonly<Record<string, Buffer>> = {
    "node_modules/mach-o/big-endian-32": Buffer.from("feedface00000012", "hex"),
    "node_modules/mach-o/big-endian-64": Buffer.from("feedfacf01000007", "hex"),
    "node_modules/mach-o/little-endian-32": Buffer.from("cefaedfe07000000", "hex"),
    "node_modules/mach-o/universal-64": Buffer.from("cafebabf00000002", "hex")
  };
  private static readonly JAVA_CLASS: Buffer = Buffer.from("cafebabe00000041", "hex");

  @TestMethod
  public async listsEveryNativeProgramAndLibraryByItsHeader(): Promise<void> {
    await using folder = await NativeBinariesTests.createFolderAsync({
      "node_modules/node-pty/build/Release/conpty.dll": NativeBinariesTests.createPe(),
      "node_modules/node-pty/build/Release/conpty/OpenConsole.exe": NativeBinariesTests.createPe(),
      "node_modules/node-pty/build/Release/pty.node": NativeBinariesTests.ELF,
      "node_modules/node-pty/build/Release/spawn-helper": NativeBinariesTests.MACH_O,
      "node_modules/universal/helper": NativeBinariesTests.UNIVERSAL,
      ...NativeBinariesTests.OTHER_MACH_O,
      "node_modules/java/Sample.class": NativeBinariesTests.JAVA_CLASS,
      "node_modules/node-pty/lib/index.js": Buffer.from("module.exports = require(\"./terminal\");\n"),
      "node_modules/node-pty/README.md": Buffer.from(`MZ is how a Windows program starts.${" ".repeat(64)}\n`),
      "node_modules/node-pty/short.exe": NativeBinariesTests.createPe().subarray(0, 32),
      "node_modules/node-pty/truncated.exe": NativeBinariesTests.createPe().subarray(0, NativeBinariesTests.PE_OFFSET + 2),
      "node_modules/node-pty/empty": Buffer.alloc(0)
    });

    const binaries = await NativeBinaries.listAsync(folder.path);

    Assert.areEqual(JSON.stringify([
      ...Object.keys(NativeBinariesTests.OTHER_MACH_O),
      "node_modules/node-pty/build/Release/conpty.dll",
      "node_modules/node-pty/build/Release/conpty/OpenConsole.exe",
      "node_modules/node-pty/build/Release/pty.node",
      "node_modules/node-pty/build/Release/spawn-helper",
      "node_modules/universal/helper"
    ]), JSON.stringify(binaries));
  }

  @TestMethod
  public async refusesANativeBinaryWhosePathAFilePatternReadsAsAWildcard(): Promise<void> {
    await using folder = await NativeBinariesTests.createFolderAsync({
      "node_modules/sample/notes[1].txt": Buffer.from("Notes\n"),
      "node_modules/sample/helper[1].exe": NativeBinariesTests.createPe()
    });

    const error = await Assert.throwsAsync(() => NativeBinaries.listAsync(folder.path), BuildException);

    Assert.areEqual("node_modules/sample/helper[1].exe is a native program or library the app must keep outside app.asar, but its path holds a character a file pattern "
      + "reads as a wildcard.", error.message);
  }

  private static createPe(): Buffer {
    const file = Buffer.alloc(NativeBinariesTests.PE_OFFSET + 8);
    file.write("MZ", 0, "latin1");
    file.writeUInt32LE(NativeBinariesTests.PE_OFFSET, 0x3c);
    file.write("PE\0\0", NativeBinariesTests.PE_OFFSET, "latin1");
    return file;
  }

  private static async createFolderAsync(files: Readonly<Record<string, Buffer>>): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "native-binaries-"));
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(folder, ...name.split("/"));
      await FolderFixture.ensureAsync(path.dirname(file));
      await writeFile(file, content);
    }
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }
}
