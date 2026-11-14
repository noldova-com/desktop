/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateProcess } from "@noldova/desktop.protocol";
import { AppImageCopyCleanup, AppImageCopyRecord, DataDirectory, ProcessPresence } from "@noldova/desktop.runtime";

import { ArchiveSwitchFixture } from "../../fixtures/archive-switch.fixture.js";
import { DescriptorFolderPatchFixture } from "../../fixtures/descriptor-folder-patch.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class AppImageCopyCleanupTests {
  private static readonly ORPHANED: string = "copy-11111111-2222-4333-8444-555555555555.log";
  private static readonly HELD: string = "copy-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.log";
  private static readonly NESTED: string = "copy-33333333-4444-4555-8666-777777777777.log";
  private static readonly MISNAMED: string = "copy-44444444-5555-4666-8777-888888888888.log";
  private static readonly UNREADABLE: string = "copy-bbbbbbbb-cccc-4ddd-8eee-ffffffffffff.log";
  private static readonly START_LOG: string = "start-cccccccc-dddd-4eee-8fff-000000000000.log";

  private static readonly LIMIT: number = 10_000;

  private static readonly PRESENCE: ProcessPresence = ProcessPresence.create(process.platform);

  @TestMethod
  public async createsTheLogsFolderWhenThereIsNone(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const diagnostics = new TextOutputFixture();

    await AppImageCopyCleanup.removeAsync(directory, diagnostics, AppImageCopyCleanupTests.PRESENCE);

    Assert.areEqual(String.empty, (await readdir(directory.logsFolder)).join(","));
    Assert.areEqual(String.empty, diagnostics.text);
  }

  @TestMethod
  public async removesTheExtractionOfAHolderThatIsGoneFromTheTemporaryFolderOnlyAndKeepsTheRecordOfOneElsewhere(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using orphaned = await TemporaryFolderFixture.createAsync();
    await using held = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const nested = path.join(folder.path, "desktop-runtime-Ab3dE6");
    const misnamed = await mkdtemp(path.join(tmpdir(), "copy-"));
    try {
      await mkdir(nested);
      const gone = AppImageCopyCleanupTests.restarted(process.pid);
      await AppImageCopyCleanupTests.writeRecordsAsync(directory, [
        [AppImageCopyCleanupTests.ORPHANED, gone, orphaned.path],
        [AppImageCopyCleanupTests.NESTED, gone, nested],
        [AppImageCopyCleanupTests.MISNAMED, gone, misnamed],
        [AppImageCopyCleanupTests.HELD, await AppImageCopyCleanupTests.stampAsync(process.pid), held.path]
      ]);

      const diagnostics = new TextOutputFixture();
      await AppImageCopyCleanup.removeAsync(directory, diagnostics, AppImageCopyCleanupTests.PRESENCE);

      Assert.areEqual("false,true,true,true", [orphaned.path, held.path, nested, misnamed].map(t => existsSync(t)).join(","));
      Assert.areEqual(AppImageCopyCleanupTests.listLeft(), (await readdir(directory.logsFolder)).sort().join(","));
      Assert.areEqual(`${path.join(directory.logsFolder, AppImageCopyCleanupTests.UNREADABLE)} EISDIR`, AppImageCopyCleanupTests.readFailed(diagnostics));
    }
    finally {
      await rm(misnamed, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async endsTheRecordedMountProcessOfALauncherThatIsGoneOnlyWhenItsStartMatches(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const orphaned = path.join(directory.logsFolder, AppImageCopyCleanupTests.ORPHANED);
    const mounter = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", windowsHide: true });
    try {
      await once(mounter, "spawn");
      const mount = await AppImageCopyCleanupTests.stampAsync(Number(mounter.pid));
      const gone = AppImageCopyCleanupTests.restarted(process.pid);
      await mkdir(directory.logsFolder, { recursive: true });
      await new AppImageCopyRecord(gone, null, AppImageCopyCleanupTests.restarted(Number(mounter.pid))).writeAsync(orphaned);
      await new AppImageCopyRecord(await AppImageCopyCleanupTests.stampAsync(process.pid), null, mount)
        .writeAsync(path.join(directory.logsFolder, AppImageCopyCleanupTests.HELD));
      const diagnostics = new TextOutputFixture();

      await AppImageCopyCleanup.removeAsync(directory, diagnostics, AppImageCopyCleanupTests.PRESENCE);
      const isRestartedEnded = !ProgramFixture.isRunning(Number(mounter.pid));
      const leftAfterRestarted = (await readdir(directory.logsFolder)).join(",");
      await new AppImageCopyRecord(gone, null, mount).writeAsync(orphaned);
      await AppImageCopyCleanup.removeAsync(directory, diagnostics, AppImageCopyCleanupTests.PRESENCE);

      Assert.isFalse(isRestartedEnded, "a mount process whose start does not match is left");
      Assert.areEqual(AppImageCopyCleanupTests.HELD, leftAfterRestarted);
      Assert.isTrue(await ProgramFixture.waitForEndAsync(Number(mounter.pid), AppImageCopyCleanupTests.LIMIT), "the matching mount process is ended");
      Assert.areEqual(AppImageCopyCleanupTests.HELD, (await readdir(directory.logsFolder)).join(","));
      Assert.areEqual(String.empty, diagnostics.text);
    }
    finally {
      mounter.kill();
    }
  }

  @TestMethod
  public async endsTheMountProcessARecordDoesNotNameYetByItsOutputWhenTheLauncherIsGone(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const logs = directory.logsFolder;
    const mounter = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", windowsHide: true });
    try {
      await once(mounter, "spawn");
      await mkdir(logs, { recursive: true });
      const gone = AppImageCopyCleanupTests.restarted(process.pid);
      const held = await AppImageCopyCleanupTests.stampAsync(process.pid);
      await new AppImageCopyRecord(gone, null).writeAsync(path.join(logs, AppImageCopyCleanupTests.ORPHANED));
      await new AppImageCopyRecord(gone, null).writeAsync(path.join(logs, AppImageCopyCleanupTests.MISNAMED));
      await new AppImageCopyRecord(held, null).writeAsync(path.join(logs, AppImageCopyCleanupTests.HELD));
      await writeFile(path.join(logs, `${AppImageCopyCleanupTests.ORPHANED}.mount`), String.empty);
      await writeFile(path.join(logs, `${AppImageCopyCleanupTests.HELD}.mount`), String.empty);
      const listing = await realpath(path.join(logs, `${AppImageCopyCleanupTests.ORPHANED}.mount`));
      const asked: string[] = [];
      const findWriters = (file: string): readonly number[] => {
        asked.push(file);
        return file === listing ? [Number(mounter.pid)] : [];
      };
      const diagnostics = new TextOutputFixture();

      await AppImageCopyCleanup.removeAsync(directory, diagnostics, AppImageCopyCleanupTests.PRESENCE, findWriters);

      Assert.isTrue(await ProgramFixture.waitForEndAsync(Number(mounter.pid), AppImageCopyCleanupTests.LIMIT), "the mount process writing to the record's output is ended");
      Assert.areEqual(listing, asked.join(","));
      Assert.areEqual([AppImageCopyCleanupTests.HELD, `${AppImageCopyCleanupTests.HELD}.mount`].join(","), (await readdir(logs)).sort().join(","));
      Assert.areEqual(String.empty, diagnostics.text);
    }
    finally {
      mounter.kill();
    }
  }

  @TestMethod
  public async keepsARecordThatNamesNoMountProcessAndItsOutputUntilAStartCanListTheProcesses(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const record = path.join(directory.logsFolder, AppImageCopyCleanupTests.ORPHANED);
    const output = `${record}.mount`;
    const mounter = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", windowsHide: true });
    try {
      await once(mounter, "spawn");
      await mkdir(directory.logsFolder, { recursive: true });
      await new AppImageCopyRecord(AppImageCopyCleanupTests.restarted(process.pid), null).writeAsync(record);
      await writeFile(output, String.empty);
      const diagnostics = new TextOutputFixture();
      await AppImageCopyCleanupTests.removeWithoutProcessFolderAsync(directory, diagnostics);
      const left = (await readdir(directory.logsFolder)).sort().join(",");
      const isLeftRunning = ProgramFixture.isRunning(Number(mounter.pid));
      const listing = await realpath(output);
      const findWriters = (file: string): readonly number[] => file === listing ? [Number(mounter.pid)] : [];

      await AppImageCopyCleanup.removeAsync(directory, diagnostics, AppImageCopyCleanupTests.PRESENCE, findWriters);

      Assert.areEqual([AppImageCopyCleanupTests.ORPHANED, `${AppImageCopyCleanupTests.ORPHANED}.mount`].join(","), left);
      Assert.isTrue(isLeftRunning, "the mount process is left while the processes cannot be listed");
      Assert.areEqual(`${record} ENOENT`, AppImageCopyCleanupTests.readFailed(diagnostics));
      Assert.isTrue(diagnostics.text.includes("scandir '/proc'"), diagnostics.text);
      Assert.isTrue(await ProgramFixture.waitForEndAsync(Number(mounter.pid), AppImageCopyCleanupTests.LIMIT), "the next start ends the mount process");
      Assert.areEqual(String.empty, (await readdir(directory.logsFolder)).join(","));
    }
    finally {
      mounter.kill();
    }
  }

  @TestMethod
  public async removesItsOwnExtractionAndRecordWhileItsHolderStillRuns(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using extraction = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, AppImageCopyCleanupTests.HELD);
    await new AppImageCopyRecord(await AppImageCopyCleanupTests.stampAsync(process.pid), extraction.path).writeAsync(file);
    const diagnostics = new TextOutputFixture();

    await AppImageCopyCleanup.removeOwnAsync(file, diagnostics);
    await AppImageCopyCleanup.removeOwnAsync(file, diagnostics);

    Assert.areEqual("false,false", [extraction.path, file].map(t => existsSync(t)).join(","));
    Assert.areEqual(String.empty, diagnostics.text);
  }

  @TestMethod
  public async removesAnExtractionWithElectronsArchiveSupportOffAndThenBackAsItWas(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using extraction = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, AppImageCopyCleanupTests.HELD);
    await new AppImageCopyRecord(await AppImageCopyCleanupTests.stampAsync(process.pid), extraction.path).writeAsync(file);
    using archiveSwitch = new ArchiveSwitchFixture(extraction.path);

    await AppImageCopyCleanup.removeOwnAsync(file, new TextOutputFixture());

    Assert.areEqual("true before,undefined after", archiveSwitch.changes.join(","));
  }

  @TestMethod
  public async leavesItsOwnRecordThatStillNamesAMountProcessForTheNextStart(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, AppImageCopyCleanupTests.HELD);
    await new AppImageCopyRecord(await AppImageCopyCleanupTests.stampAsync(process.pid), null, AppImageCopyCleanupTests.restarted(process.pid)).writeAsync(file);
    const diagnostics = new TextOutputFixture();

    await AppImageCopyCleanup.removeOwnAsync(file, diagnostics);

    Assert.isTrue(existsSync(file));
    Assert.areEqual(String.empty, diagnostics.text);
  }

  @TestMethod
  public async reportsItsOwnRecordItCannotReadWithoutFailing(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, AppImageCopyCleanupTests.UNREADABLE);
    await mkdir(file);
    const diagnostics = new TextOutputFixture();

    await AppImageCopyCleanup.removeOwnAsync(file, diagnostics);

    Assert.isTrue(existsSync(file));
    Assert.areEqual(`${file} EISDIR`, AppImageCopyCleanupTests.readFailed(diagnostics));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async keepsAndReportsARecordWhoseOutputCannotBeResolved(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const record = path.join(directory.logsFolder, AppImageCopyCleanupTests.ORPHANED);
    const output = `${record}.mount`;
    await mkdir(directory.logsFolder, { recursive: true });
    await new AppImageCopyRecord(AppImageCopyCleanupTests.restarted(process.pid), null).writeAsync(record);
    await symlink(output, output);
    const diagnostics = new TextOutputFixture();

    await AppImageCopyCleanup.removeAsync(directory, diagnostics, AppImageCopyCleanupTests.PRESENCE, () => []);

    Assert.isTrue(existsSync(record));
    Assert.areEqual(`${record} ELOOP`, AppImageCopyCleanupTests.readFailed(diagnostics));
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async keepsAndReportsARecordWhoseOutputIsAJunctionToItself(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "data"));
    const record = path.join(directory.logsFolder, AppImageCopyCleanupTests.ORPHANED);
    const output = `${record}.mount`;
    await mkdir(directory.logsFolder, { recursive: true });
    await new AppImageCopyRecord(AppImageCopyCleanupTests.restarted(process.pid), null).writeAsync(record);
    await symlink(output, output, "junction");
    const diagnostics = new TextOutputFixture();

    await AppImageCopyCleanup.removeAsync(directory, diagnostics, AppImageCopyCleanupTests.PRESENCE, () => []);

    Assert.isTrue(existsSync(record));
    Assert.isTrue(AppImageCopyCleanupTests.readFailed(diagnostics).startsWith(`${record} `), diagnostics.text);
  }

  private static restarted(processId: number): UpdateProcess {
    return new UpdateProcess(processId, 0, 1, "runtime");
  }

  private static async stampAsync(processId: number): Promise<UpdateProcess> {
    const [stamped] = await AppImageCopyCleanupTests.PRESENCE.stampAsync([[processId, "runtime"]]);
    if (Object.isUndefined(stamped))
      throw new Error(`The process table does not list process ${processId}.`);
    return stamped;
  }

  private static async removeWithoutProcessFolderAsync(directory: DataDirectory, diagnostics: TextOutputFixture): Promise<void> {
    using _processes = new DescriptorFolderPatchFixture("/proc/4321/fd", new Map());
    await AppImageCopyCleanup.removeAsync(directory, diagnostics, AppImageCopyCleanupTests.PRESENCE);
  }

  private static readFailed(diagnostics: TextOutputFixture): string {
    const failure = /^The runtime could not end the AppImage copy recorded in (.+), so the record is left: Error: ([A-Z]+):/;
    return diagnostics.text.split("\n").filter(t => t !== String.empty).map(t => failure.exec(t)?.slice(1).join(" ") ?? t).sort().join(",");
  }

  private static listLeft(): string {
    return [AppImageCopyCleanupTests.HELD, AppImageCopyCleanupTests.NESTED, AppImageCopyCleanupTests.UNREADABLE, AppImageCopyCleanupTests.START_LOG].sort().join(",");
  }

  private static async writeRecordsAsync(directory: DataDirectory, records: readonly (readonly [string, UpdateProcess, string])[]): Promise<void> {
    await mkdir(path.join(directory.logsFolder, AppImageCopyCleanupTests.UNREADABLE), { recursive: true });
    await writeFile(path.join(directory.logsFolder, AppImageCopyCleanupTests.START_LOG),
      JSON.stringify(new AppImageCopyRecord(AppImageCopyCleanupTests.restarted(process.pid), directory.logsFolder).toJson()));
    for (const [name, holder, extraction] of records)
      await new AppImageCopyRecord(holder, extraction).writeAsync(path.join(directory.logsFolder, name));
  }
}
