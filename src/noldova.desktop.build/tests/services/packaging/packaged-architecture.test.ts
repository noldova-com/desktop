/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackagedArchitecture } from "../../../src/services/packaging/packaged-architecture.js";

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
      Assert.areEqual(`Every Mach-O file in ${application}, 7 in all, is arm64 alone.`, await PackagedArchitecture.verifyAsync(application, "arm64"));
    });
  }

  @TestMethod
  public async acceptsAnX64BundleWithNoUnpackedFolder(): Promise<void> {
    await PackagedArchitectureTests.withBundleAsync(PackagedArchitectureTests.X64, { addon: null }, async application => {
      Assert.areEqual(`Every Mach-O file in ${application}, 6 in all, is x64 alone.`, await PackagedArchitecture.verifyAsync(application, "x64"));
    });
  }

  @TestMethod
  public async refusesAForeignFileWhereverItIsInTheBundle(): Promise<void> {
    for (const place of PackagedArchitectureTests.PLACE_NAMES)
      await PackagedArchitectureTests.withBundleAsync(PackagedArchitectureTests.ARM64, { [place]: PackagedArchitectureTests.X64 }, async application => {
        const file = path.join(application, ...PackagedArchitectureTests.PLACES[place]);
        Assert.areEqual(`The installed ${file} is x64, not an arm64-only Mach-O file, so it would not run natively on arm64.`,
          await PackagedArchitectureTests.messageAsync(application, "arm64"), place);
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
        Assert.areEqual(`The installed ${file} is ${found}, not an arm64-only Mach-O file, so it would not run natively on arm64.`,
          await PackagedArchitectureTests.messageAsync(application, "arm64"));
      });
  }

  @TestMethod
  public async refusesAnArchitectureItCannotRecognise(): Promise<void> {
    await PackagedArchitectureTests.withBundleAsync(PackagedArchitectureTests.ARM64, {}, async application => {
      Assert.areEqual("The package's architecture ia32 is none of arm64, x64.", await PackagedArchitectureTests.messageAsync(application, "ia32"));
    });
  }

  private static thin(magic: number, type: number): Buffer {
    const header = Buffer.alloc(32);
    header.writeUInt32LE(magic, 0);
    header.writeUInt32LE(type, 4);
    return header;
  }

  private static async messageAsync(application: string, architecture: string): Promise<string> {
    let error: unknown = null;
    try {
      await PackagedArchitecture.verifyAsync(application, architecture);
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
        await mkdir(path.dirname(file), { recursive: true });
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
