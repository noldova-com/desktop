/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, openSync, readFileSync, writeSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  AppImageCopyLaunch, AppImageCopyRecord, AppImageExtraction, AppImageKeepalive, AppImageSource, ChildProcessStarter, type IPosixProcessApi, type IProcessStarter,
  AppImageCopyUnavailableException, AppImageCopyUnlistedException, LaunchStartFailedException, PosixProcessApi, ProcessPresence
} from "@noldova/desktop.runtime";

import { AppImageFixture } from "../../fixtures/app-image.fixture.js";
import { FileReadsFixture } from "../../fixtures/file-reads.fixture.js";
import { FileSystemPatchFixture } from "../../fixtures/file-system-patch.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProcessTableFixture } from "../../fixtures/process-table.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

type Extract = (image: string, extraction: string, environment: NodeJS.ProcessEnv, startLog: string) => Promise<string>;

@TestClass
export class AppImageCopyLaunchTests {
  private static readonly IMAGE: string = "/home/person/Noldova Desktop Sample.AppImage";
  private static readonly ROOT: string = "/tmp/.mount_AbCdEf";
  private static readonly COPY: string = "/tmp/.mount_GhIjKl";
  private static readonly LIMIT: number = 10_000;
  private static readonly UNAVAILABLE: string = `${AppImageCopyLaunchTests.IMAGE} could be neither mounted nor extracted, so the runtime cannot start.`;
  private static readonly NOT_MOUNTED: string = `${AppImageCopyLaunchTests.IMAGE} could not be mounted, so the runtime starts from an extraction of it.\n`;
  private static readonly PRESENCE: ProcessPresence = ProcessPresence.create(process.platform);
  private static readonly LOG: (text: string) => void = () => undefined;

  @TestMethod
  @TestData("{\"TMPDIR\":\"/var/tmp\",\"TMP\":\"/t\",\"TEMP\":\"/e\"}", "/var/tmp")
  @TestData("{\"TMPDIR\":\"\",\"TMP\":\"/t\",\"TEMP\":\"/e\"}", "/t")
  @TestData("{\"TEMP\":\"/e\"}", "/e")
  @TestData("{}", "/tmp")
  public findsTheTemporaryFolderAsNodeDoes(environment: string, expected: string): void {
    const fields = JsonReader.parse(environment);

    Assert.areEqual(expected, AppImageCopyLaunch.findTemporaryFolder({ TMPDIR: fields.readOptionalString("TMPDIR"), TMP: fields.readOptionalString("TMP"), TEMP: fields.readOptionalString("TEMP") }));
  }

  @TestMethod
  public async startsTheRuntimeHoldingTheMountItNamesAndEndsTheMounter(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using mounter = await AppImageCopyLaunchTests.startProgramAsync();
    using runtime = await AppImageCopyLaunchTests.startProgramAsync();
    const started: (readonly string[])[] = [];
    const environments: (readonly string[])[] = [];
    const fake = AppImageCopyLaunchTests.createPosix(started, environments, [`${AppImageCopyLaunchTests.COPY}\nmore\n`, mounter], runtime);
    const records: string[] = [];
    const posix: IPosixProcessApi = {
      startDetached: (...values) => {
        records.push(readFileSync(path.join(folder.path, "copy.log"), "utf8"));
        return fake.startDetached(...values);
      }
    };
    const keepalives: number[] = [];
    const openKeepalive = (processId: number): number => {
      keepalives.push(processId, openSync(path.join(folder.path, "start.log"), "a"));
      return Number(keepalives.at(-1));
    };
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter([], [], null), posix, AppImageCopyLaunchTests.PRESENCE, openKeepalive,
      AppImageCopyLaunchTests.failExtract([]), AppImageCopyLaunchTests.LOG);

    const processId = await AppImageCopyLaunchTests.startAsync(launch, true, folder.path, path.join(folder.path, "copy.log"),
      ["entry.js", `${AppImageCopyLaunchTests.ROOT}/resources/app.asar`, AppImageCopyLaunchTests.ROOT, `${AppImageCopyLaunchTests.ROOT}-other/file`], { HOME: "/home/person", UNSET: undefined });

    Assert.areEqual(runtime.pid, processId);
    Assert.areEqual([
      `${AppImageCopyLaunchTests.IMAGE}|--appimage-mount|output|input none`,
      `${AppImageCopyLaunchTests.COPY}/noldova-desktop|entry.js|${AppImageCopyLaunchTests.COPY}/resources/app.asar|${AppImageCopyLaunchTests.ROOT}|${AppImageCopyLaunchTests.ROOT}-other/file|` +
        `no output|input ${keepalives[1]}`
    ].join(","), started.map(t => t.join("|")).join(","));
    Assert.areEqual(`HOME=/home/person,APPDIR=${AppImageCopyLaunchTests.COPY}`, environments[1]?.join(","));
    Assert.areEqual(mounter.pid, keepalives[0]);
    const [beforeMount, handingOver] = records.map(t => AppImageCopyRecord.fromJson(JsonReader.parse(t).toJson()));
    Assert.areEqual(`${process.pid} runtime launcher,null,undefined`,
      `${beforeMount?.holder.processId} ${beforeMount?.holder.role},${beforeMount?.extraction},${beforeMount?.mounter?.processId}`, "the record names the launcher before the mount process starts");
    Assert.areEqual(`${process.pid} runtime launcher,null,${mounter.pid} AppImage mount`,
      `${handingOver?.holder.processId} ${handingOver?.holder.role},${handingOver?.extraction},${handingOver?.mounter?.processId} ${handingOver?.mounter?.role}`,
      "the record names the mount process during the hand-over");
    Assert.isTrue(await ProgramFixture.waitForEndAsync(Number(mounter.pid), AppImageCopyLaunchTests.LIMIT), "the mounter is ended once the runtime holds the mount");
    Assert.isTrue(ProgramFixture.isRunning(Number(runtime.pid)));
    Assert.areEqual("start.log", (await readdir(folder.path)).join(","));
    Assert.areEqual(String.empty, await readFile(path.join(folder.path, "start.log"), "utf8"));
  }

  @TestMethod
  public async readsTheMountsFolderOnceTheMounterNamesItLater(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using mounter = await AppImageCopyLaunchTests.startProgramAsync();
    using runtime = await AppImageCopyLaunchTests.startProgramAsync();
    const record = path.join(folder.path, "copy.log");
    using reads = new FileReadsFixture(`${record}.mount`);
    const read = reads.waitForMoreAsync(1);
    const posix = AppImageCopyLaunchTests.createPosix([], [], [String.empty, mounter], runtime);
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter([], [], null), posix, AppImageCopyLaunchTests.PRESENCE,
      () => openSync(path.join(folder.path, "start.log"), "a"), AppImageCopyLaunchTests.failExtract([]), AppImageCopyLaunchTests.LOG);
    const starting = AppImageCopyLaunchTests.startAsync(launch, true, folder.path, record);

    await read;
    await appendFile(`${record}.mount`, `${AppImageCopyLaunchTests.COPY}\n`);

    Assert.areEqual(runtime.pid, await starting, "the mount's output wakes the launcher while the mounter runs");
    Assert.isTrue(await ProgramFixture.waitForEndAsync(Number(mounter.pid), AppImageCopyLaunchTests.LIMIT), "the mounter is ended once the runtime holds the mount");
  }

  @TestMethod
  public async endsTheMounterAndReportsARuntimeThatCannotStartFromTheMount(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using mounter = await AppImageCopyLaunchTests.startProgramAsync();
    const posix = AppImageCopyLaunchTests.createPosix([], [], [`${AppImageCopyLaunchTests.COPY}\n`, mounter], null);
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter([], [], null), posix, AppImageCopyLaunchTests.PRESENCE,
      () => openSync(path.join(folder.path, "start.log"), "a"), AppImageCopyLaunchTests.failExtract([]), AppImageCopyLaunchTests.LOG);

    const exception = await Assert.throwsAsync(() => AppImageCopyLaunchTests.startAsync(launch, true, folder.path, path.join(folder.path, "copy.log")), LaunchStartFailedException);

    Assert.areEqual(`The program ${AppImageCopyLaunchTests.COPY}/noldova-desktop could not be started.`, exception.message);
    Assert.isInstanceOf(exception.cause, Error);
    Assert.isTrue(await ProgramFixture.waitForEndAsync(Number(mounter.pid), AppImageCopyLaunchTests.LIMIT), "the mounter ends");
    Assert.areEqual("start.log", (await readdir(folder.path)).join(","));
  }

  @TestMethod
  @TestData("refused")
  @TestData("silent")
  @TestData("blank")
  @TestData("ended")
  @TestData("unheld")
  @TestData("unopened")
  public async fallsBackToAnExtractionWhenTheMountCannotBeHeld(behavior: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using temporary = await TemporaryFolderFixture.createAsync();
    using mounter = await AppImageCopyLaunchTests.startProgramAsync();
    const ended = behavior === "ended" ? await AppImageCopyLaunchTests.startEndedProgramAsync() : mounter;
    const listing = ["silent", "ended"].includes(behavior) ? String.empty : behavior === "blank" ? "\n" : `${AppImageCopyLaunchTests.COPY}\n`;
    const started: (readonly string[])[] = [];
    const posix = AppImageCopyLaunchTests.createPosix(started, [], behavior === "refused" ? null : [listing, ended], null);
    const openKeepalive = (): number | null => {
      if (behavior === "unopened")
        throw new Error("EACCES: permission denied, open '/proc/4321/fd/3'");
      return null;
    };
    const extracted: string[] = [];
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter([], [], null), posix, AppImageCopyLaunchTests.PRESENCE, openKeepalive,
      AppImageCopyLaunchTests.failExtract(extracted), AppImageCopyLaunchTests.LOG, 100);

    const exception = await Assert.throwsAsync(
      () => AppImageCopyLaunchTests.startAsync(launch, true, folder.path, path.join(folder.path, "copy.log"), [], { TMPDIR: temporary.path }), AppImageCopyUnavailableException);

    Assert.areEqual(AppImageCopyLaunchTests.UNAVAILABLE, exception.message);
    Assert.areEqual(`${AppImageCopyLaunchTests.IMAGE}|--appimage-mount|output|input none`, started.map(t => t.join("|")).join(","));
    Assert.areEqual(1, extracted.length);
    const isEnded = ["silent", "blank", "unheld", "unopened"].includes(behavior);
    Assert.areEqual(isEnded, await ProgramFixture.waitForEndAsync(Number(mounter.pid), isEnded ? AppImageCopyLaunchTests.LIMIT : 0), "only the mounter that was started is ended");
    Assert.areEqual(AppImageCopyLaunchTests.describeNotMounted(behavior), await readFile(path.join(folder.path, "start.log"), "utf8"));
    Assert.areEqual("start.log", (await readdir(folder.path)).join(","));
    Assert.areEqual(String.empty, (await readdir(temporary.path)).join(","));
  }

  @TestMethod
  public async fallsBackToAnExtractionWithTheReasonWhenTheMounterCannotBeEndedForAnotherReason(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using temporary = await TemporaryFolderFixture.createAsync();
    const posix: IPosixProcessApi = { startDetached: () => 1.5 };
    const extracted: string[] = [];
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter([], [], null), posix, AppImageCopyLaunchTests.PRESENCE, () => null,
      AppImageCopyLaunchTests.failExtract(extracted), AppImageCopyLaunchTests.LOG);

    await Assert.throwsAsync(
      () => AppImageCopyLaunchTests.startAsync(launch, true, folder.path, path.join(folder.path, "copy.log"), [], { TMPDIR: temporary.path }), AppImageCopyUnavailableException);

    const log = await readFile(path.join(folder.path, "start.log"), "utf8");
    Assert.isTrue(log.startsWith(`${AppImageCopyLaunchTests.IMAGE} could not be mounted, so the runtime starts from an extraction of it: TypeError`), log);
    Assert.areEqual(1, extracted.length);
  }

  @TestMethod
  public async startsTheRuntimeFromItsOwnExtractionAndRecordsIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using temporary = await TemporaryFolderFixture.createAsync();
    using runtime = await AppImageCopyLaunchTests.startProgramAsync();
    const started: (readonly string[])[] = [];
    const environments: NodeJS.ProcessEnv[] = [];
    const posixCalls: (readonly string[])[] = [];
    const record = path.join(folder.path, "copy.log");
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter(started, environments, runtime), AppImageCopyLaunchTests.createPosix(posixCalls, [], null, null),
      AppImageCopyLaunchTests.PRESENCE, () => null, AppImageCopyLaunchTests.extract, AppImageCopyLaunchTests.LOG);

    const processId = await AppImageCopyLaunchTests.startAsync(launch, false, folder.path, record, ["entry.js", `${AppImageCopyLaunchTests.ROOT}/resources/app.asar`],
      { TMPDIR: temporary.path });

    const copy = await AppImageCopyRecord.readAsync(record);
    const [extraction = String.empty] = await readdir(temporary.path);
    const root = path.join(temporary.path, extraction, "squashfs-root");
    Assert.areEqual(runtime.pid, processId);
    Assert.isTrue(/^desktop-runtime-[A-Za-z0-9]{6}$/.test(extraction), extraction);
    Assert.areEqual(`${root}/noldova-desktop|entry.js|${root}/resources/app.asar`, started.map(t => t.join("|")).join(","));
    Assert.areEqual(root, environments[0]?.["APPDIR"]);
    Assert.areEqual(`${runtime.pid} runtime|${path.join(temporary.path, extraction)}`, `${copy?.holder.processId} ${copy?.holder.role}|${copy?.extraction}`);
    Assert.areEqual(0, posixCalls.length);
    Assert.areEqual(String.empty, await readFile(path.join(folder.path, "start.log"), "utf8"));
  }

  @TestMethod
  public async recordsTheLauncherAsTheHolderWhenTheRuntimeIsGoneBeforeItIsListed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using temporary = await TemporaryFolderFixture.createAsync();
    const gone = await AppImageCopyLaunchTests.startEndedProgramAsync();
    const record = path.join(folder.path, "copy.log");
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter([], [], gone), AppImageCopyLaunchTests.createPosix([], [], null, null),
      AppImageCopyLaunchTests.PRESENCE, () => null, AppImageCopyLaunchTests.extract, AppImageCopyLaunchTests.LOG);

    await AppImageCopyLaunchTests.startAsync(launch, false, folder.path, record, [], { TMPDIR: temporary.path });

    const copy = await AppImageCopyRecord.readAsync(record);
    Assert.areEqual(`${process.pid} runtime launcher`, `${copy?.holder.processId} ${copy?.holder.role}`);
  }

  @TestMethod
  public async refusesToStartWhenTheProcessTableDoesNotListTheLauncher(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const extracted: string[] = [];
    const presence = new ProcessPresence("darwin", new ProcessTableFixture([String.empty]), new WindowsProcessApiFixture());
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter([], [], null), AppImageCopyLaunchTests.createPosix([], [], null, null), presence,
      () => null, AppImageCopyLaunchTests.failExtract(extracted), AppImageCopyLaunchTests.LOG);

    const exception = await Assert.throwsAsync(() => AppImageCopyLaunchTests.startAsync(launch, false, folder.path, path.join(folder.path, "copy.log")), AppImageCopyUnlistedException);

    Assert.areEqual(`The process table does not list process ${process.pid}, so the runtime's AppImage copy cannot be recorded.`, exception.message);
    Assert.areEqual(0, extracted.length);
  }

  @TestMethod
  public async removesTheExtractionAndItsRecordWhenTheRuntimeCannotStart(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using temporary = await TemporaryFolderFixture.createAsync();
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter([], [], null), AppImageCopyLaunchTests.createPosix([], [], null, null),
      AppImageCopyLaunchTests.PRESENCE, () => null, AppImageCopyLaunchTests.extract, AppImageCopyLaunchTests.LOG);

    await Assert.throwsAsync(
      () => AppImageCopyLaunchTests.startAsync(launch, false, folder.path, path.join(folder.path, "copy.log"), [], { TMPDIR: temporary.path }), LaunchStartFailedException);

    Assert.areEqual(String.empty, (await readdir(folder.path)).join(","));
    Assert.areEqual(String.empty, (await readdir(temporary.path)).join(","));
  }

  @TestMethod
  public async removesTheExtractionFolderWhenTheRecordCannotBeWritten(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await using temporary = await TemporaryFolderFixture.createAsync();
    const launch = new AppImageCopyLaunch(AppImageCopyLaunchTests.createStarter([], [], null), AppImageCopyLaunchTests.createPosix([], [], null, null),
      AppImageCopyLaunchTests.PRESENCE, () => null, AppImageCopyLaunchTests.extract, AppImageCopyLaunchTests.LOG);

    await Assert.throwsAsync(
      () => AppImageCopyLaunchTests.startAsync(launch, false, folder.path, path.join(folder.path, "missing", "copy.log"), [], { TMPDIR: temporary.path }), Error);

    Assert.areEqual(String.empty, (await readdir(temporary.path)).join(","));
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async runsTheRuntimeHoldingItsOwnMountUntilTheRuntimeEnds(): Promise<void> {
    await using fixture = await AppImageFixture.createAsync();

    const processId = await AppImageCopyLaunchTests.startFromFixtureAsync(fixture, true);
    const mount = AppImageCopyLaunchTests.readCopy(await fixture.readRecordAsync());
    const mounter = Number(path.basename(mount).slice("mount-".length));
    try {
      Assert.areEqual(path.join(fixture.folder, `mount-${mounter}`), mount);
      Assert.areEqual(`${mount}/noldova-desktop|wait|${mount}/resources/app.asar|--data-dir=/data|${mount}|`, await fixture.readRecordAsync());
      Assert.isTrue(await ProgramFixture.waitForEndAsync(mounter, AppImageCopyLaunchTests.LIMIT), "the mounter is ended");
      Assert.isTrue(existsSync(mount), "the mount stays while the runtime holds it");
      Assert.isFalse(existsSync(fixture.copyRecord));
      Assert.isFalse(existsSync(`${fixture.copyRecord}.mount`));
    }
    finally {
      process.kill(processId, "SIGTERM");
    }
    Assert.isTrue(await WaitFixture.untilAsync(async () => (await fixture.listMountsAsync()).length === 0, AppImageCopyLaunchTests.LIMIT), "the mount ends with the runtime");
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  @TestData("refused")
  @TestData("extracted")
  public async runsTheRuntimeFromItsOwnExtractionOfTheAppImage(launcher: string): Promise<void> {
    await using fixture = await AppImageFixture.createAsync();
    await fixture.refuseAsync("mount");

    const processId = await AppImageCopyLaunchTests.startFromFixtureAsync(fixture, launcher === "refused");
    const copy = await AppImageCopyRecord.readAsync(fixture.copyRecord);
    const root = AppImageCopyLaunchTests.readCopy(await fixture.readRecordAsync());
    process.kill(processId, "SIGTERM");

    Assert.areEqual(path.join(String(copy?.extraction), "squashfs-root"), root);
    Assert.areEqual(fixture.temporary, path.dirname(String(copy?.extraction)));
    Assert.areEqual(`${root}/noldova-desktop|wait|${root}/resources/app.asar|--data-dir=/data|${root}|`, await fixture.readRecordAsync());
    Assert.areEqual(`${processId} runtime`, `${copy?.holder.processId} ${copy?.holder.role}`);
    Assert.areEqual(launcher === "refused" ? `${fixture.image} could not be mounted, so the runtime starts from an extraction of it.\n` : String.empty,
      await readFile(path.join(fixture.folder, "start.log"), "utf8"));
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async failsWithTheReasonWhenTheAppImageCanBeNeitherMountedNorExtracted(): Promise<void> {
    await using fixture = await AppImageFixture.createAsync();
    await fixture.refuseAsync("mount");
    await fixture.refuseAsync("extract");

    const exception = await Assert.throwsAsync(() => AppImageCopyLaunchTests.startFromFixtureAsync(fixture, true), AppImageCopyUnavailableException);

    Assert.areEqual(`${fixture.image} could be neither mounted nor extracted, so the runtime cannot start.`, exception.message);
    Assert.areEqual(`${fixture.image} could not be mounted, so the runtime starts from an extraction of it.\n`, await readFile(path.join(fixture.folder, "start.log"), "utf8"));
    Assert.isFalse(existsSync(fixture.copyRecord));
    Assert.isFalse(existsSync(fixture.record));
    Assert.areEqual(String.empty, (await fixture.listExtractionsAsync()).join(","));
  }

  private static startAsync(launch: AppImageCopyLaunch, isMounted: boolean, folder: string, record: string, launchArguments: readonly string[] = ["entry.js"],
    environment: NodeJS.ProcessEnv = {}): Promise<number> {
    const table = isMounted ? `98 29 0:62 / ${AppImageCopyLaunchTests.ROOT} ro,nosuid shared:51 - fuse.fixture fixture ro\n` : String.empty;
    using _fileSystem = new FileSystemPatchFixture(null, table);
    const source = AppImageSource.find({ APPIMAGE: AppImageCopyLaunchTests.IMAGE, APPDIR: AppImageCopyLaunchTests.ROOT }, `${AppImageCopyLaunchTests.ROOT}/noldova-desktop`);
    if (Object.isNull(source))
      throw new Error("The fixture names no AppImage.");
    return launch.startAsync(source, `${AppImageCopyLaunchTests.ROOT}/noldova-desktop`, launchArguments, environment, path.join(folder, "start.log"), record);
  }

  private static async startFromFixtureAsync(fixture: AppImageFixture, isMounted: boolean): Promise<number> {
    const table = isMounted ? `98 29 0:62 / ${fixture.root} ro,nosuid shared:51 - fuse.fixture fixture ro\n` : String.empty;
    const environment = { ...process.env, APPIMAGE: fixture.image, APPDIR: fixture.root, TMPDIR: fixture.temporary, NOLDOVA_DESKTOP_FIXTURE_RECORD: fixture.record };
    const started = (() => {
      using _fileSystem = new FileSystemPatchFixture(null, table);
      const source = AppImageSource.find(environment, fixture.program);
      if (Object.isNull(source))
        throw new Error("The fixture names no AppImage.");
      return new AppImageCopyLaunch(ChildProcessStarter.create("linux"), PosixProcessApi.create(), AppImageCopyLaunchTests.PRESENCE, AppImageKeepalive.open,
        AppImageExtraction.extractAsync, AppImageCopyLaunchTests.LOG).startAsync(source, fixture.program, ["wait", path.join(fixture.root, "resources", "app.asar"), "--data-dir=/data"], environment,
        path.join(fixture.folder, "start.log"), fixture.copyRecord);
    })();
    const processId = await started;
    await fixture.waitForProgramAsync();
    return processId;
  }

  private static readCopy(record: string): string {
    return record.split("|").at(-2) ?? String.empty;
  }

  private static async extract(_image: string, extraction: string): Promise<string> {
    const root = path.join(extraction, "squashfs-root");
    await mkdir(root);
    return root;
  }

  private static failExtract(extracted: string[]): Extract {
    return (image, extraction) => {
      extracted.push(extraction);
      return Promise.reject(new AppImageCopyUnavailableException(image));
    };
  }

  private static describeNotMounted(behavior: string): string {
    const failures: ReadonlyMap<string, string> = new Map([
      ["refused", `Error: The fake addon cannot start ${AppImageCopyLaunchTests.IMAGE}.`],
      ["unopened", "Error: EACCES: permission denied, open '/proc/4321/fd/3'"]
    ]);
    const failure = failures.get(behavior);
    return Object.isUndefined(failure)
      ? AppImageCopyLaunchTests.NOT_MOUNTED
      : `${AppImageCopyLaunchTests.IMAGE} could not be mounted, so the runtime starts from an extraction of it: ${failure}\n`;
  }

  private static createPosix(started: (readonly string[])[], environments: (readonly string[])[], mount: readonly [string, ChildProcess] | null,
    runtime: ChildProcess | null): IPosixProcessApi {
    return {
      startDetached: (file, launchArguments, environment, _errorDescriptor, _workingFolder, outputDescriptor, inputDescriptor) => {
        started.push([file, ...launchArguments, Object.isUndefined(outputDescriptor) ? "no output" : "output", `input ${inputDescriptor ?? "none"}`]);
        environments.push(environment);
        const answer = Object.isUndefined(outputDescriptor) ? runtime : mount?.[1] ?? null;
        if (Object.isNull(answer))
          throw new Error(`The fake addon cannot start ${file}.`);
        if (!Object.isUndefined(outputDescriptor) && !Object.isNull(mount))
          writeSync(outputDescriptor, mount[0]);
        return Number(answer.pid);
      }
    };
  }

  private static createStarter(started: (readonly string[])[], environments: NodeJS.ProcessEnv[], runtime: ChildProcess | null): IProcessStarter {
    return {
      startAsync: async (executable, launchArguments, environment, errorFile) => {
        started.push([executable, ...launchArguments]);
        environments.push(environment);
        if (Object.isNull(runtime))
          throw new LaunchStartFailedException(executable);
        await appendFile(errorFile, String.empty);
        return Number(runtime.pid);
      }
    };
  }

  private static async startProgramAsync(): Promise<ChildProcess> {
    const child = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", windowsHide: true });
    await once(child, "spawn");
    return child;
  }

  private static async startEndedProgramAsync(): Promise<ChildProcess> {
    const child = spawn(process.execPath, ["-e", String.empty], { stdio: "ignore", windowsHide: true });
    await once(child, "exit");
    return child;
  }
}
