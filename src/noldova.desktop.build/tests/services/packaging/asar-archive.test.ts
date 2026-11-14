/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, Category, TestClass, TestMethod, Timeout } from "@noldova/context.testing";
import { PackagedPath } from "@noldova/desktop.runtime";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { AsarArchive } from "../../../src/services/packaging/asar-archive.js";
import { ElectronDistribution } from "../../../src/services/packaging/electron-distribution.js";
import { NativeBinaries } from "../../../src/services/packaging/native-binaries.js";
import { PackagedUnpackedFiles } from "../../../src/services/packaging/packaged-unpacked-files.js";
import { ShippedFiles } from "../../../src/services/packaging/shipped-files.js";
import { UnpackedFiles } from "../../../src/services/packaging/unpacked-files.js";
import { Resources } from "../../../src/resources.js";

@TestClass
@Category("Packaging")
export class AsarArchiveTests {
  private static readonly HEADER: object = {
    files: { "a": { files: { "b.txt": { size: 5, offset: "0" } } }, "c.txt": { size: 3, offset: "5" }, "d.node": { size: 4, unpacked: true } }
  };
  private static readonly PICKLE_LENGTH: number = 4;
  private static readonly PICKLE_PREFIX: number = 8;
  private static readonly SCRIPT: string = "console.log(\"named\");\n";
  private static readonly OTHER: string = "console.log(\"packed\");\n";
  private static readonly PACKAGE_SEGMENTS: readonly string[] = ["node_modules", "@sample", "runtime"];
  private static readonly BUILDER_LIMIT: number = 240_000;
  private static readonly BUILDER_VARIABLES: readonly string[] = [
    "PATH", "PATHEXT", "COMSPEC", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "PROCESSOR_ARCHITECTURE", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA"
  ];
  private static readonly TEMPORARY_VARIABLES: readonly string[] = ["TEMP", "TMP", "TMPDIR"];
  private static readonly PE_OFFSET: number = 0x80;
  private static readonly ELF: Buffer = Buffer.from("7f454c460201010000000000000000000000000000000000", "hex");
  private static readonly MACH_O: Buffer = Buffer.from("cffaedfe0c00000100000000000000000000000000000000", "hex");
  private static readonly PROGRAM: string = "node_modules/node-pty/prebuilds/win32-x64/conpty/OpenConsole.exe";
  private static readonly KINDS: readonly string[] = [
    "resources/helper.exe", "resources/helper.dll", "resources/helper.node", "helper.pdb", "main.o", "helper.obj", "helper.a", "helper.d.ts", ".git/hooks/helper",
    "resources/._helper.node", "resources/electron-builder.json", ".editorconfig", "resources/.editorconfig", ".yarn/helper.node", "resources/.yarn/helper.node",
    "node_modules/sample/lib/helper.exe", "node_modules/sample/lib/helper.dll", "node_modules/sample/lib/helper.node", "node_modules/sample/lib/helper.pdb",
    "node_modules/sample/lib/helper.o", "node_modules/sample/lib/helper.obj", "node_modules/sample/lib/helper.a", "node_modules/sample/lib/._helper.node",
    "node_modules/sample/lib/test/helper.node", "node_modules/sample/test/helper.node", "node_modules/sample/tests/helper.node", "node_modules/sample/__tests__/helper.node",
    "node_modules/sample/example/helper.node", "node_modules/sample/examples/helper.node", "node_modules/sample/node_gyp_bins/python3",
    "node_modules/sample/prebuild/helper.node", "node_modules/sample/build/Makefile", "node_modules/sample/build/config.gypi", "node_modules/sample/build/Release/helper.node",
    "node_modules/sample/build/Release/obj.target/helper.node", "node_modules/sample/build/Release/.deps/helper.node",
    "node_modules/@scope/sample/lib/helper.node", "node_modules/@scope/sample/test/helper.node", "node_modules/@scope/sample/lib/helper.exe",
    "node_modules/inner/lib/helper.node", "node_modules/sample/node_modules/inner/lib/helper.node", "node_modules/sample/node_modules/inner/__tests__/helper.node",
    "node_modules/keytar/src/helper.node", "node_modules/keytar/build/Release/keytar.node", "node_modules/lzma-native/deps/helper.node",
    "node_modules/libui-node/build/helper.node", "node_modules/libui-node/lib/build/helper.node", "node_modules/@scope/libui-node/build/helper.node",
    "node_modules/sample/lib/electron-builder.yml"
  ];

  @TestMethod
  @Timeout(300_000)
  public async packsAFileAPackageNamesOutsideTheArchiveWhereAPlainReadOfItsUnpackedPathFindsIt(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const stage = path.join(folder.path, "stage");
    await AsarArchiveTests.writeAsync(stage, "package.json", JSON.stringify({ name: "sample-app", version: "1.0.0", main: "main.js", dependencies: { "@sample/runtime": "1.0.0" } }));
    await AsarArchiveTests.writeAsync(stage, "main.js", "\"use strict\";\n");
    await AsarArchiveTests.writeAsync(stage, "node_modules/@sample/runtime/package.json",
      JSON.stringify({ name: "@sample/runtime", version: "1.0.0", noldovaDesktop: { unpacked: ["jxa/script.js"] } }));
    await AsarArchiveTests.writeAsync(stage, "node_modules/@sample/runtime/jxa/script.js", AsarArchiveTests.SCRIPT);
    await AsarArchiveTests.writeAsync(stage, "node_modules/@sample/runtime/jxa/other.js", AsarArchiveTests.OTHER);

    const resources = await AsarArchiveTests.packageAsync(folder.path, stage, await UnpackedFiles.listAsync(stage, PackageTarget.fromProcess(process.platform, process.arch)));
    const archive = path.join(resources, "app.asar");
    const script = await AsarArchive.isUnpackedAsync(archive, [...AsarArchiveTests.PACKAGE_SEGMENTS, "jxa", "script.js"]);
    const other = await AsarArchive.isUnpackedAsync(archive, [...AsarArchiveTests.PACKAGE_SEGMENTS, "jxa", "other.js"]);
    const unpacked = PackagedPath.unpacked(path.join(archive, ...AsarArchiveTests.PACKAGE_SEGMENTS, "jxa", "script.js"));

    Assert.isTrue(existsSync(path.join(resources, "app.asar.unpacked", ...AsarArchiveTests.PACKAGE_SEGMENTS, "jxa", "script.js")));
    Assert.isFalse(existsSync(path.join(resources, "app.asar.unpacked", ...AsarArchiveTests.PACKAGE_SEGMENTS, "jxa", "other.js")));
    Assert.areEqual(true, script);
    Assert.areEqual(false, other);
    Assert.areEqual(path.join(resources, "app.asar.unpacked", ...AsarArchiveTests.PACKAGE_SEGMENTS, "jxa", "script.js"), unpacked);
    Assert.areEqual(AsarArchiveTests.SCRIPT, await readFile(unpacked, "utf8"));
  }

  @TestMethod
  @Timeout(300_000)
  public async packsAndUnpacksEachNativeFileOfAnotherPlatformThatThePackageShipsSoTheSmokeFindsEveryListedFile(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const stage = path.join(folder.path, "stage");
    const target = PackageTarget.fromProcess(process.platform, process.arch);
    await AsarArchiveTests.writeAsync(stage, "package.json", JSON.stringify({ name: "sample-app", version: "1.0.0", main: "main.js", dependencies: { "node-pty": "1.0.0" } }));
    await AsarArchiveTests.writeAsync(stage, "main.js", "\"use strict\";\n");
    await AsarArchiveTests.writeAsync(stage, "node_modules/node-pty/package.json", JSON.stringify({ name: "node-pty", version: "1.0.0" }));
    await AsarArchiveTests.writeAsync(stage, "node_modules/node-pty/prebuilds/linux-x64/pty.node", AsarArchiveTests.ELF);
    await AsarArchiveTests.writeAsync(stage, "node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper", AsarArchiveTests.MACH_O);
    await AsarArchiveTests.writeAsync(stage, "node_modules/node-pty/prebuilds/win32-x64/conpty.node", AsarArchiveTests.createPe());
    await AsarArchiveTests.writeAsync(stage, AsarArchiveTests.PROGRAM, AsarArchiveTests.createPe());
    const natives = await NativeBinaries.listAsync(stage);
    const listed = ShippedFiles.filter(natives, target);

    const resources = await AsarArchiveTests.packageAsync(folder.path, stage, listed);
    const report = await PackagedUnpackedFiles.verifyAsync(resources, path.join(folder.path, "electron-builder.json"));
    const program = await AsarArchive.isUnpackedAsync(path.join(resources, "app.asar"), AsarArchiveTests.PROGRAM.split("/"));

    Assert.areEqual(4, natives.length, natives.join(", "));
    Assert.areEqual(target.platform === Resources.windowsTarget ? 4 : 3, listed.length, listed.join(", "));
    Assert.areEqual(`The installed package keeps outside app.asar, each marked unpacked and readable: ${listed.join(", ")}.`, report);
    Assert.areEqual(target.platform === Resources.windowsTarget ? true : null, program);
  }

  @TestMethod
  @Timeout(300_000)
  public async unpacksANestedPackagesFilesWhereElectronBuilderHoistsThePackageSoTheSmokeFindsEachThere(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const stage = path.join(folder.path, "stage");
    const target = PackageTarget.fromProcess(process.platform, process.arch);
    const inner = "node_modules/host/node_modules/inner";
    await AsarArchiveTests.writeAsync(stage, "package.json", JSON.stringify({ name: "sample-app", version: "1.0.0", main: "main.js", dependencies: { host: "1.0.0" } }));
    await AsarArchiveTests.writeAsync(stage, "main.js", "\"use strict\";\n");
    await AsarArchiveTests.writeAsync(stage, "node_modules/host/package.json", JSON.stringify({ name: "host", version: "1.0.0", dependencies: { inner: "1.0.0" } }));
    await AsarArchiveTests.writeAsync(stage, `${inner}/package.json`, JSON.stringify({ name: "inner", version: "1.0.0", noldovaDesktop: { unpacked: ["jxa/script.js"] } }));
    await AsarArchiveTests.writeAsync(stage, `${inner}/jxa/script.js`, AsarArchiveTests.SCRIPT);
    await AsarArchiveTests.writeAsync(stage, `${inner}/bin/helper`, AsarArchiveTests.ELF);
    const listed = [...ShippedFiles.filter(await NativeBinaries.listAsync(stage), target), ...await UnpackedFiles.listAsync(stage, target)].sort();

    const resources = await AsarArchiveTests.packageAsync(folder.path, stage, PackagedUnpackedFiles.toPatterns(listed));
    const report = await PackagedUnpackedFiles.verifyAsync(resources, path.join(folder.path, "electron-builder.json"));

    Assert.areEqual(JSON.stringify([`${inner}/bin/helper`, `${inner}/jxa/script.js`]), JSON.stringify(listed));
    Assert.areEqual("The installed package keeps outside app.asar, each marked unpacked and readable: node_modules/inner/bin/helper, node_modules/inner/jxa/script.js.", report);
    Assert.areEqual(AsarArchiveTests.SCRIPT, await readFile(path.join(resources, "app.asar.unpacked", "node_modules", "inner", "jxa", "script.js"), "utf8"));
  }

  @TestMethod
  @Timeout(300_000)
  public async shipsExactlyTheKindsOfFilesThatTheUnpackedListKeeps(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const stage = path.join(folder.path, "stage");
    const target = PackageTarget.fromProcess(process.platform, process.arch);
    const modules: Readonly<Record<string, readonly [string, Readonly<Record<string, string>>]>> = {
      "sample": ["1.0.0", { inner: "1.0.0" }], "inner": ["2.0.0", {}], "@scope/sample": ["1.0.0", {}], "keytar": ["1.0.0", {}], "lzma-native": ["1.0.0", {}],
      "libui-node": ["1.0.0", {}], "@scope/libui-node": ["1.0.0", {}], "sample/node_modules/inner": ["1.0.0", {}]
    };
    const direct = Object.entries(modules).filter(([name]) => !name.includes("/node_modules/")).map(([name, [version]]) => [name, version]);
    await AsarArchiveTests.writeAsync(stage, "package.json",
      JSON.stringify({ name: "sample-app", version: "1.0.0", main: "main.js", dependencies: Object.fromEntries(direct) }));
    await AsarArchiveTests.writeAsync(stage, "main.js", "\"use strict\";\n");
    for (const [name, [version, dependencies]] of Object.entries(modules))
      await AsarArchiveTests.writeAsync(stage, `node_modules/${name}/package.json`,
        JSON.stringify({ name: name.split("/node_modules/").at(-1), version, dependencies }));
    for (const file of AsarArchiveTests.KINDS)
      await AsarArchiveTests.writeAsync(stage, file, AsarArchiveTests.ELF);

    const resources = await AsarArchiveTests.packageAsync(folder.path, stage, []);
    const archive = path.join(resources, "app.asar");
    const differences: string[] = [];
    for (const file of AsarArchiveTests.KINDS) {
      const isShipped = !Object.isNull(await AsarArchive.isUnpackedAsync(archive, file.split("/")));
      if (isShipped !== ShippedFiles.isShipped(file, target))
        differences.push(`${file}: electron-builder ${isShipped ? "ships it" : "leaves it out"}`);
    }

    Assert.areEqual(String.empty, differences.join("\n"));
  }

  @TestMethod
  public async readsAFilesTextFromItsOffsetAfterTheHeader(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const archive = await AsarArchiveTests.writeArchiveAsync(folder.path, AsarArchiveTests.HEADER, "hellothe");

    const text = await AsarArchive.readTextAsync(archive, ["c.txt"]);
    const nested = await AsarArchive.readTextAsync(archive, ["a", "b.txt"]);

    Assert.areEqual("the|hello", `${text}|${nested}`);
  }

  @TestMethod
  public async readsNoTextForAFileTheArchiveDoesNotHold(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const archive = await AsarArchiveTests.writeArchiveAsync(folder.path, AsarArchiveTests.HEADER, "hellothe");

    const text = await AsarArchive.readTextAsync(archive, ["a", "missing.txt"]);

    Assert.isNull(text);
  }

  @TestMethod
  public async refusesToReadAFolderAsText(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const archive = await AsarArchiveTests.writeArchiveAsync(folder.path, AsarArchiveTests.HEADER, "hellothe");

    const error = await Assert.throwsAsync(() => AsarArchive.readTextAsync(archive, ["a"]), BuildException);

    Assert.areEqual(`${archive} holds a as no file of its own.`, error.message);
  }

  @TestMethod
  public async refusesAFileThatRunsPastTheArchivesEnd(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const archive = await AsarArchiveTests.writeArchiveAsync(folder.path, { files: { "long.txt": { size: 50, offset: "0" } } }, "short");

    const error = await Assert.throwsAsync(() => AsarArchive.readTextAsync(archive, ["long.txt"]), BuildException);

    Assert.isTrue(error.message.startsWith(`${archive} ends before the 50 bytes at `), error.message);
  }

  @TestMethod
  public async refusesAnArchiveShorterThanItsSizes(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const archive = path.join(folder.path, "app.asar");
    await writeFile(archive, Buffer.alloc(4));

    const error = await Assert.throwsAsync(() => AsarArchive.listFilesAsync(archive), BuildException);

    Assert.areEqual(`${archive} ends before the 8 bytes at 0 that its header names.`, error.message);
  }

  @TestMethod
  public async listsEveryFileByItsPathInOrder(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const archive = await AsarArchiveTests.writeArchiveAsync(folder.path, AsarArchiveTests.HEADER, "hellothe");
    const empty = await AsarArchiveTests.writeArchiveAsync(folder.path, {}, String.empty, "empty.asar");

    const files = await AsarArchive.listFilesAsync(archive);
    const none = await AsarArchive.listFilesAsync(empty);

    Assert.areEqual("a/b.txt,c.txt,d.node", files.join(","));
    Assert.areEqual(0, none.length);
  }

  @TestMethod
  public async tellsAnUnpackedFileFromAPackedOneAndAMissingOne(): Promise<void> {
    await using folder = await AsarArchiveTests.createFolderAsync();
    const archive = await AsarArchiveTests.writeArchiveAsync(folder.path, AsarArchiveTests.HEADER, "hellothe");

    const unpacked = await AsarArchive.isUnpackedAsync(archive, ["d.node"]);
    const packed = await AsarArchive.isUnpackedAsync(archive, ["c.txt"]);
    const missing = await AsarArchive.isUnpackedAsync(archive, ["e.node"]);

    Assert.areEqual("true,false,null", [unpacked, packed, missing].map(t => String(t)).join(","));
  }

  private static async writeArchiveAsync(folder: string, header: object, content: string, name: string = "app.asar"): Promise<string> {
    const json = Buffer.from(JSON.stringify(header));
    const pickle = Buffer.alloc(AsarArchiveTests.PICKLE_PREFIX + json.length);
    pickle.writeUInt32LE(AsarArchiveTests.PICKLE_LENGTH + json.length, 0);
    pickle.writeUInt32LE(json.length, AsarArchiveTests.PICKLE_LENGTH);
    json.copy(pickle, AsarArchiveTests.PICKLE_PREFIX);
    const sizes = Buffer.alloc(AsarArchiveTests.PICKLE_PREFIX);
    sizes.writeUInt32LE(AsarArchiveTests.PICKLE_LENGTH, 0);
    sizes.writeUInt32LE(pickle.length, AsarArchiveTests.PICKLE_LENGTH);
    const archive = path.join(folder, name);
    await writeFile(archive, Buffer.concat([sizes, pickle, Buffer.from(content)]));
    return archive;
  }

  private static async packageAsync(folder: string, stage: string, unpacked: readonly string[]): Promise<string> {
    const require = createRequire(import.meta.url);
    const root = path.resolve(path.dirname(require.resolve("electron/package.json")), "..", "..");
    const electron = new ElectronDistribution(root, path.join(folder, "electron"));
    await electron.copyAsync();
    const output = path.join(folder, "output");
    const configuration = path.join(folder, "electron-builder.json");
    await writeFile(configuration, JSON.stringify({
      appId: "com.example.unpacked",
      productName: "Sample Unpacked",
      directories: { app: stage, output },
      electronDist: electron.folder,
      electronVersion: await electron.readVersionAsync(),
      asar: { smartUnpack: false },
      asarUnpack: unpacked,
      npmRebuild: false,
      nodeGypRebuild: false,
      buildDependenciesFromSource: false,
      publish: null,
      mac: { identity: null },
      win: { signAndEditExecutable: false }
    }));
    await writeFile(path.join(folder, "package.json"), `${JSON.stringify({ type: "commonjs" })}\n`);
    const temporary = path.join(folder, "temporary");
    await mkdir(temporary);
    const environment = {
      ...Object.fromEntries(Object.entries(process.env).filter(([name]) => AsarArchiveTests.BUILDER_VARIABLES.includes(name.toUpperCase()))),
      ...Object.fromEntries(AsarArchiveTests.TEMPORARY_VARIABLES.map(t => [t, temporary]))
    };
    await AsarArchiveTests.runBuilderAsync(path.join(path.dirname(require.resolve("electron-builder/package.json")), "cli.js"), configuration, folder,
      { ...environment, ELECTRON_BUILDER_CACHE: path.join(folder, "cache"), CSC_IDENTITY_AUTO_DISCOVERY: "false" });
    const archives = (await readdir(output, { recursive: true, withFileTypes: true })).filter(t => t.isFile() && t.name === "app.asar");
    Assert.areEqual(1, archives.length, archives.map(t => path.join(t.parentPath, t.name)).join(", "));
    return archives[0]?.parentPath ?? String.empty;
  }

  private static async runBuilderAsync(builder: string, configuration: string, folder: string, environment: NodeJS.ProcessEnv): Promise<void> {
    const child = spawn(process.execPath, [builder, "--dir", "--publish", "never", "--config", configuration],
      { cwd: folder, env: environment, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true });
    const output: string[] = [];
    child.stdout.on("data", (t: Buffer) => output.push(t.toString()));
    child.stderr.on("data", (t: Buffer) => output.push(t.toString()));
    let hasTimedOut = false;
    const timer = setTimeout(() => {
      hasTimedOut = true;
      AsarArchiveTests.endTree(child.pid);
    }, AsarArchiveTests.BUILDER_LIMIT);
    const [code]: unknown[] = await once(child, "close");
    clearTimeout(timer);
    Assert.isFalse(hasTimedOut, `electron-builder did not finish within ${AsarArchiveTests.BUILDER_LIMIT} ms:\n${output.join(String.empty)}`);
    Assert.areEqual(0, code, output.join(String.empty));
  }

  private static endTree(processId: number | undefined): void {
    if (Object.isUndefined(processId))
      return;
    if (process.platform === "win32")
      spawnSync("taskkill", ["/PID", String(processId), "/T", "/F"], { windowsHide: true });
    else
      process.kill(-processId, "SIGKILL");
  }

  private static createPe(): Buffer {
    const file = Buffer.alloc(AsarArchiveTests.PE_OFFSET + 8);
    file.write("MZ", 0, "latin1");
    file.writeUInt32LE(AsarArchiveTests.PE_OFFSET, 0x3c);
    file.write("PE\0\0", AsarArchiveTests.PE_OFFSET, "latin1");
    return file;
  }

  private static async writeAsync(folder: string, file: string, text: string | Buffer): Promise<void> {
    const target = path.join(folder, ...file.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
  }

  private static async createFolderAsync(): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "unpacked-packaging-"));
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }) };
  }
}
