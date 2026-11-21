/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackagedArchitecture } from "../../../src/services/packaging/packaged-architecture.js";
import { FolderFixture } from "../../fixtures/folder.fixture.js";

type Place = "program" | "framework" | "library" | "helperTool" | "helper" | "nestedFramework" | "addon";

@TestClass
export class PackagedArchitectureTests {
  private static readonly ARM64: Buffer = PackagedArchitectureTests.thin(0xfeedfacf, 0x0100000c);
  private static readonly X64: Buffer = PackagedArchitectureTests.thin(0xfeedfacf, 0x01000007);
  private static readonly OTHER: Buffer = PackagedArchitectureTests.thin(0xfeedfacf, 0x00000012);
  private static readonly THIRTY_TWO_BIT: Buffer = PackagedArchitectureTests.thin(0xfeedface, 0x00000007);
  private static readonly UNIVERSAL: Buffer = Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 2]);
  private static readonly JAVA_CLASS: Buffer = Buffer.from([0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 0x34]);
  private static readonly SCRIPT: Buffer = Buffer.from("#!/bin/sh\n");
  private static readonly PLACE_NAMES: readonly Place[] = ["program", "framework", "library", "helperTool", "helper", "nestedFramework", "addon"];
  private static readonly FRAMEWORK: readonly string[] = ["Contents", "Frameworks", "Electron Framework.framework"];
  private static readonly PLACES: Readonly<Record<Place, readonly string[]>> = {
    program: ["Contents", "MacOS", "Sample App"],
    framework: [...PackagedArchitectureTests.FRAMEWORK, "Versions", "A", "Electron Framework"],
    library: [...PackagedArchitectureTests.FRAMEWORK, "Versions", "A", "Libraries", "libffmpeg.dylib"],
    helperTool: [...PackagedArchitectureTests.FRAMEWORK, "Versions", "A", "Helpers", "chrome_crashpad_handler"],
    helper: ["Contents", "Frameworks", "Sample Helper.app", "Contents", "MacOS", "Sample Helper"],
    nestedFramework: ["Contents", "Frameworks", "Sample App Runtime.app", ...PackagedArchitectureTests.FRAMEWORK, "Versions", "A", "Electron Framework"],
    addon: ["Contents", "Resources", "app.asar.unpacked", "native", "darwin-arm64", "posix-process.node"]
  };

  @TestMethod
  public async acceptsABundleWhoseEveryMachOFileIsTheTargetsArchitectureCountingALinkedFileOnce(): Promise<void> {
    await PackagedArchitectureTests.withBundleAsync(PackagedArchitectureTests.ARM64, {}, async application => {
      Assert.areEqual(`Every Mach-O, PE and ELF file in ${application}, 7 in all, is arm64 alone.`, await PackagedArchitecture.verifyAsync(application, "arm64", "macos"));
    });
  }

  @TestMethod
  public async acceptsAnX64BundleWithNoUnpackedFolder(): Promise<void> {
    await PackagedArchitectureTests.withBundleAsync(PackagedArchitectureTests.X64, { addon: null }, async application => {
      Assert.areEqual(`Every Mach-O, PE and ELF file in ${application}, 6 in all, is x64 alone.`, await PackagedArchitecture.verifyAsync(application, "x64", "macos"));
    });
  }

  @TestMethod
  public async refusesAForeignFileWhereverItIsInTheBundle(): Promise<void> {
    for (const place of PackagedArchitectureTests.PLACE_NAMES)
      await PackagedArchitectureTests.withBundleAsync(PackagedArchitectureTests.ARM64, { [place]: PackagedArchitectureTests.X64 }, async application => {
        const file = path.join(application, ...PackagedArchitectureTests.PLACES[place]);
        Assert.areEqual(`The file ${file} is x64, not an arm64-only Mach-O file, so it would not run natively on arm64.`,
          await PackagedArchitectureTests.messageAsync(application, "arm64", "macos"), place);
      });
  }

  @TestMethod
  public async refusesAUniversalA32BitAndAnotherProcessorsFile(): Promise<void> {
    const cases: readonly (readonly [Buffer, string])[] = [
      [PackagedArchitectureTests.UNIVERSAL, "a universal Mach-O file"],
      [PackagedArchitectureTests.THIRTY_TWO_BIT, "a 32-bit Mach-O file"],
      [PackagedArchitectureTests.OTHER, "a Mach-O file for CPU type 0x12"]
    ];
    for (const [data, found] of cases)
      await PackagedArchitectureTests.withBundleAsync(PackagedArchitectureTests.ARM64, { library: data }, async application => {
        const file = path.join(application, ...PackagedArchitectureTests.PLACES.library);
        Assert.areEqual(`The file ${file} is ${found}, not an arm64-only Mach-O file, so it would not run natively on arm64.`,
          await PackagedArchitectureTests.messageAsync(application, "arm64", "macos"));
      });
  }

  @TestMethod
  public async refusesAnArchitectureItCannotRecognise(): Promise<void> {
    await PackagedArchitectureTests.withBundleAsync(PackagedArchitectureTests.ARM64, {}, async application => {
      Assert.areEqual("The package's architecture ia32 is none of arm64, x64.", await PackagedArchitectureTests.messageAsync(application, "ia32", "windows"));
    });
  }

  @TestMethod
  public async acceptsWindowsAndLinuxFilesOfTheTargetsArchitectureAndPassesOverOtherFiles(): Promise<void> {
    await PackagedArchitectureTests.withFolderAsync({
      "Sample.exe": PackagedArchitectureTests.pe(0xaa64),
      "resources/app.asar.unpacked/node_modules/node-pty/prebuilds/win32-arm64/pty.node": PackagedArchitectureTests.pe(0xaa64),
      "sample-app": PackagedArchitectureTests.elf(2, 1, 183),
      "libffmpeg.so": PackagedArchitectureTests.elf(2, 1, 183),
      "MZ.txt": Buffer.from("MZ is not a program"),
      "dos.com": PackagedArchitectureTests.dos(),
      "resources/app.asar": Buffer.from("sample")
    }, async folder => {
      Assert.areEqual(`Every Mach-O, PE and ELF file in ${folder}, 4 in all, is arm64 alone.`, await PackagedArchitecture.verifyAsync(folder, "arm64", "linux"));
    });
  }

  @TestMethod
  public async refusesAWindowsOrLinuxFileOfAnotherArchitecture(): Promise<void> {
    const cases: readonly (readonly [Buffer, string, string])[] = [
      [PackagedArchitectureTests.pe(0x8664), "x64", "PE"],
      [PackagedArchitectureTests.pe(0x14c), "x86", "PE"],
      [PackagedArchitectureTests.pe(0x1c4), "a PE file for machine 0x1c4", "PE"],
      [PackagedArchitectureTests.elf(2, 1, 62), "x64", "ELF"],
      [PackagedArchitectureTests.elf(2, 1, 40), "an ELF file for machine 40", "ELF"],
      [PackagedArchitectureTests.elf(1, 1, 40), "a 32-bit ELF file", "ELF"],
      [PackagedArchitectureTests.elf(2, 2, 183), "a big-endian ELF file", "ELF"]
    ];
    for (const [data, found, kind] of cases)
      await PackagedArchitectureTests.withFolderAsync({ "Sample.exe": PackagedArchitectureTests.pe(0xaa64), "bin/foreign": data }, async folder => {
        Assert.areEqual(`The file ${path.join(folder, "bin", "foreign")} is ${found}, not an arm64-only ${kind} file, so it would not run natively on arm64.`,
          await PackagedArchitectureTests.messageAsync(folder, "arm64", "linux"), found);
      });
  }

  @TestMethod
  public async acceptsOnAWindowsTargetEveryPeMachineWindowsRunsThere(): Promise<void> {
    const cases: readonly (readonly [string, Readonly<Record<string, Buffer>>, string])[] = [
      ["x64", { "Sample.exe": PackagedArchitectureTests.pe(0x8664), "resources/git/mingw64/bin/git.exe": PackagedArchitectureTests.pe(0x8664),
        "resources/git/usr/libexec/getprocaddr32.exe": PackagedArchitectureTests.pe(0x14c) }, "3 in all, is one Windows runs on x64, which runs x64, x86: 2 x64, 1 x86."],
      ["x64", { "Sample.exe": PackagedArchitectureTests.pe(0x8664) }, "1 in all, is one Windows runs on x64, which runs x64, x86: 1 x64."],
      ["arm64", { "Sample.exe": PackagedArchitectureTests.pe(0xaa64), "resources/git/usr/bin/ssh.exe": PackagedArchitectureTests.pe(0x8664),
        "resources/git/usr/bin/getprocaddr64.exe": PackagedArchitectureTests.pe(0x8664), "resources/git/usr/libexec/getprocaddr32.exe": PackagedArchitectureTests.pe(0x14c),
        "sample-app": PackagedArchitectureTests.elf(2, 1, 183) }, "5 in all, is one Windows runs on arm64, which runs arm64, x64, x86: 2 arm64, 2 x64, 1 x86."],
      ["arm64", { "README.txt": Buffer.from("no programs") }, "0 in all, is one Windows runs on arm64, which runs arm64, x64, x86: none."]
    ];
    for (const [architecture, files, verified] of cases)
      await PackagedArchitectureTests.withFolderAsync(files, async folder => {
        Assert.areEqual(`Every Mach-O, PE and ELF file in ${folder}, ${verified}`, await PackagedArchitecture.verifyAsync(folder, architecture, "windows"), verified);
      });
  }

  @TestMethod
  public async refusesOnAWindowsTargetAMachineWindowsDoesNotRunThereAndAnyOtherKindOfAnotherArchitecture(): Promise<void> {
    const cases: readonly (readonly [string, Buffer, string])[] = [
      ["x64", PackagedArchitectureTests.pe(0xaa64), "is arm64, not a PE file that Windows runs on x64, which runs x64, x86."],
      ["x64", PackagedArchitectureTests.pe(0x1c4), "is a PE file for machine 0x1c4, not a PE file that Windows runs on x64, which runs x64, x86."],
      ["arm64", PackagedArchitectureTests.pe(0x1c4), "is a PE file for machine 0x1c4, not a PE file that Windows runs on arm64, which runs arm64, x64, x86."],
      ["x64", PackagedArchitectureTests.elf(2, 1, 183), "is arm64, not an x64-only ELF file, so it would not run natively on x64."],
      ["arm64", PackagedArchitectureTests.elf(2, 1, 62), "is x64, not an arm64-only ELF file, so it would not run natively on arm64."],
      ["arm64", PackagedArchitectureTests.X64, "is x64, not an arm64-only Mach-O file, so it would not run natively on arm64."]
    ];
    for (const [architecture, data, refused] of cases)
      await PackagedArchitectureTests.withFolderAsync({ "Sample.exe": PackagedArchitectureTests.pe(architecture === "x64" ? 0x8664 : 0xaa64), "bin/foreign": data }, async folder => {
        Assert.areEqual(`The file ${path.join(folder, "bin", "foreign")} ${refused}`, await PackagedArchitectureTests.messageAsync(folder, architecture, "windows"), refused);
      });
  }

  @TestMethod
  public async keepsAWindowsPackagesRootFilesAndNativeModulesToItsOwnArchitecture(): Promise<void> {
    const cases: readonly (readonly [string, string, number, string])[] = [
      ["arm64", "Sample.exe", 0x8664, "x64"],
      ["arm64", "ffmpeg.dll", 0x14c, "x86"],
      ["arm64", "resources/app.asar.unpacked/node_modules/node-pty/prebuilds/win32-x64/pty.node", 0x8664, "x64"],
      ["x64", "Sample.exe", 0x14c, "x86"],
      ["x64", "resources/app.asar.unpacked/native/win32-x64/posix-process.node", 0x14c, "x86"]
    ];
    for (const [architecture, name, machine, found] of cases)
      await PackagedArchitectureTests.withFolderAsync({ "resources/git/usr/bin/sh.exe": PackagedArchitectureTests.pe(0x8664), [name]: PackagedArchitectureTests.pe(machine) },
        async folder => {
          Assert.areEqual(`The file ${path.join(folder, ...name.split("/"))} is ${found}, not an ${architecture}-only PE file, so it would not run natively on ${architecture}.`,
            await PackagedArchitectureTests.messageAsync(folder, architecture, "windows"), name);
        });
  }

  @TestMethod
  public async keepsMacosAndLinuxTargetsToTheirOwnPeMachine(): Promise<void> {
    for (const platform of ["macos", "linux"])
      for (const [machine, found] of [[0x8664, "x64"], [0x14c, "x86"]] as const)
        await PackagedArchitectureTests.withFolderAsync({ "bin/tool.exe": PackagedArchitectureTests.pe(machine) }, async folder => {
          Assert.areEqual(`The file ${path.join(folder, "bin", "tool.exe")} is ${found}, not an arm64-only PE file, so it would not run natively on arm64.`,
            await PackagedArchitectureTests.messageAsync(folder, "arm64", platform), `${platform} ${found}`);
        });
  }

  private static pe(machine: number): Buffer {
    const file = Buffer.alloc(0x90);
    file.writeUInt16LE(0x5a4d, 0);
    file.writeUInt32LE(0x80, 0x3c);
    file.writeUInt32LE(0x00004550, 0x80);
    file.writeUInt16LE(machine, 0x84);
    return file;
  }

  private static dos(): Buffer {
    const file = Buffer.alloc(0x90);
    file.writeUInt16LE(0x5a4d, 0);
    file.writeUInt32LE(0x1000, 0x3c);
    return file;
  }

  private static elf(fileClass: number, data: number, machine: number): Buffer {
    const header = Buffer.alloc(64);
    header.writeUInt32LE(0x464c457f, 0);
    header[4] = fileClass;
    header[5] = data;
    header.writeUInt16LE(machine, 18);
    return header;
  }

  private static async withFolderAsync(files: Readonly<Record<string, Buffer>>, run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "packaged-architecture-"));
    try {
      for (const [name, data] of Object.entries(files)) {
        const file = path.join(folder, ...name.split("/"));
        await FolderFixture.ensureAsync(path.dirname(file));
        await writeFile(file, data);
      }
      await run(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static thin(magic: number, type: number): Buffer {
    const header = Buffer.alloc(32);
    header.writeUInt32LE(magic, 0);
    header.writeUInt32LE(type, 4);
    return header;
  }

  private static async messageAsync(application: string, architecture: string, platform: string): Promise<string> {
    let error: unknown = null;
    try {
      await PackagedArchitecture.verifyAsync(application, architecture, platform);
    }
    catch (thrown) {
      error = thrown;
    }
    Assert.isTrue(error instanceof BuildException, String(error));
    return error instanceof Error ? error.message : String(error);
  }

  private static async withBundleAsync(native: Buffer, files: Partial<Record<Place, Buffer | null>>, run: (application: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "packaged-architecture-"));
    try {
      const application = path.join(folder, "Sample App.app");
      const write = async (segments: readonly string[], data: Buffer): Promise<void> => {
        const file = path.join(application, ...segments);
        await FolderFixture.ensureAsync(path.dirname(file));
        await writeFile(file, data);
      };
      for (const place of PackagedArchitectureTests.PLACE_NAMES) {
        const data = files[place];
        if (!Object.isNull(data))
          await write(PackagedArchitectureTests.PLACES[place], data ?? native);
      }
      await write(["Contents", "Frameworks", "Sample Helper.app", "Contents", "Info.plist"], PackagedArchitectureTests.SCRIPT);
      await write(["Contents", "Resources", "bin", "sample-app"], PackagedArchitectureTests.SCRIPT);
      await write(["Contents", "Resources", "Sample.class"], PackagedArchitectureTests.JAVA_CLASS);
      await write(["Contents", "Resources", "empty.pak"], Buffer.alloc(0));
      const framework = path.join(application, ...PackagedArchitectureTests.FRAMEWORK);
      await symlink(path.join(framework, "Versions", "A"), path.join(framework, "Versions", "Current"), "junction");
      await run(application);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
