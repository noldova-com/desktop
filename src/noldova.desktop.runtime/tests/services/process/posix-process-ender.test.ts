/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IPseudoTerminalHandle, type IPseudoTerminalLibrary, ProcessSettings, ProcessStartException, type ProcessSupervisor, type PseudoTerminal, PseudoTerminalRequest } from "@noldova/desktop.runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProcessTableFixture } from "../../fixtures/process-table.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { PseudoTerminalHandleFixture } from "../../fixtures/pseudo-terminal-handle.fixture.js";
import { PseudoTerminalLibraryFixture } from "../../fixtures/pseudo-terminal-library.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class PosixProcessEnderTests {
  private static readonly HANGUP_FAILURE: string = "Its jobs could not all be hung up after it ended: ";

  private static refused(): Error {
    return Object.assign(new Error("kill EPERM"), { code: "EPERM" });
  }

  private static startShellAsync(processes: ProcessSupervisor, shell: PseudoTerminalHandleFixture, folder: string): Promise<PseudoTerminal> {
    const library: IPseudoTerminalLibrary = { spawn: (): IPseudoTerminalHandle => shell };
    return processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, new PseudoTerminalRequest(library, process.execPath, [], folder, 80, 24, {}));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsTheRestOfAProgramsGroupWhenItExitsWithAnError(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.PARENT, "3"]));
    const child = Number(await ProgramFixture.readLineAsync(owned));

    const exit = await owned.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(3, exit.code);
    Assert.isTrue(await ProgramFixture.waitForEndAsync(child, 1_000));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async endsAProgramItCannotRecordWithoutReadingTheTableOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const table = new ProcessTableFixture([]);
    settings.database.run("DROP TABLE owned_processes");
    const processes = ProcessSupervisorFixture.createLinux(settings, table);

    const failure = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT])),
      Error);

    Assert.isFalse(failure instanceof ProcessStartException);
    Assert.areEqual(0, table.reads);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(String.empty, settings.diagnostics.text);
  }

  @TestMethod
  public async endsTheGroupAProgramLeftAfterACleanExitWhileAProcessItHeldStillRunsInItOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const table = new ProcessTableFixture([rows, rows]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = owned.processId;
    simulated.add(900_011, leader);
    await owned.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.some(t => t.hasExited));
    const listed = processes.programs.map(t => `${t.moduleId} ${t.program} ${t.processId} ${t.started.getTime()} ${t.hasExited}`);
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(`notes ${owned.program} ${leader} ${owned.started.getTime()} true`, listed.join(","));
    Assert.areEqual(`-${leader} SIGTERM`, simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_011));
    Assert.areEqual(2, table.reads);
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async leavesAGroupWhoseProcessesItCanNoLongerRecogniseAfterACleanExitAndNamesThemOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const processes = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([rows, rows]));

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = owned.processId;
    simulated.add(900_012, leader);
    await owned.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.some(t => t.hasExited));
    simulated.remove(900_012);
    simulated.add(900_013, leader);
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(String.empty, simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_013));
    Assert.areEqual(
      ProcessSupervisorFixture.line(owned, "It was no longer running, and nothing showed that processes 900013 were what it started, so they were left running."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async keepsTheRecordOfAGroupItCouldNotSignalAndEndsTheOthersOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const processes = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([rows, rows]));
    const clean = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = clean.processId;
    simulated.add(900_021, leader);
    await clean.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.some(t => t.hasExited));
    const running = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);
    simulated.fail(-running.processId, "SIGTERM", "denied");

    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    running.input.end();
    await running.exited;

    Assert.areEqual(`-${running.processId} SIGTERM,-${clean.processId} SIGTERM`, simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_021));
    Assert.areEqual(ProcessSupervisorFixture.line(running, "'denied'"), settings.diagnostics.text);
    Assert.areEqual(String(running.processId), settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => t["process_id"]).join(","));
  }

  @TestMethod
  public async signalsAGroupThatRefusedAgainOnceItsProgramEndsAndSaysNothingOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const processes = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([]), new ProcessSettings());
    const running = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);
    simulated.refuseWhileRunning(-running.processId, "SIGTERM", PosixProcessEnderTests.refused());

    const stopping = processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await ProcessSupervisorFixture.waitForAsync(() => simulated.signals.length > 0);
    running.input.end();
    await stopping;

    Assert.areEqual(`-${running.processId} SIGTERM,-${running.processId} SIGTERM`, simulated.signals.join(","));
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async reportsAGroupThatStillRefusesWhileTheTableShowsItsProgramRunningOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const processes = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([() => Promise.resolve(`${leader} 1 ${leader} 00:00`)]));
    const running = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    leader = running.processId;
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);
    simulated.refuseWhileRunning(-running.processId, "SIGTERM", PosixProcessEnderTests.refused());

    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    const isRunning = !running.hasExited;
    running.input.end();
    await running.exited;

    Assert.isTrue(isRunning);
    Assert.areEqual(`-${running.processId} SIGTERM,-${running.processId} SIGTERM`, simulated.signals.join(","));
    Assert.isTrue(settings.diagnostics.text.startsWith(ProcessSupervisorFixture.line(running, "Error: kill EPERM").slice(0, -1)), settings.diagnostics.text);
    Assert.areEqual(String(running.processId), settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => t["process_id"]).join(","));
  }

  @TestMethod
  public async endsAGroupThatStillRefusesWhileTheTableShowsOnlyAZombieInItOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const table = new ProcessTableFixture([() => Promise.resolve(`900031 1 ${leader} 00:00 Z`)]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table, new ProcessSettings());
    const running = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    leader = running.processId;
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);
    simulated.fail(-running.processId, "SIGTERM", PosixProcessEnderTests.refused());

    const stopping = processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await ProcessSupervisorFixture.waitForAsync(() => simulated.signals.length > 0);
    running.input.end();
    await stopping;

    Assert.areEqual(`-${running.processId} SIGTERM,-${running.processId} SIGTERM`, simulated.signals.join(","));
    Assert.areEqual(1, table.reads);
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async signalsTheGroupOfAProgramThatFailedAgainAtOnceWhenItRefusesAndEndsItWhenOnlyAZombieIsLeftOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const table = new ProcessTableFixture([() => Promise.resolve(`900021 1 ${leader} 00:00 Z`)]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table, new ProcessSettings());

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "3"]));
    leader = owned.processId;
    simulated.add(900_021, leader);
    simulated.fail(-leader, "SIGTERM", PosixProcessEnderTests.refused());
    const exit = await owned.exited;
    await ProcessSupervisorFixture.waitForAsync(() => settings.database.readAll(ProcessSupervisorFixture.RECORDS).length === 0 || settings.diagnostics.text.length > 0);
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(3, exit.code);
    Assert.areEqual(`-${leader} SIGTERM,-${leader} SIGTERM`, simulated.signals.join(","));
    Assert.areEqual(1, table.reads);
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async reportsAGroupThatStillRefusesWhenTheTableCannotBeReadOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const processes = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([new Error("The table could not be read.")]), new ProcessSettings());
    const running = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);
    simulated.fail(-running.processId, "SIGTERM", PosixProcessEnderTests.refused());

    const stopping = processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await ProcessSupervisorFixture.waitForAsync(() => simulated.signals.length > 0);
    running.input.end();
    await stopping;

    Assert.isTrue(settings.diagnostics.text.startsWith(ProcessSupervisorFixture.line(running, "Error: kill EPERM").slice(0, -1)), settings.diagnostics.text);
    Assert.areEqual(String(running.processId), settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => t["process_id"]).join(","));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async killsAProgramThatIgnoresTheSignalAfterOneGracePeriodWhileAnotherGroupRefusesAndReadsTheTableOnce(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${t} 00:00`));
    const table = new ProcessTableFixture([rows, rows]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table, new ProcessSettings(1_000, 500));
    const refusing = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    const stubborn = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN]));
    for (const owned of [refusing, stubborn]) {
      simulated.own(owned.processId);
      await ProgramFixture.readLineAsync(owned);
    }
    simulated.add(stubborn.processId, stubborn.processId, true);
    simulated.refuseWhileRunning(-refusing.processId, "SIGTERM", PosixProcessEnderTests.refused());

    const stopping = processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await ProcessSupervisorFixture.waitForAsync(() => simulated.signals.includes(`-${stubborn.processId} SIGKILL`), () => simulated.signals.join(","), 10_000);
    const elapsed = simulated.timeOf(`-${stubborn.processId} SIGKILL`) - simulated.timeOf(`-${stubborn.processId} SIGTERM`);
    refusing.input.end();
    await stopping;
    await Promise.all([refusing.exited, stubborn.exited]);

    const term = `-${stubborn.processId} SIGTERM`;
    const kill = `-${stubborn.processId} SIGKILL`;
    Assert.areEqual(`${term},${kill}`, simulated.signals.filter(t => t === term || t === kill).join(","));
    Assert.isTrue(elapsed >= 990, `A timing test: the kill came ${Math.round(elapsed)} ms after the first signal, before the 1 s grace, with 10 ms for a timer's rounding; a busy machine only makes the wait longer, so it cannot fail this bound.`);
    Assert.areEqual(1, table.reads);
  }

  @TestMethod
  public async reportsAKeptProgramsGroupThatRefusesWithoutSignallingItAgainOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const rows = (): Promise<string> => Promise.resolve(simulated.list(t => `${t} 1 ${leader} 00:00`));
    const processes = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([rows, rows]));
    const kept = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = kept.processId;
    simulated.add(900_022, leader);
    await kept.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.some(t => t.hasExited));
    simulated.fail(-kept.processId, "SIGTERM", PosixProcessEnderTests.refused());

    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(`-${kept.processId} SIGTERM`, simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_022));
    Assert.isTrue(settings.diagnostics.text.startsWith(ProcessSupervisorFixture.line(kept, "Error: kill EPERM").slice(0, -1)), settings.diagnostics.text);
    Assert.areEqual(String(kept.processId), settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => t["process_id"]).join(","));
  }

  @TestMethod
  public async killsTheOtherGroupsWhenOneCannotBeKilledOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    for (const processId of [900_091, 900_095]) {
      settings.database.run(ProcessSupervisorFixture.INSERT, "notes", processId, "tool", "/usr/bin/tool", "boot", now, now, now, 0);
      simulated.add(processId, processId);
    }
    simulated.fail(-900_091, "SIGKILL", "denied");
    const table = new ProcessTableFixture([() => Promise.resolve(simulated.list(t => `${t} 1 ${t} 00:00`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);

    await processes.cleanUpAsync();

    Assert.areEqual("-900091 SIGKILL,-900095 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_091));
    Assert.isFalse(simulated.isAlive(900_095));
    Assert.areEqual(
      "The module notes's program tool (process 900095): An earlier runtime left processes 900095 running, so they were ended.\n" +
      "The module notes's program tool (process 900091): 'denied'\n",
      settings.diagnostics.text);
    Assert.areEqual("900091", settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => t["process_id"]).join(","));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsAPseudoTerminalsProgramThatDoesNotLeadAGroupYetThroughItsOwnProcessId(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const library = new PseudoTerminalLibraryFixture();
    library.detaches = false;
    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE,
      new PseudoTerminalRequest(library, process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], folder.path, 80, 24, {}));

    try {
      Assert.isTrue(await terminal.stopAsync());
      Assert.isFalse(ProgramFixture.isRunning(terminal.processId));
      await terminal.exited;
      Assert.areEqual(0, processes.programs.length);
      Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    }
    finally {
      ProgramFixture.endIfRunning(terminal.processId);
    }
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async killsAPseudoTerminalsProgramThatDoesNotLeadAGroupYetAndIgnoresTheHangupAndSaysSo(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.createWith(settings, new ProcessSettings(300));
    const library = new PseudoTerminalLibraryFixture();
    library.detaches = false;
    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE,
      new PseudoTerminalRequest(library, process.execPath, [ProgramFixture.file, ProgramFixture.DEAF], folder.path, 80, 24, {}));
    const ready = Promise.withResolvers<void>();
    terminal.onOutput(t => {
      if (t.includes(ProgramFixture.READY))
        ready.resolve();
    });

    try {
      await ready.promise;
      Assert.isFalse(await terminal.stopAsync());
      Assert.isFalse(ProgramFixture.isRunning(terminal.processId));
      await terminal.exited;
      Assert.isTrue(settings.diagnostics.text.includes(`processes ${terminal.processId} were ended forcefully`));
      Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    }
    finally {
      ProgramFixture.endIfRunning(terminal.processId);
    }
  }

  @TestMethod
  public async neverSignalsTheOwnIdOfAStoppedProgramWithoutAGroupWhenTheTableShowsAnotherStartOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_501, 900_500);
    const rows = "900501 1 900500 10:00";
    const table = new ProcessTableFixture([rows, rows]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const shell = new PseudoTerminalHandleFixture(900_501);
    const terminal = await PosixProcessEnderTests.startShellAsync(processes, shell, folder.path);

    Assert.isTrue(await terminal.stopAsync());
    shell.exit({ exitCode: undefined, signal: 1 });
    await terminal.exited;

    Assert.areEqual("-900501 SIGHUP", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_501));
    Assert.areEqual(2, table.reads);
    Assert.areEqual(String.empty, settings.diagnostics.text);
  }

  @TestMethod
  public async hangsUpOnceMoreOnlyAStoppedShellWhoseGroupStillRunsSoAnEndedOnesIdIsNeverSignalledBeforeItsExitComesOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_701, 900_701);
    simulated.add(900_711, 900_711, true);
    const table = new ProcessTableFixture(["900701 1 900701 00:00\n900711 1 900711 00:00", () => {
      simulated.add(900_711, 900_711);
      return Promise.resolve("900711 1 900711 00:00");
    }]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const early = new PseudoTerminalHandleFixture(900_701);
    const deaf = new PseudoTerminalHandleFixture(900_711);
    const earlyTerminal = await PosixProcessEnderTests.startShellAsync(processes, early, folder.path);
    const deafTerminal = await PosixProcessEnderTests.startShellAsync(processes, deaf, folder.path);

    const stopping = processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await ProcessSupervisorFixture.waitForAsync(() => simulated.signals.includes("900711 SIGHUP"), () => simulated.signals.join(","), 5_000);
    early.exit({ exitCode: undefined, signal: 1 });
    await stopping;
    deaf.exit({ exitCode: undefined, signal: 9 });
    await Promise.all([earlyTerminal.exited, deafTerminal.exited]);

    Assert.areEqual("-900701 SIGHUP,-900711 SIGHUP,900711 SIGHUP,-900711 SIGKILL", simulated.signals.join(","));
  }

  @TestMethod
  public async killsNotAStoppedShellOutsideAGroupWhoseExitCameWhileAnotherHeldTheStopSoItsReusedIdIsNeverKilledOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_761, 900_760, true);
    simulated.add(900_771, 900_771, true);
    const rows = "900761 1 900760 00:00\n900771 1 900771 00:00";
    const table = new ProcessTableFixture([rows, rows, () => {
      simulated.add(900_771, 900_771);
      return Promise.resolve(rows);
    }]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const gone = new PseudoTerminalHandleFixture(900_761);
    const deaf = new PseudoTerminalHandleFixture(900_771);
    const goneTerminal = await PosixProcessEnderTests.startShellAsync(processes, gone, folder.path);
    const deafTerminal = await PosixProcessEnderTests.startShellAsync(processes, deaf, folder.path);

    const stopping = processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await ProcessSupervisorFixture.waitForAsync(() => simulated.signals.includes("-900771 SIGHUP"), () => simulated.signals.join(","), 5_000);
    gone.exit({ exitCode: undefined, signal: 1 });
    await stopping;
    deaf.exit({ exitCode: undefined, signal: 9 });
    await Promise.all([goneTerminal.exited, deafTerminal.exited]);

    Assert.areEqual("900761 SIGHUP,-900771 SIGHUP,900771 SIGHUP,-900771 SIGKILL", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_761));
    Assert.areEqual(3, table.reads);
  }

  @TestMethod
  public async hangsUpNoMoreAStoppedShellOutsideAGroupWhoseExitCameSoItsReusedIdIsNeverSignalledOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_751, 900_750, true);
    const row = "900751 1 900750 00:00";
    const table = new ProcessTableFixture([row, row, () => {
      simulated.add(900_751, 900_750);
      return Promise.resolve(row);
    }]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const shell = new PseudoTerminalHandleFixture(900_751);
    const terminal = await PosixProcessEnderTests.startShellAsync(processes, shell, folder.path);

    const stopping = terminal.stopAsync();
    await ProcessSupervisorFixture.waitForAsync(() => simulated.signals.includes("900751 SIGHUP"), () => simulated.signals.join(","), 5_000);
    shell.exit({ exitCode: undefined, signal: 1 });
    await stopping;
    await terminal.exited;

    Assert.areEqual("900751 SIGHUP", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_751));
    Assert.areEqual(2, table.reads);
  }

  @TestMethod
  public async signalsNotAgainAStoppedShellOutsideAGroupThatRefusedOnceItsExitComesSoItsReusedIdIsNeverSignalledOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_781, 900_780);
    simulated.fail(900_781, "SIGHUP", PosixProcessEnderTests.refused());
    const row = "900781 1 900780 00:00";
    const table = new ProcessTableFixture([row, row, row]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const shell = new PseudoTerminalHandleFixture(900_781);
    const terminal = await PosixProcessEnderTests.startShellAsync(processes, shell, folder.path);

    const stopping = terminal.stopAsync();
    await ProcessSupervisorFixture.waitForAsync(() => simulated.signals.includes("900781 SIGHUP"), () => simulated.signals.join(","), 5_000);
    shell.exit({ exitCode: undefined, signal: 1 });
    await stopping;
    await terminal.exited;

    Assert.areEqual("900781 SIGHUP", simulated.signals.join(","));
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(2, table.reads);
  }

  @TestMethod
  public async hangsUpOnceMoreTheStoppedShellsOwnProcessAndNotTheRestOfItsGroupOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_721, 900_721, true);
    simulated.add(900_722, 900_721, true);
    const rows = "900721 1 900721 00:00\n900722 900721 900721 00:00";
    const table = new ProcessTableFixture([rows, () => {
      simulated.add(900_721, 900_721);
      simulated.add(900_722, 900_721);
      return Promise.resolve(rows);
    }]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const shell = new PseudoTerminalHandleFixture(900_721);
    const terminal = await PosixProcessEnderTests.startShellAsync(processes, shell, folder.path);

    Assert.isFalse(await terminal.stopAsync());
    shell.exit({ exitCode: undefined, signal: 9 });
    await terminal.exited;

    Assert.areEqual("-900721 SIGHUP,900721 SIGHUP,-900721 SIGKILL", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_722));
  }

  @TestMethod
  public async hangsUpNoGroupOnTheTerminalOfAStoppedShellThatDoesNotLeadAGroupYetOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_601, 900_600);
    simulated.add(900_602, 900_602);
    const rows = "900601 1 900600 00:00 34816\n900602 1 900602 10:00 34816";
    const table = new ProcessTableFixture([rows, rows, rows]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const shell = new PseudoTerminalHandleFixture(900_601);
    const terminal = await PosixProcessEnderTests.startShellAsync(processes, shell, folder.path);

    Assert.isTrue(await terminal.stopAsync());
    shell.exit({ exitCode: undefined, signal: 1 });
    await terminal.exited;

    Assert.areEqual("900601 SIGHUP", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_601));
    Assert.isTrue(simulated.isAlive(900_602));
    Assert.areEqual(2, table.reads);
    Assert.areEqual(String.empty, settings.diagnostics.text);
  }

  @TestMethod
  public async killsThroughItsGroupAStoppedProgramThatMadeItsGroupAfterTheHangupOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_611, 900_610, true);
    const before = "900611 1 900610 00:00";
    const table = new ProcessTableFixture([before, before, () => {
      simulated.add(900_611, 900_611);
      return Promise.resolve("900611 1 900611 00:00");
    }]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const shell = new PseudoTerminalHandleFixture(900_611);
    const terminal = await PosixProcessEnderTests.startShellAsync(processes, shell, folder.path);

    Assert.isFalse(await terminal.stopAsync());
    shell.exit({ exitCode: undefined, signal: 9 });
    await terminal.exited;

    Assert.areEqual("900611 SIGHUP,900611 SIGHUP,-900611 SIGKILL", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_611));
    Assert.areEqual(3, table.reads);
    Assert.isTrue(settings.diagnostics.text.includes("processes 900611 were ended forcefully"));
  }

  @TestMethod
  public async killsALeftoverWhoseProgramStillRunsOutsideAGroupOfItsOwnOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_621, "tool", "/usr/bin/tool", "boot", now, now, now, 0);
    simulated.add(900_621, 900_620);
    const table = new ProcessTableFixture(["900621 1 900620 00:00"]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);

    await processes.cleanUpAsync();

    Assert.areEqual("900621 SIGKILL", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_621));
    Assert.areEqual(
      "The module notes's program tool (process 900621): An earlier runtime left processes 900621 running, so they were ended.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async forgetsAGroupThatEndedWithItsLeaderAndStopsARunningOneWithoutTheTableOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const table = new ProcessTableFixture([]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table, ProcessSupervisorFixture.CLEAN_EXIT_LIMITS);
    const ended = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "2"]));
    await ended.exited;
    const running = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    simulated.own(running.processId);
    await ProgramFixture.readLineAsync(running);

    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await running.exited;

    Assert.areEqual(`-${running.processId} SIGTERM`, simulated.signals.join(","));
    Assert.areEqual(0, table.reads);
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async leavesAloneAGroupWhoseLeadersIdWasReusedOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_041, "tool", "/usr/bin/tool", "boot", now, now, now, 0);
    simulated.add(900_041, 900_041);
    simulated.add(900_042, 900_041);
    const table = new ProcessTableFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900041 1-00:00:00`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);

    await processes.cleanUpAsync();

    Assert.areEqual(1, table.reads);
    Assert.areEqual(String.empty, simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_041) && simulated.isAlive(900_042));
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async leavesTheGroupOfAGoneProgramThatHoldsNoProcessStartedBeforeItWasLastSeenAndNamesItsProcessesOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    const table = new ProcessTableFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900051 00:00`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_058, "tool", "/usr/bin/tool", "boot", now, now, now, 0);

    await processes.cleanUpAsync();
    const readForEndedGroup = table.reads;
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_051, "tool", "/usr/bin/tool", "boot", now - 2_000, now - 2_000, now - 1_000, 0);
    simulated.add(900_052, 900_051);
    await processes.cleanUpAsync();

    Assert.areEqual(0, readForEndedGroup);
    Assert.areEqual(1, table.reads);
    Assert.areEqual(String.empty, simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_052));
    Assert.areEqual(
      "The module notes's program tool (process 900051): It was no longer running, and nothing showed that processes 900052 were what it started, so they were left running.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async killsTheGroupOfAGoneProgramThatHoldsAProcessStartedBeforeItWasLastSeenOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_081, "tool", "/usr/bin/tool", "boot", now - 10_000, now - 10_000, now - 1_000, 0);
    simulated.add(900_082, 900_081);
    simulated.add(900_083, 900_081);
    const table = new ProcessTableFixture([() => Promise.resolve(simulated.list(t => `${t} 900081 900081 ${t === 900_082 ? "00:05" : "00:00"}`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);

    await processes.cleanUpAsync();

    Assert.areEqual("-900081 SIGKILL", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_082) || simulated.isAlive(900_083));
    Assert.areEqual(
      "The module notes's program tool (process 900081): An earlier runtime left processes 900082, 900083 running, so they were ended.\n",
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async killsTheWholeGroupOfALeftoverWhoseProgramStillRunsOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_061, "tool", "/usr/bin/tool", "boot", now, now, now, 0);
    simulated.add(900_061, 900_061);
    simulated.add(900_062, 900_061);
    const table = new ProcessTableFixture([() => Promise.resolve(simulated.list(t => `${t} 1 900061 00:00`))]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);

    await processes.cleanUpAsync();

    Assert.areEqual("-900061 SIGKILL", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_061) || simulated.isAlive(900_062));
    Assert.areEqual("The module notes's program tool (process 900061): An earlier runtime left processes 900061, 900062 running, so they were ended.\n", settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async removesTheRecordsOfAnotherBootWithoutReadingTheTableOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const now = ProcessSupervisorFixture.LINUX.now();
    settings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_071, "tool", "/usr/bin/tool", "earlier boot", now, now, now, 0);
    simulated.add(900_071, 900_071);
    const table = new ProcessTableFixture([]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);

    await processes.cleanUpAsync();

    Assert.areEqual(0, table.reads);
    Assert.areEqual(String.empty, simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_071));
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async hangsUpTheJobsAStoppedShellLeftRunningInGroupsOfTheirOwnEvenWithoutTheirLeaderButNotAGroupWhoseIdWasReusedOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    for (const [processId, groupId] of [[900_301, 900_301], [900_302, 900_302], [900_303, 900_302], [900_304, 900_304], [900_306, 900_307]] as const)
      simulated.add(processId, groupId);
    const table = new ProcessTableFixture([
      "900301 1 900301 00:00\n900302 900301 900302 10:00\n900303 900302 900302 10:00\n900304 900301 900304 10:00\n900305 900301 900301 10:00\n900306 900301 900307 10:00",
      "900302 1 900302 10:00\n900303 900302 900302 10:00\n900304 1 900304 00:00\n900306 1 900307 10:00"
    ]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const shell = new PseudoTerminalHandleFixture(900_301);
    const terminal = await PosixProcessEnderTests.startShellAsync(processes, shell, folder.path);

    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    shell.exit({ exitCode: undefined, signal: 1 });
    await terminal.exited;

    Assert.areEqual("-900301 SIGHUP,-900302 SIGHUP,-900307 SIGHUP", simulated.signals.join(","));
    Assert.isFalse(simulated.isAlive(900_303));
    Assert.isFalse(simulated.isAlive(900_306));
    Assert.isTrue(simulated.isAlive(900_304));
    Assert.areEqual(2, table.reads);
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async hangsUpEveryGroupOnAStoppedShellsTerminalEvenWhenItsParentLeftButNoGroupOnAnotherTerminalOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    for (const [processId, groupId] of [[900_401, 900_401], [900_403, 900_403], [900_404, 900_404], [900_405, 900_405], [900_406, 900_406]] as const)
      simulated.add(processId, groupId);
    const rows = "900401 1 900401 00:00 34816\n900403 1 900403 10:00 34816\n900404 900403 900404 10:00 34816\n900405 1 900405 10:00 34817\n900406 1 900406 10:00";
    const table = new ProcessTableFixture([rows, rows.split("\n").slice(1).join("\n")]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const shell = new PseudoTerminalHandleFixture(900_401);
    const terminal = await PosixProcessEnderTests.startShellAsync(processes, shell, folder.path);

    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    shell.exit({ exitCode: undefined, signal: 1 });
    await terminal.exited;

    Assert.areEqual("-900401 SIGHUP,-900403 SIGHUP,-900404 SIGHUP", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_405));
    Assert.isTrue(simulated.isAlive(900_406));
    Assert.areEqual(String.empty, settings.diagnostics.text);
  }

  @TestMethod
  public async hangsUpNoGroupByTerminalForAShellWithoutOneOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_411, 900_411);
    simulated.add(900_412, 900_412);
    const table = new ProcessTableFixture(["900411 1 900411 00:00\n900412 1 900412 10:00"]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);
    const shell = new PseudoTerminalHandleFixture(900_411);
    const terminal = await PosixProcessEnderTests.startShellAsync(processes, shell, folder.path);

    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    shell.exit({ exitCode: undefined, signal: 1 });
    await terminal.exited;

    Assert.areEqual("-900411 SIGHUP", simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_412));
    Assert.areEqual(1, table.reads);
  }

  @TestMethod
  public async logsJobsItCouldNotListCheckOrHangUpAndStillEndsTheShellsAndTheOtherJobsOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    for (const [processId, groupId] of [[900_311, 900_311], [900_321, 900_321], [900_322, 900_322], [900_331, 900_331], [900_332, 900_332], [900_333, 900_333], [900_341, 900_341]] as const)
      simulated.add(processId, groupId);
    simulated.fail(-900_332, "SIGHUP", "denied");
    simulated.fail(-900_341, "SIGHUP", "refused");
    const unlisted = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([new Error("The table could not be listed.")]));
    const unchecked = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([
      "900321 1 900321 00:00\n900322 900321 900322 10:00",
      new Error("The table could not be checked.")
    ]));
    const denied = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([
      "900331 1 900331 00:00\n900332 900331 900332 10:00\n900333 900331 900333 10:00\n900341 1 900341 00:00",
      "900332 1 900332 10:00\n900333 1 900333 10:00"
    ]));
    const unlistedShell = new PseudoTerminalHandleFixture(900_311);
    const uncheckedShell = new PseudoTerminalHandleFixture(900_321);
    const deniedShell = new PseudoTerminalHandleFixture(900_331);
    const refusedShell = new PseudoTerminalHandleFixture(900_341);
    const shells = [unlistedShell, uncheckedShell, deniedShell, refusedShell];
    const unlistedTerminal = await PosixProcessEnderTests.startShellAsync(unlisted, unlistedShell, folder.path);
    const uncheckedTerminal = await PosixProcessEnderTests.startShellAsync(unchecked, uncheckedShell, folder.path);
    const deniedTerminal = await PosixProcessEnderTests.startShellAsync(denied, deniedShell, folder.path);
    const refusedTerminal = await PosixProcessEnderTests.startShellAsync(denied, refusedShell, folder.path);

    for (const processes of [unlisted, unchecked, denied])
      await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    for (const shell of shells)
      shell.exit({ exitCode: undefined, signal: 1 });
    await Promise.all([unlistedTerminal, uncheckedTerminal, deniedTerminal, refusedTerminal].map(t => t.exited));
    const lines = settings.diagnostics.text.split("\n").filter(t => !t.startsWith(" ")).map(t => `${t}\n`);

    Assert.areEqual("-900311 SIGHUP,-900321 SIGHUP,-900331 SIGHUP,-900341 SIGHUP,-900332 SIGHUP,-900333 SIGHUP", simulated.signals.join(","));
    Assert.isTrue(lines.includes(ProcessSupervisorFixture.line(unlistedTerminal, `${PosixProcessEnderTests.HANGUP_FAILURE}Error: The table could not be listed.`)), settings.diagnostics.text);
    Assert.isTrue(lines.includes(ProcessSupervisorFixture.line(uncheckedTerminal, `${PosixProcessEnderTests.HANGUP_FAILURE}Error: The table could not be checked.`)), settings.diagnostics.text);
    Assert.isTrue(lines.includes(ProcessSupervisorFixture.line(deniedTerminal, `${PosixProcessEnderTests.HANGUP_FAILURE}'denied'`)), settings.diagnostics.text);
    Assert.isTrue(lines.includes(ProcessSupervisorFixture.line(refusedTerminal, "'refused'")), settings.diagnostics.text);
    Assert.isTrue(simulated.isAlive(900_322));
    Assert.isFalse(simulated.isAlive(900_333));
    Assert.areEqual("900341", settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => t["process_id"]).join(","));
  }
}
