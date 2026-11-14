/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { AddonUnexpectedValueException, WindowsProcessApi } from "@noldova/desktop.runtime";

import { AddonModuleFixture } from "../../fixtures/addon-module.fixture.js";
import { ErrorCodeFixture } from "../../fixtures/error-code.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class WindowsProcessApiTests {
  private static readonly PARENT: string = `process.stdin.once("data", () => {
    const child = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => process.uptime() > 60 && process.exit(), 1000)"], { stdio: "ignore", detached: true });
    process.stdout.write(String(child.pid), () => process.exit(0));
  });`;
  private static readonly STAYING_PARENT: string = `process.stdin.once("data", () => {
    const child = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => process.uptime() > 60 && process.exit(), 1000)"], { stdio: "ignore", detached: true });
    child.unref();
    process.stdout.write(String(child.pid));
    setInterval(() => undefined, 1000);
  });`;
  private static readonly ADDON: string = `{
    listProcesses: () => [[4, 0], [8, 4]],
    openProcess: (processId, access) => processId === 8 ? BigInt(access) : 5,
    readCreationTime: handle => handle === 1n ? null : 133000000000000000n,
    readImagePath: handle => handle === 1n ? null : "C:/Tools/tool.exe",
    terminateProcess: handle => handle === 2n,
    hasExited: handle => handle !== 2n,
    readExitCode: handle => handle === 2n ? -1073741510 : null,
    openFileForReading: file => file.endsWith(".exe") ? 3n : 2,
    closeHandle: () => undefined,
    createJob: holdsDescendants => holdsDescendants === true ? 7n : 9n,
    assignProcessToJob: (job, handle) => job === 7n && handle === 8n ? 0 : 5,
    listJobProcesses: job => job === 7n ? [8, 12] : [],
    verifySignatureAsync: file => Promise.resolve(file.endsWith(".exe") ? { status: 0, message: "", subject: "CN=Noldova" } : { status: 1, message: "unsigned", subject: null })
  }`;

  @TestMethod
  public async passesEachCallToTheAddonAndReturnsWhatItGives(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(WindowsProcessApiTests.ADDON);
    const api = new WindowsProcessApi(fake.file);

    Assert.areEqual("4,0;8,4", api.listProcesses().map(t => t.join(",")).join(";"));
    Assert.areEqual(4096n, api.openProcess(8, 4096));
    Assert.areEqual(5, api.openProcess(9, 4096));
    Assert.areEqual(133000000000000000n, api.readCreationTime(2n));
    Assert.isNull(api.readCreationTime(1n));
    Assert.areEqual("C:/Tools/tool.exe", api.readImagePath(2n));
    Assert.isNull(api.readImagePath(1n));
    Assert.isTrue(api.terminateProcess(2n));
    Assert.isFalse(api.hasExited(2n));
    Assert.areEqual(-1_073_741_510, api.readExitCode(2n));
    Assert.isNull(api.readExitCode(1n));
    Assert.areEqual(3n, api.openFileForReading("tool.exe"));
    Assert.areEqual(2, api.openFileForReading("gone.txt"));
    api.closeHandle(3n);
    Assert.areEqual("7 9", `${api.createJob(true)} ${api.createJob(false)}`);
    Assert.areEqual("0 5", `${api.assignProcessToJob(7n, 8n)} ${api.assignProcessToJob(7n, 9n)}`);
    Assert.areEqual("8,12", api.listJobProcesses(7n).join(","));
    Assert.areEqual("0  CN=Noldova", Object.values(await api.verifySignatureAsync("tool.exe")).join(" "));
    Assert.areEqual("1 unsigned ", Object.values(await api.verifySignatureAsync("tool.txt")).map(t => t ?? String.empty).join(" "));
  }

  @TestMethod
  @TestData("listProcesses: () => [[4]]")
  @TestData("listProcesses: () => [[4, '0']]")
  @TestData("listProcesses: () => 'none'")
  @TestData("openProcess: () => '5'")
  @TestData("readCreationTime: () => 5")
  @TestData("readImagePath: () => 5")
  @TestData("terminateProcess: () => 1")
  @TestData("hasExited: () => 1")
  @TestData("readExitCode: () => 1.5")
  @TestData("readExitCode: () => '7'")
  @TestData("openFileForReading: () => null")
  @TestData("closeHandle: () => false")
  @TestData("createJob: () => 7")
  @TestData("assignProcessToJob: () => -1")
  @TestData("assignProcessToJob: () => 0n")
  @TestData("listJobProcesses: () => [0]")
  @TestData("listJobProcesses: () => ['8']")
  @TestData("listJobProcesses: () => 8")
  @TestData("verifySignatureAsync: () => Promise.resolve(null)")
  @TestData("verifySignatureAsync: () => Promise.resolve({ status: '0', message: '', subject: null })")
  @TestData("verifySignatureAsync: () => Promise.resolve({ status: 0, message: 0, subject: null })")
  @TestData("verifySignatureAsync: () => Promise.resolve({ status: 0, message: '', subject: 0 })")
  public async refusesAValueItDoesNotExpect(replaced: string): Promise<void> {
    const name = replaced.slice(0, replaced.indexOf(":"));
    await using fake = await AddonModuleFixture.createAsync(`Object.assign(${WindowsProcessApiTests.ADDON}, { ${replaced} })`);
    const api = new WindowsProcessApi(fake.file);
    const calls: Readonly<Record<string, () => Promise<unknown>>> = {
      listProcesses: () => Promise.resolve(api.listProcesses()),
      openProcess: () => Promise.resolve(api.openProcess(8, 4096)),
      readCreationTime: () => Promise.resolve(api.readCreationTime(2n)),
      readImagePath: () => Promise.resolve(api.readImagePath(2n)),
      terminateProcess: () => Promise.resolve(api.terminateProcess(2n)),
      hasExited: () => Promise.resolve(api.hasExited(2n)),
      readExitCode: () => Promise.resolve(api.readExitCode(2n)),
      openFileForReading: () => Promise.resolve(api.openFileForReading("tool.exe")),
      closeHandle: () => Promise.resolve(api.closeHandle(3n)),
      createJob: () => Promise.resolve(api.createJob(true)),
      assignProcessToJob: () => Promise.resolve(api.assignProcessToJob(7n, 8n)),
      listJobProcesses: () => Promise.resolve(api.listJobProcesses(7n)),
      verifySignatureAsync: () => api.verifySignatureAsync("tool.exe")
    };

    await Assert.throwsAsync(() => calls[name]?.() ?? Promise.resolve(), AddonUnexpectedValueException);
  }

  @TestMethod
  public createsOneForThePackagesOwnAddonWithoutLoadingIt(): void {
    Assert.isInstanceOf(WindowsProcessApi.create(), WindowsProcessApi);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async holdsWhatAProcessInAJobStartsAfterItsParentExitsAndEndsItWhenTheJobCloses(): Promise<void> {
    const api = WindowsProcessApi.create();
    const parent = spawn(process.execPath, ["-e", WindowsProcessApiTests.PARENT], { stdio: ["pipe", "pipe", "ignore"] });
    const job = api.createJob(true);
    let child = 0;
    try {
      await once(parent, "spawn");
      const handle = WindowsProcessApiTests.expectHandle(api.openProcess(parent.pid ?? 0, 0x0100 | 0x0001 | 0x100000));
      Assert.areEqual(0, api.assignProcessToJob(job, handle));
      api.closeHandle(handle);
      const output = once(parent.stdout, "data");
      parent.stdin.end("start\n");
      child = Number(String((await output)[0]).trim());
      await once(parent, "exit");

      Assert.isTrue(api.listJobProcesses(job).includes(child), api.listJobProcesses(job).join(","));
      Assert.isTrue(WindowsProcessApiTests.isRunning(child), "The process ended with its parent.");
    }
    finally {
      api.closeHandle(job);
    }
    Assert.isTrue(await WaitFixture.untilAsync(() => !WindowsProcessApiTests.isRunning(child), 9_000), "The job's process did not end within 9 s of the job closing.");
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async letsWhatAProcessStartsLeaveAJobThatHoldsNoDescendantsAndOutliveItsClose(): Promise<void> {
    const api = WindowsProcessApi.create();
    const parent = spawn(process.execPath, ["-e", WindowsProcessApiTests.STAYING_PARENT], { stdio: ["pipe", "pipe", "ignore"] });
    const job = api.createJob(false);
    let child = 0;
    try {
      await once(parent, "spawn");
      const handle = WindowsProcessApiTests.expectHandle(api.openProcess(parent.pid ?? 0, 0x0100 | 0x0001 | 0x100000));
      Assert.areEqual(0, api.assignProcessToJob(job, handle));
      api.closeHandle(handle);
      const output = once(parent.stdout, "data");
      parent.stdin.end("start\n");
      child = Number(String((await output)[0]).trim());
      const exited = once(parent, "exit");

      Assert.areEqual(String(parent.pid), api.listJobProcesses(job).join(","));
      api.closeHandle(job);
      await exited;
      Assert.isTrue(WindowsProcessApiTests.isRunning(child), "The process ended with the job it left.");
    }
    finally {
      parent.kill();
      if (WindowsProcessApiTests.isRunning(child))
        process.kill(child);
    }
  }

  @PlatformFixture.windowsOnly()
  @TestMethod
  @TestData(7)
  @TestData(-1_073_741_510)
  public async readsTheExitCodeOfAProcessThatHasExitedAsNodePtyGivesIt(code: number): Promise<void> {
    const api = WindowsProcessApi.create();
    const child = spawn(process.execPath, ["-e", `process.stdin.once("data", () => process.exit(${code}))`], { stdio: ["pipe", "ignore", "ignore"] });
    await once(child, "spawn");
    const handle = WindowsProcessApiTests.expectHandle(api.openProcess(child.pid ?? 0, 0x1000 | 0x100000));
    try {
      const running = api.hasExited(handle);
      const exited = once(child, "exit");
      child.stdin.end("end\n");
      await exited;

      Assert.isFalse(running);
      Assert.isTrue(api.hasExited(handle));
      Assert.areEqual(code, api.readExitCode(handle));
    }
    finally {
      api.closeHandle(handle);
    }
  }

  private static expectHandle(handle: bigint | number): bigint {
    if (Object.isBigInt(handle))
      return handle;
    throw new Error(`Windows refused to open the process, with error ${handle}.`);
  }

  private static isRunning(processId: number): boolean {
    try {
      return process.kill(processId, 0);
    }
    catch {
      return false;
    }
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async holdsAFileThatCanBeReadButNotWrittenRenamedOrDeletedUntilItIsClosedOnWindows(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = join(folder.path, "Noldova Desktop Sample-windows-x64.exe");
    await writeFile(file, "Noldova Desktop Sample 1.3.0");
    const api = WindowsProcessApi.create();

    const handle = api.openFileForReading(file);
    const codeOf = (error: unknown): unknown => ErrorCodeFixture.of(error);
    let read: string;
    let written: unknown;
    let renamed: unknown;
    let deleted: unknown;
    try {
      read = await readFile(file, "utf8");
      written = await writeFile(file, "changed").then(() => null, codeOf);
      renamed = await rename(file, `${file}.moved`).then(() => null, codeOf);
      deleted = await rm(file).then(() => null, codeOf);
    }
    finally {
      if (Object.isBigInt(handle))
        api.closeHandle(handle);
    }
    await rename(file, `${file}.moved`);

    Assert.isTrue(Object.isBigInt(handle));
    Assert.areEqual("Noldova Desktop Sample 1.3.0", read);
    Assert.isTrue(["EBUSY", "EPERM"].includes(String(written)), String(written));
    Assert.isTrue(["EBUSY", "EPERM"].includes(String(renamed)), String(renamed));
    Assert.isTrue(["EBUSY", "EPERM"].includes(String(deleted)), String(deleted));
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async givesTheWindowsErrorForAFileItCannotOpenAndRefusesAPathWithANullCharacterOnWindows(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const api = WindowsProcessApi.create();

    const missing = api.openFileForReading(join(folder.path, "gone.exe"));

    Assert.areEqual(2, missing);
    Assert.throws(() => api.openFileForReading(`${join(folder.path, "gone.exe")}\0.txt`), TypeError);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async readsTheSignerOfASignedProgramAndWhyAnUnsignedFileIsNotValidOnWindows(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const unsigned = join(folder.path, "Noldova Desktop Sample's ünsigned installer.exe");
    await writeFile(unsigned, "MZ");
    const api = WindowsProcessApi.create();

    const signed = await api.verifySignatureAsync(process.execPath);
    const notSigned = await api.verifySignatureAsync(unsigned);

    Assert.areEqual(0, signed.status, signed.message);
    Assert.isTrue(signed.subject?.startsWith("CN=") === true, String(signed.subject));
    Assert.areNotEqual(0, notSigned.status);
    Assert.isTrue(notSigned.message.trim().length > 0, notSigned.message);
    Assert.isNull(notSigned.subject);
    await Assert.throwsAsync(() => api.verifySignatureAsync(`${unsigned}\0.txt`), TypeError);
  }
}
