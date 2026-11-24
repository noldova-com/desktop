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
import { rm, writeFile } from "node:fs/promises";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode, Request, ShellEvents, ShellMethods, UpdateReady, UpdateRequest, UpdateSaved } from "@noldova/desktop.protocol";
import { ProcessPresence, RuntimeBuild, ServerSettings, UpdateBarrierState } from "@noldova/desktop.runtime";

import { FileReadsFixture } from "../../fixtures/file-reads.fixture.js";
import { FolderWatchFixture } from "../../fixtures/folder-watch.fixture.js";
import { PausedReadFixture } from "../../fixtures/paused-read.fixture.js";
import { ProcessTableFixture } from "../../fixtures/process-table.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { UnreadableFileFixture } from "../../fixtures/unreadable-file.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

@TestClass
export class UpdatePreparationTests {
  @TestMethod
  public reportsAClientThatDoesNotAnswerInTime(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 50, 1_000), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);

      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      const { responses } = await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      const ready = UpdateReady.fromJson(responses.get("main:1")?.payload);
      await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updating);
      const late = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.modules, null);
      const updater = await RuntimeHostFixture.callAsync(mainProcess, "main:2", ShellMethods.modules, null);

      Assert.areEqual("A cli client did not answer in time.", ready.problems.join("|"));
      Assert.areEqual(0, ready.processes.length);
      Assert.areEqual(FailureCode.Updating, late.failure?.code);
      Assert.areEqual(FailureCode.Updating, updater.failure?.code);
    });
  }

  @TestMethod
  public endsOnceTheHolderOfABarrierBeforeItsHandoffHasExited(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const holder = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000);"], { stdio: "ignore" });
      await once(holder, "spawn");
      await UpdateBarrierFixture.holdAsync(installation, Number(holder.pid), UpdateBarrierState.Closing);
      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);

      const { response: whileHeld } = await fixture.handshakeAsync("held", RuntimeBuild.identity);
      holder.kill();
      await UpdateBarrierFixture.readEventAsync(mainProcess, ShellEvents.updateEnded);
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.areEqual(FailureCode.Updating, whileHeld.failure?.code);
      Assert.isFalse(late.hasFailed);
      Assert.isTrue(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public endsAsSoonAsTheBarrierIsRemovedWithoutWaitingForTheHolderCheck(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 2_147_483_647), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);
      using watches = new FolderWatchFixture(installation.folder);

      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      watches.change("barrier.json", 2);
      const { response: whileHeld } = await fixture.handshakeAsync("held", RuntimeBuild.identity);
      await rm(installation.barrierFile);
      watches.change("barrier.json", 1);
      const ended = await UpdateBarrierFixture.readEventAsync(mainProcess, ShellEvents.updateEnded);
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.areEqual(1, watches.count);
      Assert.areEqual(FailureCode.Updating, whileHeld.failure?.code);
      Assert.areEqual("null", JSON.stringify(ended.payload));
      Assert.isFalse(late.hasFailed);
    });
  }

  @TestMethod
  public refusesToPrepareWhenTheInstallationsFolderCannotBeWatched(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      await rm(installation.folder, { recursive: true, force: true });

      const refused = await RuntimeHostFixture.callAsync(mainProcess, "main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson());
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);
      const modules = await RuntimeHostFixture.callAsync(mainProcess, "main:2", ShellMethods.modules, null);

      Assert.areEqual(`${FailureCode.Unavailable}|The runtime could not watch its installation's folder for the end of the update.`,
        `${refused.failure?.code}|${refused.failure?.message}`);
      Assert.isFalse(late.hasFailed);
      Assert.isFalse(modules.hasFailed);
    });
  }

  @TestMethod
  public failsThePreparationAndEndsTheUpdateWhenTheWatchFails(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 30_000, 2_147_483_647), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);
      using watches = new FolderWatchFixture(installation.folder);

      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updating);
      watches.fail("The watch broke.");
      const { responses, events } = await RuntimeHostFixture.readMessagesAsync(mainProcess, 3);
      await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updateEnded);
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.areEqual(`${FailureCode.Unavailable}|The runtime could not watch its installation's folder for the end of the update.`,
        `${responses.get("main:1")?.failure?.code}|${responses.get("main:1")?.failure?.message}`);
      Assert.areEqual(`${ShellEvents.updating}|${ShellEvents.updateEnded}`, events.map(t => String(t.name)).join("|"));
      Assert.isFalse(late.hasFailed);
      Assert.isTrue(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public keepsUpdatingWhileItsHolderCannotBeLookedUpAndEndsOnceItCanBeSeenToHaveExited(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      const windows = new WindowsProcessApiFixture();
      const holderRow = `900501\t1\t${Date.now() - 1_000}\tC:\\Noldova Desktop Sample\\Noldova Desktop Sample.exe`;
      windows.rest = () => holderRow;
      const presence = new ProcessPresence("win32", new ProcessTableFixture([]), windows);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder, presence);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation, 900_501, UpdateBarrierState.Preparing, presence);
      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      using reads = new FileReadsFixture(installation.barrierFile);
      windows.rest = () => {
        throw new Error("The process table could not be read.");
      };
      await reads.waitForMoreAsync(2);
      const { response: whileUnknown } = await fixture.handshakeAsync("unknown", RuntimeBuild.identity);
      windows.rest = () => String.empty;
      await UpdateBarrierFixture.readEventAsync(mainProcess, ShellEvents.updateEnded);
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.areEqual(FailureCode.Updating, whileUnknown.failure?.code);
      Assert.isFalse(late.hasFailed);
    });
  }

  @TestMethod
  public endsTheUpdateWhenLookingUpItsHolderFailsWithAProgrammingError(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      const windows = new WindowsProcessApiFixture();
      const holderRow = `900502\t1\t${Date.now() - 1_000}\tC:\\Noldova Desktop Sample\\Noldova Desktop Sample.exe`;
      windows.rest = () => holderRow;
      const presence = new ProcessPresence("win32", new ProcessTableFixture([]), windows);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder, presence);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation, 900_502, UpdateBarrierState.Preparing, presence);
      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      windows.rest = () => {
        throw new TypeError("The process table reader has a bug.");
      };
      await UpdateBarrierFixture.readEventAsync(mainProcess, ShellEvents.updateEnded);
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.isFalse(late.hasFailed);
      Assert.isTrue(existsSync(installation.barrierFile));
    });
  }

  @TestMethod
  public keepsUpdatingAfterTheHandoffWhateverItsHolderAndEndsOnceTheBarrierIsGone(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const holder = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000);"], { stdio: "ignore" });
      await once(holder, "spawn");
      await UpdateBarrierFixture.holdAsync(installation, Number(holder.pid), UpdateBarrierState.HandedOff);
      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updating);
      await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.updateSaved, new UpdateSaved(process.pid, []).toJson());
      holder.kill();
      await once(holder, "exit");
      using reads = new FileReadsFixture(installation.barrierFile);
      await reads.waitForMoreAsync(2);

      const { response: whileHeld } = await fixture.handshakeAsync("held", RuntimeBuild.identity);
      await rm(installation.barrierFile);
      const ended = await UpdateBarrierFixture.readEventAsync(cli, ShellEvents.updateEnded);
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);
      const modules = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.modules, null);
      const saved = await RuntimeHostFixture.callAsync(cli, "cli:3", ShellMethods.updateSaved, new UpdateSaved(process.pid, []).toJson());

      Assert.areEqual(FailureCode.Updating, whileHeld.failure?.code);
      Assert.areEqual("null", JSON.stringify(ended.payload));
      Assert.isFalse(late.hasFailed);
      Assert.isFalse(modules.hasFailed);
      Assert.areEqual(FailureCode.Conflict, saved.failure?.code);
    });
  }

  @TestMethod
  public answersAtOnceWithoutOtherClientsAndKeepsUpdatingWhileTheBarrierCannotBeReadOrParsed(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 20), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);

      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      const { responses } = await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      const [isRead, [, unreadable]] = await UpdatePreparationTests.readWhileUnreadableAsync(installation.barrierFile,
        () => fixture.handshakeAsync("unreadable", RuntimeBuild.identity));
      await writeFile(installation.barrierFile, "{\"holder\":");
      using reads = new FileReadsFixture(installation.barrierFile);
      await reads.waitForMoreAsync(2);
      const { response: unparsable } = await fixture.handshakeAsync("unparsable", RuntimeBuild.identity);
      await rm(installation.barrierFile);
      await UpdateBarrierFixture.readEventAsync(mainProcess, ShellEvents.updateEnded);
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.isTrue(UpdateReady.fromJson(responses.get("main:1")?.payload).isReady);
      Assert.isTrue(isRead, "the runtime did not read the unreadable barrier");
      Assert.areEqual(FailureCode.Updating, unreadable.failure?.code);
      Assert.areEqual(FailureCode.Updating, unparsable.failure?.code);
      Assert.isFalse(late.hasFailed);
    });
  }

  @TestMethod
  public neitherEndsNorFailsTheNextUpdateWhenACheckForAnEndedOneFinishesLate(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 2_147_483_647), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);
      using read = new PausedReadFixture(installation.barrierFile);
      using watches = new FolderWatchFixture(installation.folder);

      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await read.waitForStartAsync();
      watches.fail("The watch broke.");
      const { responses: first, events: firstEvents } = await RuntimeHostFixture.readMessagesAsync(mainProcess, 3);
      using nextWatches = new FolderWatchFixture(installation.folder);
      mainProcess.sendMessages(new Request("main:2", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      const { responses: next } = await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      read.releaseAsMissing();
      const { response: whileUpdating } = await fixture.handshakeAsync("held", RuntimeBuild.identity);
      await rm(installation.barrierFile);
      nextWatches.change("barrier.json", 1);
      await UpdateBarrierFixture.readEventAsync(mainProcess, ShellEvents.updateEnded);
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.isTrue(UpdateReady.fromJson(first.get("main:1")?.payload).isReady);
      Assert.areEqual(`${ShellEvents.updating}|${ShellEvents.updateEnded}`, firstEvents.map(t => String(t.name)).join("|"));
      Assert.isTrue(UpdateReady.fromJson(next.get("main:2")?.payload).isReady);
      Assert.areEqual(FailureCode.Updating, whileUpdating.failure?.code);
      Assert.isFalse(late.hasFailed);
    });
  }

  @TestMethod
  public endsTheNextUpdateAtOnceWhenACheckForAnEndedOneFinishesLateAndTheBarrierIsGone(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 2_147_483_647), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);
      using read = new PausedReadFixture(installation.barrierFile);
      using watches = new FolderWatchFixture(installation.folder);

      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await read.waitForStartAsync();
      watches.fail("The watch broke.");
      await RuntimeHostFixture.readMessagesAsync(mainProcess, 3);
      using nextWatches = new FolderWatchFixture(installation.folder);
      mainProcess.sendMessages(new Request("main:2", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      const { responses: next } = await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      await rm(installation.barrierFile);
      read.releaseAsMissing();
      await UpdateBarrierFixture.readEventAsync(mainProcess, ShellEvents.updateEnded);
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);

      Assert.isTrue(UpdateReady.fromJson(next.get("main:2")?.payload).isReady);
      Assert.areEqual(1, nextWatches.count);
      Assert.isFalse(late.hasFailed);
    });
  }

  @TestMethod
  public changesNothingWhenACheckForAnEndedUpdateFinishesLateWithNoUpdateWatched(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await fixture.startAsync(30_000, undefined, undefined, process.env, new ServerSettings(undefined, undefined, undefined, undefined, 5_000, 2_147_483_647), installation.folder);
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      await UpdateBarrierFixture.holdAsync(installation);
      using read = new PausedReadFixture(installation.barrierFile);
      using watches = new FolderWatchFixture(installation.folder);

      mainProcess.sendMessages(new Request("main:1", ShellMethods.update, new UpdateRequest(installation.folder).toJson()));
      await read.waitForStartAsync();
      watches.fail("The watch broke.");
      const { events: firstEvents } = await RuntimeHostFixture.readMessagesAsync(mainProcess, 3);
      read.releaseAsMissing();
      const { response: late } = await fixture.handshakeAsync("late", RuntimeBuild.identity);
      mainProcess.sendMessages(new Request("main:2", ShellMethods.updateSaved, new UpdateSaved(process.pid, []).toJson()));
      const next = await mainProcess.readTextAsync();

      Assert.areEqual(`${ShellEvents.updating}|${ShellEvents.updateEnded}`, firstEvents.map(t => String(t.name)).join("|"));
      Assert.isFalse(late.hasFailed);
      Assert.isTrue(next.startsWith("{\"kind\":\"Response\",\"id\":\"main:2\""), next);
    });
  }

  private static async readWhileUnreadableAsync<T>(file: string, readAsync: () => Promise<T>): Promise<[boolean, T]> {
    using barrier = new UnreadableFileFixture(file);
    const isRead = await WaitFixture.untilAsync(() => barrier.refused > 0, 5_000, 20);
    return [isRead, await readAsync()];
  }
}
