/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildIdentity, Failure, FailureCode, PreShellData, QualifiedName, ShellMethods, StopPolicy } from "@noldova/desktop.protocol";
import {
  AppImageCopyUnavailableException,
  AttachOptions,
  BuildMismatchException,
  ConnectionRefusedException,
  type IMethodHandler,
  type IProcessStarter,
  LaunchLimitReachedException,
  LaunchSettings,
  LaunchStartFailedException,
  LaunchTimedOutException,
  MainProcessRefusedAgainException,
  MethodFailureException,
  MoveAsideRefusedException,
  NoRuntimeException,
  OwnershipLock,
  PreShellDataFoundException,
  Refusal,
  type RequestContext,
  RuntimeBuild,
  RuntimeEntry,
  RuntimeExitedException,
  RuntimeHandoverException,
  RuntimeLauncher,
  StopRefusedException,
  StopTimedOutException,
  UpdateBarrierStatus,
  UpdateInProgressException,
  WorkInProgressException
} from "@noldova/desktop.runtime";

import { ClientListenerFixture } from "../../fixtures/client-listener.fixture.js";
import { ErrorCodeFixture } from "../../fixtures/error-code.fixture.js";
import { FakeRuntimeFixture } from "../../fixtures/fake-runtime.fixture.js";
import { FileReadsFixture } from "../../fixtures/file-reads.fixture.js";
import { HeldOpenFixture } from "../../fixtures/held-open.fixture.js";
import { HeldRenameFixture } from "../../fixtures/held-rename.fixture.js";
import { RenameRetryFixture } from "../../fixtures/rename-retry.fixture.js";
import { RuntimeBuildFixture } from "../../fixtures/runtime-build.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { RuntimeLaunchFixture } from "../../fixtures/runtime-launch.fixture.js";
import { RuntimeServerFixture } from "../../fixtures/runtime-server.fixture.js";
import { ScriptedStarterFixture } from "../../fixtures/scripted-starter.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";
import { WatchPatchFixture } from "../../fixtures/watch-patch.fixture.js";

@TestClass
export class RuntimeLauncherTests {
  private static readonly PROBE_COUNT: QualifiedName = new QualifiedName("probe", "count");
  private static readonly PROBE_PART: string = [
    "import { Migration } from \"@noldova/desktop.runtime\";",
    "export class RuntimePart {",
    "  migrations = [new Migration(\"create-entries\", [\"CREATE TABLE entries (value TEXT NOT NULL) STRICT\"])];",
    "  async activateAsync(context) {",
    "    const database = context.database;",
    "    context.registerMethod(\"probe.count\", { handleAsync: async () => {",
    "      database.run(\"INSERT INTO entries (value) VALUES ('entry')\");",
    "      return { entries: database.readAll(\"SELECT value FROM entries\").length };",
    "    } });",
    "  }",
    "  async deactivateAsync() {}",
    "}"
  ].join("\n");
  private static readonly PROBE_COMPLAIN: QualifiedName = new QualifiedName("probe", "complain");
  private static readonly COMPLAINT: string = "The probe complained after the launcher reached its runtime.";
  private static readonly COMPLAINING_PART: string = [
    "export class RuntimePart {",
    "  async activateAsync(context) {",
    "    context.registerMethod(\"probe.complain\", { handleAsync: async request => {",
    `      console.error(request.payload?.size > 0 ? "x ".repeat(request.payload.size / 2) : ${JSON.stringify(RuntimeLauncherTests.COMPLAINT)});`,
    "      return null;",
    "    } });",
    "  }",
    "  async deactivateAsync() {}",
    "}"
  ].join("\n");
  @TestMethod
  public async startsTheRuntimeItselfWithNoShellOnLinuxOutsideAnAppImage(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const settings = launch.createSettings();
    const linux = new LaunchSettings(settings.dataDirectory, settings.executablePath, settings.entryPath, {}, "linux");
    const started: string[] = [];
    const starter: IProcessStarter = {
      startAsync: (executable, launchArguments) => {
        started.push([executable, launchArguments[0]].join("|"));
        return Promise.reject(new LaunchStartFailedException(executable));
      }
    };

    await Assert.throwsAsync(() => UpdateBarrierFixture.createLauncher(linux, RuntimeBuild.identity, starter).attachAsync("main", new ClientListenerFixture()), LaunchStartFailedException);

    Assert.areEqual(`${settings.executablePath}|${settings.entryPath}`, started[0]);
  }

  @TestMethod
  public async startsTheRuntimeFromItsOwnExtractionOfAnUnmountedAppImageOnLinux(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using temporary = await TemporaryFolderFixture.createAsync();
    const settings = launch.createSettings();
    const environment = { APPIMAGE: "/home/person/Noldova Desktop Sample.AppImage", APPDIR: "/tmp/.mount_AbCdEf", TMPDIR: temporary.path };
    const linux = new LaunchSettings(settings.dataDirectory, "/tmp/.mount_AbCdEf/noldova-desktop", settings.entryPath, environment, "linux");
    const started: string[] = [];
    const starter: IProcessStarter = {
      startAsync: executable => {
        started.push(executable);
        return Promise.reject(new LaunchStartFailedException(executable));
      }
    };

    const exception = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(linux, RuntimeBuild.identity, starter).attachAsync("main", new ClientListenerFixture()), AppImageCopyUnavailableException);

    Assert.areEqual("/home/person/Noldova Desktop Sample.AppImage could be neither mounted nor extracted, so the runtime cannot start.", exception.message);
    Assert.areEqual(0, started.length);
    Assert.areEqual(String.empty, (await readdir(temporary.path)).join(","));
  }

  @TestMethod
  public async startsARuntimeAndStopsItOnRequest(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("main", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    const response = await client.stopAsync(StopPolicy.IfIdle);

    Assert.isNull(client.handover);
    Assert.isFalse(response.hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId), "the runtime process exits");
    Assert.isFalse(OwnershipLock.isOwned(launch.dataDirectory));
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
    Assert.areEqual("runtime.errors.log,runtime.log", (await readdir(launch.dataDirectory.logsFolder)).sort().join(","), "the start log is kept as the runtime's errors once attached");
  }

  @TestMethod
  public async startsARuntimeThatJoinsItsInstallation(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = UpdateBarrierFixture.open(folder.path);
    const client = await new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, installation, () => undefined, launch.starter).attachAsync("main", new ClientListenerFixture());

    const recorded = await readdir(installation.recordFolder);
    await client.stopAsync(StopPolicy.IfIdle);

    Assert.areEqual(1, recorded.length);
  }

  @TestMethod
  public async startsNoRuntimeWhileAnUpdateHoldsItsInstallation(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = UpdateBarrierFixture.open(folder.path);
    await UpdateBarrierFixture.holdAsync(installation);

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, installation, () => undefined, launch.starter).attachAsync("main", new ClientListenerFixture()),
      UpdateInProgressException);

    Assert.areEqual(UpdateBarrierStatus.Held, exception.status);
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
    Assert.isFalse(existsSync(installation.recordFolder));
  }

  @TestMethod
  public async reportsAnUpdateWhenTheRuntimeItStartedExitsForABarrierThatAppearedMeanwhile(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = UpdateBarrierFixture.open(folder.path);
    const starter: IProcessStarter = {
      startAsync: async (executable, launchArguments, environment, errorFile) => {
        await UpdateBarrierFixture.holdAsync(installation);
        return await launch.starter.startAsync(executable, launchArguments, environment, errorFile);
      }
    };

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, installation, () => undefined, starter).attachAsync("main", new ClientListenerFixture()),
      UpdateInProgressException);

    Assert.areEqual(UpdateBarrierStatus.Held, exception.status);
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
    Assert.areEqual(1, (await readdir(installation.recordFolder)).length);
  }

  @TestMethod
  public async reportsTheExitWhenTheBarrierCannotBeReadOnceTheRuntimeItStartedHasExited(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const installation = UpdateBarrierFixture.open(folder.path);
    const starter: IProcessStarter = {
      startAsync: async (executable, launchArguments, environment, errorFile) => {
        await mkdir(installation.barrierFile, { recursive: true });
        return await launch.starter.startAsync(executable, launchArguments, environment, errorFile);
      }
    };

    const exception = await Assert.throwsAsync(
      () => new RuntimeLauncher(launch.createSettings(), RuntimeBuild.identity, installation, () => undefined, starter).attachAsync("main", new ClientListenerFixture()),
      RuntimeExitedException);

    Assert.isTrue(exception.message.includes("EISDIR"), exception.message);
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
  }

  @TestMethod
  public async clientsStartingTogetherShareOneRuntime(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const launchers = [1, 2, 3].map(() => UpdateBarrierFixture.createLauncher(launch.createSettings(1_000), RuntimeBuild.identity, launch.starter));

    const clients = await Promise.all(launchers.map((t, index) => t.attachAsync(`client${index}`, new ClientListenerFixture())));
    const processId = await launch.readProcessIdAsync();
    const listener = new ClientListenerFixture();
    const late = await UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("late", listener);

    Assert.areEqual(3, clients.filter(t => t.isConnected).length);
    Assert.areEqual(processId, await launch.readProcessIdAsync());
    Assert.isFalse((await late.stopAsync(StopPolicy.IfIdle)).hasFailed);
    await listener.disconnectedAsync;
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async anIdleRuntimeEndsItsProcess(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const listener = new ClientListenerFixture();
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(300), RuntimeBuild.identity, launch.starter).attachAsync("main", listener);
    const processId = await launch.readProcessIdAsync();

    client.close();

    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId), "the idle runtime's process exits");
    Assert.isFalse(OwnershipLock.isOwned(launch.dataDirectory));
    Assert.isFalse(existsSync(launch.dataDirectory.discoveryFile));
    Assert.areEqual(1, listener.disconnections);
  }

  @TestMethod
  public async aNewerBuildTakesOverAnOlderRuntime(): Promise<void> {
    await using older = await RuntimeBuildFixture.createAsync("0.0.0");
    await using launch = await RuntimeLaunchFixture.createAsync();
    const olderClient = await UpdateBarrierFixture.createLauncher(launch.createSettings(30_000, older.entryPath), older.identity, launch.starter).attachAsync("older", new ClientListenerFixture());
    const olderProcessId = await launch.readProcessIdAsync();
    olderClient.close();

    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("main", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    Assert.isNull(client.handover);
    Assert.areNotEqual(olderProcessId, processId);
    Assert.isFalse(RuntimeLaunchFixture.isRunning(olderProcessId));
    Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async anOlderBuildHandsOverToANewerRuntime(): Promise<void> {
    await using newer = await RuntimeBuildFixture.createAsync("999.0.0");
    await using launch = await RuntimeLaunchFixture.createAsync();
    const newerClient = await UpdateBarrierFixture.createLauncher(launch.createSettings(30_000, newer.entryPath), newer.identity, launch.starter).attachAsync("newer", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    const handover = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("main", new ClientListenerFixture()),
      RuntimeHandoverException);

    Assert.areEqual("999.0.0", handover.handover.identity.productVersion);
    Assert.areEqual(newer.identity.fingerprint, handover.handover.identity.fingerprint);
    Assert.areEqual(process.execPath, handover.handover.executablePath);
    Assert.isTrue(RuntimeLaunchFixture.isRunning(processId), "the newer runtime keeps running");
    Assert.isFalse((await newerClient.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async aModuleWhoseRuntimePartImportsTheRuntimesApiActivatesInTheRuntimesProcess(): Promise<void> {
    await using build = await RuntimeBuildFixture.createWithModuleAsync("0.0.0", "probe", "probe.count", RuntimeLauncherTests.PROBE_PART);
    await using launch = await RuntimeLaunchFixture.createAsync();
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(30_000, build.entryPath), build.identity, launch.starter).attachAsync("main", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    const response = await client.callAsync(RuntimeLauncherTests.PROBE_COUNT, null);

    Assert.areEqual("{\"entries\":1}", JSON.stringify(response.payload));
    Assert.isTrue(existsSync(launch.dataDirectory.locateModuleDatabase("probe")));
    Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async keepsWhatTheRuntimeWritesToStandardErrorAfterItWasReachedWithTheEarlierRuntimesBeside(): Promise<void> {
    await using build = await RuntimeBuildFixture.createWithModuleAsync("0.0.0", "probe", "probe.complain", RuntimeLauncherTests.COMPLAINING_PART);
    await using launch = await RuntimeLaunchFixture.createAsync();
    await mkdir(launch.dataDirectory.logsFolder, { recursive: true });
    await writeFile(launch.dataDirectory.runtimeErrorsLog, "The earlier runtime's text for person@example.com.\n");
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(30_000, build.entryPath), build.identity, launch.starter).attachAsync("main", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    await client.callAsync(RuntimeLauncherTests.PROBE_COMPLAIN, null);
    Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));

    Assert.isTrue(readFileSync(launch.dataDirectory.runtimeErrorsLog, "utf8").includes(`${RuntimeLauncherTests.COMPLAINT}\n`), "the runtime's standard error follows the rename");
    Assert.areEqual("The earlier runtime's text for [redacted].\n", readFileSync(launch.dataDirectory.previousRuntimeErrorsLog, "utf8"));
    Assert.areEqual("runtime.errors.log,runtime.log,runtime.previous.errors.log", (await readdir(launch.dataDirectory.logsFolder)).sort().join(","));
  }

  @TestMethod
  public async cutsBackTheStandardErrorOfARuntimeItReachedPastItsLimit(): Promise<void> {
    await using build = await RuntimeBuildFixture.createWithModuleAsync("0.0.0", "probe", "probe.complain", RuntimeLauncherTests.COMPLAINING_PART);
    await using launch = await RuntimeLaunchFixture.createAsync();
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(30_000, build.entryPath), build.identity, launch.starter).attachAsync("main", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    await client.callAsync(RuntimeLauncherTests.PROBE_COMPLAIN, { size: 1_100_000 });
    Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));

    Assert.isTrue(statSync(launch.dataDirectory.runtimeErrorsLog).size < 1_048_576, "the runtime cut its standard error back when it stopped");
    Assert.areEqual(1_048_576, statSync(launch.dataDirectory.previousRuntimeErrorsLog).size);
  }

  @TestMethod
  public async keepsTheStartLogWhenTheEarlierErrorsCannotMoveAside(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    await mkdir(path.join(launch.dataDirectory.previousRuntimeErrorsLog, "held"), { recursive: true });
    await writeFile(launch.dataDirectory.runtimeErrorsLog, "The earlier runtime's text.\n");
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("main", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    const files = (await readdir(launch.dataDirectory.logsFolder)).sort();
    Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));

    Assert.areEqual(4, files.length, files.join(","));
    Assert.isTrue(/^start-[0-9a-f-]{36}\.log$/u.test(String(files[3])), files.join(","));
    Assert.areEqual("The earlier runtime's text.\n", readFileSync(launch.dataDirectory.runtimeErrorsLog, "utf8"));
  }

  @TestMethod
  public async keepsTheStartLogWhenItCannotTakeTheErrorsLogsPlace(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    using held = new HeldRenameFixture(launch.dataDirectory.runtimeErrorsLog, ["EPERM"]);
    const client = await UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("main", new ClientListenerFixture());
    const processId = await launch.readProcessIdAsync();

    const files = (await readdir(launch.dataDirectory.logsFolder)).sort();
    Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));

    Assert.areEqual(1, held.attempts);
    Assert.isTrue(files.some(t => /^start-[0-9a-f-]{36}\.log$/u.test(t)), files.join(","));
    Assert.isFalse(files.includes("runtime.errors.log"), files.join(","));
  }

  @TestMethod
  public async failsWhenTheEarlierErrorsCannotBeKeptForAnotherReason(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    using held = new HeldOpenFixture(launch.dataDirectory.runtimeErrorsLog);
    held.fail("EIO");
    const listener = new ClientListenerFixture();

    const error = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("main", listener), Error);
    await listener.disconnectedAsync;

    Assert.areEqual("EIO: held by the test", error.message);
    Assert.areEqual(launch.dataDirectory.runtimeErrorsLog, held.held.join(","));
    Assert.areEqual(1, listener.disconnections);
  }

  @TestMethod
  public async failsWhenTheStartLogCannotTakeTheErrorsLogsPlaceForAnotherReason(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    using held = new HeldRenameFixture(launch.dataDirectory.runtimeErrorsLog, ["EIO"]);
    const listener = new ClientListenerFixture();

    const error = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, launch.starter).attachAsync("main", listener), Error);
    await listener.disconnectedAsync;

    Assert.areEqual("EIO", ErrorCodeFixture.of(error));
    Assert.areEqual(1, held.attempts);
    Assert.areEqual(1, listener.disconnections);
  }

  @TestMethod
  public reportsWorkInProgressInsteadOfTakingOver(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async (fixture, settings) => {
      const host = await fixture.startAsync();
      host.work.begin("Indexing the project");
      const newer = new BuildIdentity("999.0.0", BuildIdentity.supportedProtocolVersion, "newer-build");

      const exception = await Assert.throwsAsync(() => UpdateBarrierFixture.createLauncher(settings, newer).attachAsync("main", new ClientListenerFixture()), WorkInProgressException);

      Assert.areEqual("Indexing the project", exception.work.descriptions.join(","));
      Assert.isTrue(OwnershipLock.isOwned(fixture.dataDirectory), "the runtime keeps running");
    });
  }

  @TestMethod
  public startsNothingWhenToldNotToStart(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async fixture => {
      const settings = new LaunchSettings(fixture.dataDirectory, path.join(fixture.root, "missing-program"), RuntimeEntry.entryPath, {}, process.platform, 1_000, 1_000);

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(settings, RuntimeBuild.identity).attachAsync("cli", new ClientListenerFixture(), StopPolicy.IfIdle, new AttachOptions(false)),
        NoRuntimeException);

      Assert.areEqual(`No runtime is running for ${fixture.dataDirectory.root}.`, exception.message);
      Assert.isFalse(existsSync(fixture.dataDirectory.logsFolder), "no start was tried");
    });
  }

  @TestMethod
  public attachesToARunningRuntimeWhenToldNotToStart(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async (fixture, settings) => {
      const host = await fixture.startAsync();

      const client = await UpdateBarrierFixture.createLauncher(settings, RuntimeBuild.identity).attachAsync("cli", new ClientListenerFixture(), StopPolicy.IfIdle, new AttachOptions(false));

      Assert.isTrue(client.isConnected);
      Assert.isFalse((await client.stopAsync(StopPolicy.IfIdle)).hasFailed);
      Assert.areEqual("request", await host.waitForStopAsync());
    });
  }

  @TestMethod
  public refusesAnotherBuildsRuntimeWhenToldNotToTakeOver(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async (fixture, settings) => {
      await fixture.startAsync();
      const newer = new BuildIdentity("999.0.0", BuildIdentity.supportedProtocolVersion, "newer-build");

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(settings, newer).attachAsync("cli", new ClientListenerFixture(), StopPolicy.IfIdle, new AttachOptions(true, false)),
        BuildMismatchException);

      Assert.areEqual(RuntimeBuild.identity.fingerprint, exception.handover.identity.fingerprint);
      Assert.areEqual(process.execPath, exception.handover.executablePath);
      Assert.isTrue(OwnershipLock.isOwned(fixture.dataDirectory), "the runtime keeps running");
    });
  }

  @TestMethod
  public refusesToAttachToARuntimeHoldingDataFromBeforeTheShell(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async (fixture, settings) => {
      await mkdir(fixture.dataDirectory.root, { recursive: true });
      await writeFile(path.join(fixture.dataDirectory.root, "noldova-desktop.db"), "old data");
      await fixture.startAsync();
      const launcher = UpdateBarrierFixture.createLauncher(settings, RuntimeBuild.identity);

      const exception = await Assert.throwsAsync(() => launcher.attachAsync("main", new ClientListenerFixture()), PreShellDataFoundException);
      const client = await launcher.moveAsideAsync("main", new ClientListenerFixture());
      const again = await launcher.moveAsideAsync("main", new ClientListenerFixture());

      Assert.areEqual(fixture.dataDirectory.root, exception.data.location);
      Assert.isTrue(client.isConnected);
      Assert.isNull(client.preShellData);
      Assert.isNull(again.preShellData);
      Assert.isFalse(existsSync(path.join(fixture.dataDirectory.root, "noldova-desktop.db")));
    });
  }

  @TestMethod
  public reportsAFailedMoveAside(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const failure = new Failure(FailureCode.PreShellData, "Move it.", new PreShellData(fake.dataDirectory.root).toJson());
      fake.server.server.refuse(new Refusal(failure, ShellMethods.moveAside));
      fake.server.methods.register(ShellMethods.moveAside, { handleAsync: () => Promise.reject(new MethodFailureException(new Failure(FailureCode.Internal, "The disk is full."))) });

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).moveAsideAsync("main", new ClientListenerFixture()),
        MoveAsideRefusedException);

      Assert.areEqual("The runtime could not move the old data aside: The disk is full.", exception.message);
    });
  }

  @TestMethod
  public async reportsAnOlderRuntimeThatRefusesToStop(): Promise<void> {
    for (const failure of [new Failure(FailureCode.Internal, "It broke."), new Failure(FailureCode.Conflict, "It is busy.")]) {
      await RuntimeLauncherTests.runWithFakeAsync(async fake => {
        fake.server.methods.register(ShellMethods.stop, { handleAsync: () => Promise.reject(new MethodFailureException(failure)) });

        const exception = await Assert.throwsAsync(
          () => UpdateBarrierFixture.createLauncher(fake.createSettings(), FakeRuntimeFixture.NEWER).attachAsync("main", new ClientListenerFixture(), StopPolicy.StopWork),
          StopRefusedException);

        Assert.areEqual(`The other build's runtime refused to stop: ${failure.message}`, exception.message);
      });
    }
  }

  @TestMethod
  public takesOverTheRuntimeOfAnotherCopyOfItsBuildThatRefusedItsMainProcess(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const stops: string[] = [];
      fake.server.checkMainProcessAsync = () => Promise.resolve(false);
      fake.server.methods.register(ShellMethods.stop, RuntimeLauncherTests.releasingStop(fake, stops));
      const starter = RuntimeLauncherTests.owningStarter(fake, () => {
        fake.server.checkMainProcessAsync = () => Promise.resolve(true);
      });

      const client = await UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY, starter).attachAsync("main", new ClientListenerFixture());

      Assert.isNull(client.handover);
      Assert.isFalse(client.isRefusedAsMainProcess);
      Assert.areEqual("main", stops.join());
      Assert.areEqual(1, starter.starts);
      client.close();
    });
  }

  @TestMethod
  public failsWhenTheRuntimeRefusesItsMainProcessAgainAfterItTookOver(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const stops: string[] = [];
      fake.server.checkMainProcessAsync = () => Promise.resolve(false);
      fake.server.methods.register(ShellMethods.stop, RuntimeLauncherTests.releasingStop(fake, stops));
      const starter = RuntimeLauncherTests.owningStarter(fake, () => undefined);

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY, starter).attachAsync("main", new ClientListenerFixture()),
        MainProcessRefusedAgainException);

      Assert.areEqual("The runtime refused this app's main process, also after the app restarted it from its own program.", exception.message);
      Assert.areEqual("main", stops.join());
      Assert.areEqual(1, starter.starts);
      await fake.server.waitUntilAsync(() => fake.server.server.sessionCount === 0);
    });
  }

  @TestMethod
  public givesUpOnAnOlderRuntimeThatDoesNotStop(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      fake.server.methods.register(ShellMethods.stop, { handleAsync: () => Promise.resolve(null) });

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(300), FakeRuntimeFixture.NEWER).attachAsync("main", new ClientListenerFixture()),
        StopTimedOutException);

      Assert.areEqual("The other build's runtime did not stop in time.", exception.message);
    });
  }

  @TestMethod
  public waitsForAnOlderRuntimeToStopPastTheLaunchTimeoutAndThenLaunchesWithAFullTimeout(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      fake.server.methods.register(ShellMethods.stop, { handleAsync: () => {
        setTimeout(() => fake.release(), 3_000);
        return Promise.resolve(null);
      } });
      const starter = new ScriptedStarterFixture(`console.error("It started after the stop."); process.exit(1);`);

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(2_000, 2_000, 10_000), FakeRuntimeFixture.NEWER, starter).attachAsync("main", new ClientListenerFixture()),
        RuntimeExitedException);

      Assert.areEqual("The runtime exited while starting: It started after the stop.", exception.message);
      Assert.areEqual(1, starter.processIds.length);
    });
  }

  @TestMethod
  public givesUpAtItsLimitOnAnOwnedDirectoryWhoseRuntimeItCannotReach(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      await fake.server.server.closeAsync();

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(300, 600), RuntimeServerFixture.IDENTITY).attachAsync("main", new ClientListenerFixture()),
        LaunchLimitReachedException);

      Assert.areEqual("A runtime held the data directory but was not reachable within 0.6 s.", exception.message);
    });
  }

  @TestMethod
  public passesOnARefusedConnection(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("main", new ClientListenerFixture()),
        ConnectionRefusedException);

      Assert.areEqual(FailureCode.Unauthorized, exception.failure?.code);
    }, "wrong-token");
  }

  @TestMethod
  public triesAgainWhenTheRuntimeThatRefusedTheTokenHasPublishedAnother(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const earlier = readFileSync(fake.dataDirectory.discoveryFile, "utf8");
      let open = 0;
      fake.server.onChange = () => {
        if (fake.server.server.sessionCount > open)
          RuntimeLauncherTests.publish(fake.dataDirectory.discoveryFile, earlier.replace("earlier-token", RuntimeServerFixture.TOKEN));
        open = fake.server.server.sessionCount;
      };

      const client = await UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("main", new ClientListenerFixture());

      Assert.isTrue(client.isConnected);
      client.close();
    }, "earlier-token");
  }

  @TestMethod
  public passesOnATokenRefusedAgainAfterEachNewPublication(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      const earlier = readFileSync(fake.dataDirectory.discoveryFile, "utf8");
      let publications = 0;
      let open = 0;
      let connections = 0;
      fake.server.onChange = () => {
        if (fake.server.server.sessionCount > open) {
          connections++;
          RuntimeLauncherTests.publish(fake.dataDirectory.discoveryFile, earlier.replace("earlier-token", `other-token-${++publications}`));
        }
        open = fake.server.server.sessionCount;
      };

      const exception = await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("main", new ClientListenerFixture()),
        ConnectionRefusedException);

      Assert.areEqual(FailureCode.Unauthorized, exception.failure?.code);
      Assert.areEqual(4, connections);
    }, "earlier-token");
  }

  @TestMethod
  public passesOnUnreadableDiscovery(): Promise<void> {
    return RuntimeLauncherTests.runWithFakeAsync(async fake => {
      await Assert.throwsAsync(
        () => UpdateBarrierFixture.createLauncher(fake.createSettings(), RuntimeServerFixture.IDENTITY).attachAsync("main", new ClientListenerFixture()),
        Error);
    }, undefined, "tcp://127.0.0.1:port");
  }

  @TestMethod
  public reportsARuntimeThatCannotStart(): Promise<void> {
    return RuntimeLauncherTests.runWithHostAsync(async fixture => {
      const missing = path.join(fixture.root, "missing-program");
      const settings = new LaunchSettings(fixture.dataDirectory, missing, RuntimeEntry.entryPath, {}, "win32", 1_000, 1_000);

      const exception = await Assert.throwsAsync(() => UpdateBarrierFixture.createLauncher(settings, RuntimeBuild.identity).attachAsync("main", new ClientListenerFixture()), LaunchStartFailedException);

      Assert.areEqual(`The program ${missing} could not be started.`, exception.message);
      Assert.isInstanceOf(exception.cause, Error);
    });
  }

  @TestMethod
  public async waitsPastItsTimeoutWhileTheRuntimeItStartedOwnsTheDirectory(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture("setInterval(() => {}, 1000);");
    const publishing = delay(600).then(() => fake.publishAsync());

    const client = await UpdateBarrierFixture.createLauncher(fake.createSettings(200, 5_000), RuntimeServerFixture.IDENTITY, starter).attachAsync("main", new ClientListenerFixture());
    client.close();
    await publishing;
    const processId = Number(starter.processIds[0]);
    process.kill(processId);

    Assert.areEqual(1, starter.processIds.length);
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async waitsPastItsTimeoutForARuntimeThatWonTheDirectoryFromTheOneItStarted(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture("process.exit(0);");
    const publishing = delay(600).then(() => fake.publishAsync());

    const client = await UpdateBarrierFixture.createLauncher(fake.createSettings(200, 5_000), RuntimeServerFixture.IDENTITY, starter).attachAsync("main", new ClientListenerFixture());
    client.close();
    await publishing;

    Assert.areEqual(1, starter.processIds.length);
    Assert.areEqual(String.empty, (await readdir(fake.dataDirectory.logsFolder)).join(","), "the start log of a runtime that is not the one reached is removed");
  }

  @TestMethod
  public async removesTheStartLogAndKeepsNoErrorsWhenItNeverReachesTheRuntime(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    fake.release();
    const starter = new ScriptedStarterFixture("console.error(\"The runtime never published.\"); setInterval(() => {}, 1000);");

    const exception = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(fake.createSettings(400), RuntimeServerFixture.IDENTITY, starter).attachAsync("main", new ClientListenerFixture()),
      LaunchTimedOutException);
    const processId = Number(starter.processIds[0]);
    process.kill(processId);

    Assert.areEqual("The runtime did not start in time.", exception.message);
    Assert.areEqual(String.empty, (await readdir(fake.dataDirectory.logsFolder)).join(","));
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async givesUpAtItsLimitWhenTheDirectoryStaysOwnedButNoRuntimeIsReachable(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture("setInterval(() => {}, 1000);");

    const exception = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(fake.createSettings(200, 800), RuntimeServerFixture.IDENTITY, starter).attachAsync("main", new ClientListenerFixture()),
      LaunchLimitReachedException);
    const processId = Number(starter.processIds[0]);
    process.kill(processId);

    Assert.areEqual("A runtime held the data directory but was not reachable within 0.8 s.", exception.message);
    Assert.areEqual(String.empty, (await readdir(fake.dataDirectory.logsFolder)).join(","));
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async reportsWhyTheRuntimeItStartedExitedAfterItsTimeout(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    const starter = new ScriptedStarterFixture(`setTimeout(() => { console.error("The database is damaged."); process.exit(1); }, 400);`);
    const attaching = Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(fake.createSettings(200, 5_000), RuntimeServerFixture.IDENTITY, starter).attachAsync("main", new ClientListenerFixture()),
      RuntimeExitedException);

    Assert.isTrue(await WaitFixture.untilAsync(() => starter.processIds.length > 0, 5_000), "The launcher started no runtime within 5 s.");
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(Number(starter.processIds[0])));
    fake.release();
    const exception = await attaching;

    Assert.areEqual("The runtime exited while starting: The database is damaged.", exception.message);
    Assert.areEqual(String.empty, (await readdir(fake.dataDirectory.logsFolder)).join(","));
  }

  @TestMethod
  public async connectsOnceTheRuntimeItWaitsForPublishesItsDiscovery(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    using reads = new FileReadsFixture(fake.dataDirectory.discoveryFile);
    const read = reads.waitForMoreAsync(1);
    const starter = new ScriptedStarterFixture("setInterval(() => {}, 1000);");
    const attaching = UpdateBarrierFixture.createLauncher(fake.createSettings(30_000), RuntimeServerFixture.IDENTITY, starter).attachAsync("main", new ClientListenerFixture());

    await read;
    await fake.publishAsync();
    const client = await attaching;
    const isConnected = client.isConnected;
    client.close();
    const processId = Number(starter.processIds[0]);
    process.kill(processId);

    Assert.isTrue(isConnected, "the publication wakes the launcher while the runtime it started still runs and the directory stays owned");
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async connectsByCheckingTheDiscoveryWhenItsFolderCannotBeWatched(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    using _watches = new WatchPatchFixture(0);
    using reads = new FileReadsFixture(fake.dataDirectory.discoveryFile);
    const read = reads.waitForMoreAsync(1);
    const starter = new ScriptedStarterFixture("setInterval(() => {}, 1000);");
    const logged: string[] = [];
    const attaching = UpdateBarrierFixture.createLauncher(fake.createSettings(30_000), RuntimeServerFixture.IDENTITY, starter, t => logged.push(t))
      .attachAsync("main", new ClientListenerFixture());

    await read;
    await fake.publishAsync();
    const client = await attaching;
    const isConnected = client.isConnected;
    client.close();
    const processId = Number(starter.processIds[0]);
    process.kill(processId);

    Assert.isTrue(isConnected, "a check tick finds the publication though no watch runs");
    Assert.areEqual(1, logged.length);
    Assert.isTrue(logged[0]?.startsWith(`The folder ${fake.dataDirectory.discoveryFolder} could not be watched for changes, ` +
      "so the launcher checks it every 100 ms instead: Error: ENOSPC: System limit for number of file watchers reached") === true, String(logged[0]));
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  @TestMethod
  public async connectsByCheckingTheDiscoveryOnceTheWatchFailsWhileItWaits(): Promise<void> {
    await using fake = await FakeRuntimeFixture.ownAsync();
    using watches = new WatchPatchFixture();
    using reads = new FileReadsFixture(fake.dataDirectory.discoveryFile);
    const read = reads.waitForMoreAsync(1);
    const starter = new ScriptedStarterFixture("setInterval(() => {}, 1000);");
    const logged: string[] = [];
    const attaching = UpdateBarrierFixture.createLauncher(fake.createSettings(30_000), RuntimeServerFixture.IDENTITY, starter, t => logged.push(t))
      .attachAsync("main", new ClientListenerFixture());

    await read;
    watches.fail(new Error("EPERM: operation not permitted, watch"));
    await fake.publishAsync();
    const client = await attaching;
    const isConnected = client.isConnected;
    client.close();
    const processId = Number(starter.processIds[0]);
    process.kill(processId);

    Assert.isTrue(isConnected, "a check tick finds the publication after the watch ended");
    Assert.areEqual(JSON.stringify([`The folder ${fake.dataDirectory.discoveryFolder} could not be watched for changes, ` +
      "so the launcher checks it every 100 ms instead: Error: EPERM: operation not permitted, watch"]), JSON.stringify(logged));
    Assert.areEqual(fake.dataDirectory.root, watches.folders.join(","));
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(processId));
  }

  private static async runWithHostAsync(test: (fixture: RuntimeHostFixture, settings: LaunchSettings) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeHostFixture.createAsync();
    await test(fixture, new LaunchSettings(fixture.dataDirectory, process.execPath, RuntimeEntry.entryPath, {}, process.platform, 30_000, 5_000));
  }

  private static releasingStop(fake: FakeRuntimeFixture, stops: string[]): IMethodHandler {
    return {
      handleAsync: (context: RequestContext) => {
        stops.push(context.client);
        fake.release();
        return Promise.resolve(null);
      }
    };
  }

  private static owningStarter(fake: FakeRuntimeFixture, change: () => void): IProcessStarter & { starts: number } {
    return {
      starts: 0,
      async startAsync(): Promise<number> {
        this.starts++;
        change();
        await fake.ownAgainAsync();
        return process.pid;
      }
    };
  }

  private static async runWithFakeAsync(test: (fake: FakeRuntimeFixture) => Promise<void>, token?: string, endpoint?: string): Promise<void> {
    await using fake = await FakeRuntimeFixture.startAsync(token, endpoint);
    await test(fake);
  }

  private static publish(file: string, text: string): void {
    writeFileSync(`${file}.part`, text);
    RenameRetryFixture.renameSync(`${file}.part`, file);
  }
}
