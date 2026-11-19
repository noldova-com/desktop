/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { devNull } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  AddonIncompleteException,
  AddonUnexpectedValueException,
  type IPosixProcessAddon,
  NativeAddon,
  PosixProcessApi,
  ProcessTableRowUnreadableException
} from "@noldova/desktop.runtime";

import { AddonModuleFixture } from "../../fixtures/addon-module.fixture.js";
import { ErrorCodeFixture } from "../../fixtures/error-code.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class PosixProcessApiTests {
  @TestMethod
  public async passesTheStartToTheAddonAndReturnsTheProcessId(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ calls: [], startDetached(...values) { this.calls.push(values); return 4321; } }");

    const processId = new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["startDetached"])).startDetached("/opt/tool/tool", ["--quiet"], ["HOME=/home/person"], 7);

    Assert.areEqual(4_321, processId);
    Assert.areEqual("[[\"/opt/tool/tool\",[\"--quiet\"],[\"HOME=/home/person\"],7]]", JSON.stringify(createRequire(import.meta.url)(fake.file).calls));
  }

  @TestMethod
  public async passesTheWorkingFolderDescriptorsAndDisclaimUpToTheLastOneGiven(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ calls: [], startDetached(...values) { this.calls.push(values); return 4321; } }");
    const api = new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["startDetached"]));

    api.startDetached("/opt/tool/tool", [], [], 7, "/home/person");
    api.startDetached("/opt/tool/tool", [], [], 7, undefined, 8);
    api.startDetached("/opt/tool/tool", [], [], 7, undefined, undefined, 9);
    api.startDetached("/opt/tool/tool", [], [], 7, undefined, undefined, undefined, "responsibility_spawnattrs_setdisclaim");

    Assert.areEqual(
      "[[\"/opt/tool/tool\",[],[],7,\"/home/person\"],[\"/opt/tool/tool\",[],[],7,null,8],[\"/opt/tool/tool\",[],[],7,null,null,9],[\"/opt/tool/tool\",[],[],7,null,null,null,\"responsibility_spawnattrs_setdisclaim\"]]",
      JSON.stringify(createRequire(import.meta.url)(fake.file).calls));
  }

  @TestMethod
  @TestData("0")
  @TestData("-1")
  @TestData("1.5")
  @TestData("'4321'")
  public async refusesAProcessIdThatIsNotAPositiveInteger(value: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(`{ startDetached: () => ${value} }`);

    Assert.throws(() => new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["startDetached"])).startDetached("/opt/tool/tool", [], [], 7), AddonUnexpectedValueException);
  }

  @TestMethod
  public async refusesAnAddonThatLacksTheFunctionItCalls(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{}");
    const addon = new NativeAddon<IPosixProcessAddon>(fake.file, []);

    const start = Assert.throws(() => new PosixProcessApi(addon).startDetached("/opt/tool/tool", [], [], 7), AddonIncompleteException);
    await Assert.throwsAsync(() => new PosixProcessApi(addon, "darwin").listProcessesAsync(), AddonIncompleteException);
    await Assert.throwsAsync(() => new PosixProcessApi(addon, "linux").listProcessesAsync(), AddonIncompleteException);

    Assert.areEqual(`The runtime's addon native/${AddonModuleFixture.TARGET}/fake-addon.cjs lacks functions this runtime calls; it comes from another build.`, start.message);
  }

  @TestMethod
  public async listsTheProcessesTheAddonReturnsOutsideLinux(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ listProcesses: () => [[4120, 1, 4120, 0, 1500000.5, 0], [4188, 4120, 4188, 16777216, 1600000, 1]] }");

    const rows = await new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["listProcesses"]), "darwin").listProcessesAsync();

    Assert.areEqual("[[4120,1,4120,0,1500000.5,0],[4188,4120,4188,16777216,1600000,1]]", JSON.stringify(rows));
  }

  @TestMethod
  @TestData("{}")
  @TestData("[[4120, 1, 4120, 0, 1500000]]")
  @TestData("[[4120, 1, 4120, 0, 1500000, '0']]")
  @TestData("[[4120, 1, 4120, 0, Infinity, 0]]")
  @TestData("[7]")
  public async refusesAProcessListThatIsNotRowsOfSixNumbers(value: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(`{ listProcesses: () => ${value} }`);

    await Assert.throwsAsync(() => new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["listProcesses"]), "darwin").listProcessesAsync(), AddonUnexpectedValueException);
  }

  @TestMethod
  public async readsEachNumberedFolderOfTheProcessFolderOnLinuxInMillisecondsSinceBoot(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ clockTicks: () => 250 }");
    await using folder = await TemporaryFolderFixture.createAsync();
    await PosixProcessApiTests.writeStatAsync(folder.path, "4120", "4120 (a) b) (c) S 1 4120 4120 34816 4120 4194560 1 0 0 0 0 0 0 0 20 0 1 0 12345 0");
    await PosixProcessApiTests.writeStatAsync(folder.path, "4188", "4188 (tool) S 4120 4188 4120 0 -1 4194560 1 0 0 0 0 0 0 0 20 0 1 0 12346 0\n");
    await PosixProcessApiTests.writeStatAsync(folder.path, "4190", "4190 (gone) Z 4188 4188 4120 0 -1 4194564 1 0 0 0 0 0 0 0 20 0 1 0 12347 0");
    await PosixProcessApiTests.writeStatAsync(folder.path, "self", "not a row");
    await mkdir(path.join(folder.path, "4999"));

    const rows = await new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["clockTicks"]), "linux", folder.path).listProcessesAsync();

    Assert.areEqual("[[4120,1,4120,34816,49380,0],[4188,4120,4188,0,49384,0],[4190,4188,4188,0,49388,1]]", JSON.stringify([...rows].sort((a, b) => a[0] - b[0])));
  }

  @TestMethod
  @TestData("4120 1 1 4120 4120 0 4120 0 1 0 0 0 0 0 0 0 20 0 1 0 12345 0")
  @TestData("4120 (tool) S 1 4120 4120 0 4120 0 1 0 0 0 0 0 0 0 20 0 1 0")
  @TestData("4120 (tool) S 1 4120 4120 -1 4120 0 1 0 0 0 0 0 0 0 20 0 1 0 12345 0")
  public async refusesAStatFileItCannotReadOnLinux(text: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ clockTicks: () => 100 }");
    await using folder = await TemporaryFolderFixture.createAsync();
    await PosixProcessApiTests.writeStatAsync(folder.path, "4120", text);

    const error = await Assert.throwsAsync(() => new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["clockTicks"]), "linux", folder.path).listProcessesAsync(), ProcessTableRowUnreadableException);

    Assert.areEqual(`The process table has a row that could not be read: ${text}`, error.message);
  }

  @TestMethod
  public async passesOnAFailureToReadAStatFileOtherThanItsProcessEndingOnLinux(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ clockTicks: () => 100 }");
    await using folder = await TemporaryFolderFixture.createAsync();
    await mkdir(path.join(folder.path, "4120", "stat"), { recursive: true });

    const error = await Assert.throwsAsync(() => new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["clockTicks"]), "linux", folder.path).listProcessesAsync(), Error);

    Assert.areEqual("EISDIR", ErrorCodeFixture.of(error));
  }

  @TestMethod
  @TestData("0")
  @TestData("2.5")
  @TestData("'100'")
  public async refusesClockTicksThatAreNotAPositiveIntegerOnLinux(value: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(`{ clockTicks: () => ${value} }`);
    await using folder = await TemporaryFolderFixture.createAsync();

    await Assert.throwsAsync(() => new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["clockTicks"]), "linux", folder.path).listProcessesAsync(), AddonUnexpectedValueException);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async listsItsOwnProcessWithItsParent(): Promise<void> {
    const rows = await PosixProcessApi.create().listProcessesAsync();

    const own = rows.find(t => t[0] === process.pid);
    Assert.isDefined(own);
    Assert.areEqual(process.ppid, own[1]);
    Assert.isTrue(rows.length > 1);
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async listsAnotherUsersProcessWithItsStartTimeOnMacOS(): Promise<void> {
    const before = Date.now();

    const launchd = (await PosixProcessApi.create().listProcessesAsync()).find(t => t[0] === 1);

    Assert.isDefined(launchd);
    Assert.areEqual(0, launchd[1]);
    Assert.isTrue(launchd[4] > 0 && launchd[4] < before, String(launchd[4]));
    Assert.areEqual(0, launchd[5] ?? 0);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async listsAProcessThatEndedUnreapedAsAZombieOnLinuxAndLeavesItOutOnMacOS(): Promise<void> {
    const parent = spawn("/bin/sh", ["-c", "sleep 0.1 & echo $!; exec sleep 30"], { stdio: ["ignore", "pipe", "ignore"] });
    try {
      const [output]: unknown[] = await once(parent.stdout, "data");
      const child = Number(String(output).trim());
      const findAsync = async (): Promise<readonly [number, number, number, number, number, number?] | undefined> =>
        (await PosixProcessApi.create().listProcessesAsync()).find(t => t[0] === child);
      const hasEnded = await WaitFixture.untilAsync(async () => {
        const listed = await findAsync();
        return Object.isUndefined(listed) || listed[5] === 1;
      }, 9_000, 100);
      const row = await findAsync();

      Assert.isTrue(hasEnded, "The program's child did not end within 9 s.");
      Assert.isTrue(PosixProcessApiTests.isRunning(child));
      Assert.areEqual(process.platform === "linux" ? "1" : "left out", Object.isUndefined(row) ? "left out" : String(row[5]));
    }
    finally {
      parent.kill();
    }
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public refusesMoreArgumentsThanItTakesToStartAProgram(): void {
    const addon = new NativeAddon<IPosixProcessAddon>(NativeAddon.locate("posix-process.node"), ["startDetached"]);

    const failure = Assert.throws(() => addon.load().startDetached?.("/bin/sh", [], [], 2, undefined, undefined, undefined, "responsibility_spawnattrs_setdisclaim", devNull), TypeError);

    Assert.areEqual("The POSIX process addon was given more arguments than it takes to start a program.", failure.message);
  }

  @TestMethod
  public createsOneForThePackagesOwnAddonWithoutLoadingIt(): void {
    Assert.isInstanceOf(PosixProcessApi.create(), PosixProcessApi);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async givesTheProgramTheGivenInputAndOutput(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const [input, output] = [path.join(folder.path, "input.txt"), path.join(folder.path, "output.txt")];
    await writeFile(input, "kept\n");
    const files = await Promise.all([open(input, "r"), open(output, "w"), open(devNull, "w")]);
    try {
      const processId = PosixProcessApi.create().startDetached("/bin/cat", [], [], files[2].fd, undefined, files[1].fd, files[0].fd);

      Assert.isTrue(await WaitFixture.untilAsync(() => !PosixProcessApiTests.isRunning(processId), 9_000), "The program did not exit within 9 s.");
    }
    finally {
      await Promise.all(files.map(t => t.close()));
    }
    Assert.areEqual("kept\n", await readFile(output, "utf8"));
  }

  private static async writeStatAsync(folder: string, name: string, text: string): Promise<void> {
    await mkdir(path.join(folder, name));
    await writeFile(path.join(folder, name, "stat"), text);
  }

  private static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }
}
