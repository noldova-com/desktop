/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  AddonIncompleteException, AddonUnexpectedValueException, CommandFailedException, FolderNotPrivateException, FolderProtectorFactory, MacFolderProtector, SystemCommand
} from "@noldova/desktop.runtime";

import type { IPosixProcessAddon } from "../../../src/interfaces/i-posix-process-addon.js";
import { NativeAddon } from "../../../src/services/native/native-addon.js";
import { AddonModuleFixture } from "../../fixtures/addon-module.fixture.js";
import { MacListingFixture } from "../../fixtures/mac-listing.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { SystemCommandFixture } from "../../fixtures/system-command.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class MacFolderProtectorTests {
  private static readonly KEPT_VOLUME: string = "{ calls: [], readVolume(...values) { this.calls.push(values); return ['/System/Volumes/Data', false]; } }";
  private static readonly IGNORED: string = "the volume /Volumes/Shared is mounted with ownership ignored, so every account acts as the owner of its files";
  private static readonly DETACH_ATTEMPTS: number = 5;
  private static readonly DETACH_PAUSE_MILLISECONDS: number = 1000;
  private static readonly COMMAND_LIMIT_MILLISECONDS: number = 20_000;
  private static readonly HOLDER_PROCESS: RegExp = /diskimage|mds|mdworker|fseventsd|fsck|diskarbitration|hdiutil|diskutil/u;
  private static readonly IMAGE_ENTRIES: RegExp = /^=+$/mu;
  private static readonly WHOLE_DISK: RegExp = /^(\/dev\/disk\d+)\s/mu;

  private static volumes(fake: AddonModuleFixture, functions: readonly (keyof IPosixProcessAddon)[] = ["readVolume"]): NativeAddon<IPosixProcessAddon> {
    return new NativeAddon<IPosixProcessAddon>(fake.file, functions);
  }

  private static async detachAsync(disk: string, mountPoint: string): Promise<void> {
    const failures: string[] = [];
    for (let attempt = 1; attempt <= MacFolderProtectorTests.DETACH_ATTEMPTS; attempt++) {
      if (attempt > 1)
        await setTimeout(MacFolderProtectorTests.DETACH_PAUSE_MILLISECONDS);
      const result = MacFolderProtectorTests.run("/usr/bin/hdiutil", ["detach", "-force", disk]);
      if (result.status === 0)
        return;
      failures.push(`attempt ${attempt}: ${result.text}`);
    }
    throw new Error(`hdiutil could not detach ${disk} in ${MacFolderProtectorTests.DETACH_ATTEMPTS} attempts:\n${failures.join("\n")}\n`
      + `What held ${disk} or ${mountPoint} then:\n${MacFolderProtectorTests.readHolders(disk, mountPoint)}`);
  }

  // What has the disk or its mount point open, the processes that usually do, and hdiutil's entry for the disk; a command
  // that fails, stalls past its limit or can't start says so in place of its output.
  private static readHolders(disk: string, mountPoint: string): string {
    const targets = disk === mountPoint ? [mountPoint] : [mountPoint, disk];
    const asRoot = MacFolderProtectorTests.run("/usr/bin/sudo", ["-n", "/usr/sbin/lsof", "-n", ...targets]);
    const open = asRoot.text.includes("sudo:") ? MacFolderProtectorTests.run("/usr/sbin/lsof", ["-n", ...targets]) : asRoot;
    const processes = MacFolderProtectorTests.run("/bin/ps", ["-axo", "pid,ppid,etime,stat,comm"]);
    const images = MacFolderProtectorTests.run("/usr/bin/hdiutil", ["info"]);
    const device = new RegExp(`^${disk}(?:s\\d+)?\\s`, "mu");
    return [
      `lsof ${targets.join(" ")}: ${open.text}`,
      processes.status === 0 ? processes.output.split("\n").filter(t => MacFolderProtectorTests.HOLDER_PROCESS.test(t)).join("\n") : `ps: ${processes.text}`,
      images.status === 0 ? images.output.split(MacFolderProtectorTests.IMAGE_ENTRIES).filter(t => t.includes(mountPoint) || device.test(t)).join("\n") : `hdiutil info: ${images.text}`
    ].join("\n");
  }

  // Runs a command for at most the limit, giving its exit status, its output, and a text naming how it ended, a time-out
  // or a failure to start included, followed by everything it wrote.
  private static run(file: string, commandArguments: readonly string[]): { readonly status: number | null; readonly output: string; readonly text: string } {
    const result = spawnSync(file, commandArguments, { encoding: "utf8", timeout: MacFolderProtectorTests.COMMAND_LIMIT_MILLISECONDS, killSignal: "SIGKILL" });
    const ending = result.error === undefined
      ? `exit ${String(result.status)}, signal ${String(result.signal)}`
      : `${result.error.message}${result.signal === null ? "" : `, ended by ${result.signal} at the ${MacFolderProtectorTests.COMMAND_LIMIT_MILLISECONDS} ms limit`}`;
    return { status: result.status, output: result.stdout, text: `${ending}\n${result.stdout}${result.stderr}` };
  }

  @TestMethod
  @TestData("drwx------  2 person  staff  64 Oct 16 12:00 /Users/person/discovery\n")
  @TestData(`${MacListingFixture.HEADER}\n 0: group:everyone deny delete\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: user:person inherited allow list,add_file,search,delete_child\n 1: group:staff inherited deny read\n`)
  @TestData(`${MacListingFixture.ATTRIBUTES_HEADER}\n`)
  public async passesAFolderOnlyThePersonCanReach(listing: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await chmod(folder.path, 0o755);
    await using fake = await AddonModuleFixture.createAsync(MacFolderProtectorTests.KEPT_VOLUME);
    const command = new SystemCommandFixture([listing]);

    await new MacFolderProtector(command, MacFolderProtectorTests.volumes(fake), "person").protectAsync(folder.path);

    Assert.areEqual(`/bin/ls -led ${folder.path}`, command.calls.map(t => t.join(" ")).join(";"));
    Assert.areEqual(JSON.stringify([[folder.path]]), JSON.stringify(createRequire(import.meta.url)(fake.file).calls));
    if (process.platform !== "win32")
      Assert.areEqual(0o700, (await stat(folder.path)).mode & 0o777);
  }

  @TestMethod
  @TestData(`${MacListingFixture.HEADER}\n 0: group:everyone inherited allow list,search\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: user:visitor allow read\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: group:Domain Users allow list\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: user:person allow list\n 1: an entry ls never writes\n`)
  @TestData("drwxrwxrwx  2 person  staff  64 Oct 16 12:00 /Volumes/Shared/discovery\n")
  @TestData(`${MacListingFixture.HEADER}\n`)
  @TestData(`${MacListingFixture.HEADER}\n entries in a form ls never writes\n`)
  @TestData(`${MacListingFixture.HEADER}\n 0: user:person allow list\n entries in a form ls never writes\n`)
  @TestData(`${MacListingFixture.ATTRIBUTES_HEADER}\n entries in a form ls never writes\n`)
  @TestData(`${MacListingFixture.ATTRIBUTES_HEADER}\n 0: user:visitor allow read\n`)
  public async refusesAFolderStillOpenToAnyoneElse(listing: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using fake = await AddonModuleFixture.createAsync(MacFolderProtectorTests.KEPT_VOLUME);

    const exception = await Assert.throwsAsync(
      () => new MacFolderProtector(new SystemCommandFixture([listing]), MacFolderProtectorTests.volumes(fake), "person").protectAsync(folder.path),
      FolderNotPrivateException);

    Assert.areEqual(`The folder ${folder.path} is still open to others: ${listing.trim()}`, exception.message);
  }

  @TestMethod
  public async refusesAFolderOnAVolumeThatIgnoresOwnership(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await chmod(folder.path, 0o755);
    await using fake = await AddonModuleFixture.createAsync("{ calls: [], readVolume(...values) { this.calls.push(values); return ['/Volumes/Shared', true]; } }");
    const command = new SystemCommandFixture([`${MacListingFixture.HEADER}\n`]);

    const exception = await Assert.throwsAsync(
      () => new MacFolderProtector(command, MacFolderProtectorTests.volumes(fake), "person").protectAsync(folder.path),
      FolderNotPrivateException);

    Assert.areEqual(`The folder ${folder.path} is still open to others: ${MacFolderProtectorTests.IGNORED}`, exception.message);
    Assert.areEqual(folder.path, exception.folder);
    Assert.areEqual(MacFolderProtectorTests.IGNORED, exception.access);
    Assert.areEqual(JSON.stringify([[folder.path]]), JSON.stringify(createRequire(import.meta.url)(fake.file).calls));
    Assert.areEqual(0, command.calls.length);
    if (process.platform !== "win32")
      Assert.areEqual(0o755, (await stat(folder.path)).mode & 0o777);
  }

  @TestMethod
  @TestData("null")
  @TestData("['/Volumes/Shared']")
  @TestData("['/Volumes/Shared', 'true']")
  @TestData("[7, false]")
  @TestData("['/Volumes/Shared', false, 0]")
  public async reportsAVolumeTheAddonCannotDescribe(volume: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using fake = await AddonModuleFixture.createAsync(`{ readVolume: () => ${volume} }`);
    const command = new SystemCommandFixture([]);

    await Assert.throwsAsync(() => new MacFolderProtector(command, MacFolderProtectorTests.volumes(fake), "person").protectAsync(folder.path), AddonUnexpectedValueException);

    Assert.areEqual(0, command.calls.length);
  }

  @TestMethod
  public async reportsAVolumeThatCannotBeRead(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using fake = await AddonModuleFixture.createAsync("{ readVolume: () => { throw new Error('statfs failed: Permission denied'); } }");

    const exception = await Assert.throwsAsync(() => new MacFolderProtector(new SystemCommandFixture([]), MacFolderProtectorTests.volumes(fake), "person").protectAsync(folder.path), Error);

    Assert.areEqual("statfs failed: Permission denied", exception.message);
  }

  @TestMethod
  public async reportsAnAddonWithoutTheVolumeCall(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using fake = await AddonModuleFixture.createAsync("{ readEnvironment: () => [] }");

    await Assert.throwsAsync(() => new MacFolderProtector(new SystemCommandFixture([]), MacFolderProtectorTests.volumes(fake, []), "person").protectAsync(folder.path), AddonIncompleteException);
  }

  @TestMethod
  public async reportsAListingThatFails(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using fake = await AddonModuleFixture.createAsync(MacFolderProtectorTests.KEPT_VOLUME);
    const failure = new CommandFailedException("ls", new Error("Operation not permitted"));

    const exception = await Assert.throwsAsync(() => new MacFolderProtector(new SystemCommandFixture([failure]), MacFolderProtectorTests.volumes(fake)).protectAsync(folder.path), CommandFailedException);

    Assert.areEqual(failure, exception);
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async refusesARealFolderWithAnInheritedEntryAndPassesAPlainOne(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const shared = path.join(folder.path, "shared");
    const plain = path.join(folder.path, "plain");
    await mkdir(shared);
    await mkdir(plain);
    execFileSync("/bin/chmod", ["+a", "group:everyone allow list,search,file_inherit,directory_inherit", shared]);
    const inheriting = path.join(shared, "discovery");
    await mkdir(inheriting);
    const before = execFileSync("/bin/ls", ["-led", inheriting], { encoding: "utf8" });

    const protector = FolderProtectorFactory.create("darwin", new SystemCommand(), {});

    const exception = await Assert.throwsAsync(() => protector.protectAsync(inheriting), FolderNotPrivateException);
    await protector.protectAsync(plain);

    Assert.isTrue(before.includes("group:everyone inherited allow"), before);
    Assert.isTrue(exception.message.includes("group:everyone inherited allow"), exception.message);
    Assert.areEqual(0o700, (await stat(plain)).mode & 0o777);
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async refusesAFolderOnARealVolumeMountedWithOwnershipIgnored(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const image = path.join(folder.path, "shared.dmg");
    const mountPoint = path.join(folder.path, "shared");
    await mkdir(mountPoint);
    execFileSync("/usr/bin/hdiutil", ["create", "-quiet", "-size", "8m", "-fs", "HFS+", "-volname", "Shared", image]);
    const attached = execFileSync("/usr/bin/hdiutil", ["attach", "-nobrowse", "-owners", "off", "-mountpoint", mountPoint, image], { encoding: "utf8" });
    const disk = MacFolderProtectorTests.WHOLE_DISK.exec(attached)?.[1];
    try {
      if (Object.isUndefined(disk))
        throw new Error(`hdiutil attach printed no whole disk's device:\n${attached}`);
      const discovery = path.join(mountPoint, "discovery");
      await mkdir(discovery);

      const exception = await Assert.throwsAsync(() => FolderProtectorFactory.create("darwin", new SystemCommand(), {}).protectAsync(discovery), FolderNotPrivateException);

      Assert.areEqual(`the volume ${await realpath(mountPoint)} is mounted with ownership ignored, so every account acts as the owner of its files`, exception.access);
    } finally {
      await MacFolderProtectorTests.detachAsync(disk ?? mountPoint, mountPoint);
    }
  }
}
