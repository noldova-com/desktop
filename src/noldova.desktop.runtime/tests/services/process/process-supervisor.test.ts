/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { readFileSync, readlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { mock } from "node:test";
import { promisify } from "node:util";
import * as pty from "node-pty";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, Category, TestClass, TestMethod } from "@noldova/context.testing";
import {
  DataDirectory, type IPseudoTerminalHandle, type IPseudoTerminalLibrary, ModuleStoppingException, OwnershipLock, ProcessRequest, ProcessSettings, ProcessStartException,
  ProcessStartFailedException, ProcessSupervisor, type PseudoTerminal, PseudoTerminalBatchRefusedException, PseudoTerminalCommandLineBatchRefusedException,
  PseudoTerminalCommandLineRefusedException, PseudoTerminalCommandLineWithArgumentsException, PseudoTerminalRequest, ShellDatabase, ShellMigrations, UpdatePreparingException
} from "@noldova/desktop.runtime";

import { ErrorCodeFixture } from "../../fixtures/error-code.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProcessKillFixture } from "../../fixtures/process-kill.fixture.js";
import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProcessTableFixture } from "../../fixtures/process-table.fixture.js";
import { ProgramEndFixture } from "../../fixtures/program-end.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { PseudoTerminalHandleFixture } from "../../fixtures/pseudo-terminal-handle.fixture.js";
import { PseudoTerminalLibraryFixture } from "../../fixtures/pseudo-terminal-library.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

@TestClass
export class ProcessSupervisorTests {
  @TestMethod
  public async reportsAProgramThatCannotStartAndRecordsNothing(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);

    const missingFolder = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(path.join(folder.path, "missing"), [ProgramFixture.WAIT])),
      ProcessStartFailedException);
    const invalidArgument = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, ["nul\0"])),
      ProcessStartFailedException);

    Assert.areEqual(`${process.execPath} could not be started.`, missingFolder.message);
    Assert.areEqual("ENOENT", ErrorCodeFixture.of(missingFolder.cause));
    Assert.areEqual(`${process.execPath} could not be started.`, invalidArgument.message);
    Assert.areEqual("ERR_INVALID_ARG_VALUE", ErrorCodeFixture.of(invalidArgument.cause));
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async refusesANulInAnArgumentOrAnEnvironmentValueBeforeAnythingStarts(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const inArgument = new ProcessRequest(process.execPath, [ProgramFixture.file, ProgramFixture.WAIT, "a\0b"], folder.path);
    const inValue = new ProcessRequest(process.execPath, [ProgramFixture.file, ProgramFixture.WAIT], folder.path, { NOLDOVA_DESKTOP_FIXTURE_VALUE: "a\0b" });

    const argument = await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, inArgument), ProcessStartFailedException);
    const value = await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, inValue), ProcessStartFailedException);

    Assert.areEqual(`${process.execPath} could not be started.`, argument.message);
    Assert.areEqual("ERR_INVALID_ARG_VALUE", ErrorCodeFixture.of(argument.cause));
    Assert.areEqual(`${process.execPath} could not be started.`, value.message);
    Assert.areEqual("ERR_INVALID_ARG_VALUE", ErrorCodeFixture.of(value.cause));
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async reportsEachStartAndStopOnceWithAGrowingSequenceUntilItsListenerIsDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const changes: string[] = [];
    const watching = processes.onChanged(() => changes.push(`${processes.status.sequence}:${processes.status.programs.map(t => `${t.moduleId} ${t.hasExited}`).join(",")}`));

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(owned);
    const listed = processes.status;
    await owned.stopAsync();
    watching[Symbol.dispose]();
    const later = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await later.exited;

    Assert.areEqual("1:notes false|2:", changes.join("|"));
    Assert.areEqual(`1 ${owned.processId} ${process.execPath}`, [listed.sequence, ...listed.programs.map(t => `${t.processId} ${t.program}`)].join(" "));
    Assert.areEqual(4, processes.status.sequence);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async reportsACleanExitThatLeavesItsGroupAndTheGroupsEndAsSeparateChanges(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const changes: string[] = [];
    processes.onChanged(() => changes.push(`${processes.status.sequence}:${processes.status.programs.map(t => `${t.processId} ${t.hasExited}`).join(",")}`));

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.PARENT, "0"]));
    await ProgramFixture.readLineAsync(owned);
    await owned.exited;
    await ProcessSupervisorFixture.changedAsync(processes, () => changes.length === 2);
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(`1:${owned.processId} false|2:${owned.processId} true|3:`, changes.join("|"));
  }

  @TestMethod
  public async startsNoProgramWhilePausedAndListsItsProgramsForAnUpdate(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));

    processes.pause();
    const refused = await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT])), UpdatePreparingException);
    const listed = processes.updateProcesses;
    processes.resume();
    const resumed = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(`${process.execPath} was not started for the module notes, because the runtime is preparing for an update.`, refused.message);
    Assert.areEqual(`${owned.processId} program`, listed.map(t => `${t.processId} ${t.role}`).join(","));
    Assert.isTrue(listed.every(t => t.earliest <= t.latest));
    Assert.areNotEqual(owned.processId, resumed.processId);
  }

  @TestMethod
  public async endsAProgramItCannotRecord(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    database.close();
    const processes = ProcessSupervisor.create(database, process.platform, process.env, new TextOutputFixture());

    const failure = await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT])), Error);

    Assert.isFalse(failure instanceof ProcessStartException);
    Assert.areEqual(0, processes.programs.length);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async endsAnAppAProgramLaunchedWithTheProgramsJobOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.LAUNCH]));
    let output = String.empty;
    owned.output.setEncoding("utf8");
    owned.output.on("data", (t: string) => {
      output += t;
    });
    try {
      await ProcessSupervisorFixture.waitForAsync(() => ProgramFixture.LAUNCHED_PATTERN.test(output), () => `The program printed: ${JSON.stringify(output)}`, ProgramFixture.LAUNCH_MILLISECONDS);
      const [child, app] = ProgramFixture.readLaunched(output);
      Assert.isTrue(ProgramFixture.isRunning(child), "The console program ended before the program stopped.");
      const exit = await owned.stopAsync();
      const [isAppEnded, isChildEnded] = await Promise.all([
        ProgramFixture.waitForEndAsync(app, ProgramFixture.END_MILLISECONDS),
        ProgramFixture.waitForEndAsync(child, ProgramFixture.END_MILLISECONDS)
      ]);

      Assert.isTrue(exit.isClean);
      Assert.isTrue(isAppEnded, "The app the program launched outlived the program's job.");
      Assert.isTrue(isChildEnded, "The program's console program whose parent exited outlived the program's job.");
    }
    finally {
      await owned.stopAsync();
      await ProgramFixture.endLaunchedAsync(output);
    }
  }

  @TestMethod
  public async refusesARequestWhoseSignalHasAlreadyAborted(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);

    const failure = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], AbortSignal.abort())),
      Error);

    Assert.areEqual("AbortError", failure.name);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async stopsAProgramWhenItsSignalAbortsWhileItRunsOrStarts(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const running = new AbortController();
    const starting = new AbortController();

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], running.signal));
    const ready = await ProgramFixture.readLineAsync(owned);
    running.abort();
    await owned.exited;
    const pending = processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT], starting.signal));
    starting.abort();
    const aborted = await pending;
    await aborted.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(ProgramFixture.READY, ready);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async endsWhatAnEarlierRuntimeLeftRunningWhenItCleansUp(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const earlier = ProcessSupervisorFixture.create(settings);
    const owned = await earlier.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(owned);
    const later = ProcessSupervisorFixture.create(settings);

    await later.cleanUpAsync();
    await owned.exited;
    await earlier.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    await later.cleanUpAsync();

    Assert.isTrue(
      ProcessSupervisorFixture.endsTheTree(settings.diagnostics.text, owned, "An earlier runtime left processes", "running, so they were ended."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async refusesAModulesStartsOnceItsProgramsBeginToEndAndEveryStartOnceAllDo(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const notes = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    const tasks = await processes.startAsync("tasks", ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    await ProgramFixture.readLineAsync(notes);
    await ProgramFixture.readLineAsync(tasks);

    const stopping = processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);
    const refused = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.WAIT])),
      ModuleStoppingException);
    await stopping;
    const tasksRunning = processes.programs.map(t => t.moduleId);
    const stoppingAll = processes.stopAllAsync();
    const refusedAll = await Assert.throwsAsync(() => processes.startAsync("tasks", ProgramFixture.request(folder.path, [ProgramFixture.WAIT])), ModuleStoppingException);
    await stoppingAll;
    await Promise.all([notes.exited, tasks.exited]);

    Assert.areEqual(`${process.execPath} was not started, because the module notes is stopping.`, refused.message);
    Assert.areEqual(`${process.execPath} was not started, because the module tasks is stopping.`, refusedAll.message);
    Assert.areEqual("tasks", tasksRunning.join(","));
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}

@TestClass
export class NodePtyTerminalsTests {
  private static readonly ENVIRONMENT: Readonly<Record<string, string>> =
    Object.fromEntries(Object.entries(process.env).filter((t): t is [string, string] => !Object.isUndefined(t[1])));
  private static readonly DEVICE_QUERY: string = "\u001b[c";
  private static readonly DEVICE_ANSWER: string = "\u001b[?1;2c";
  private static readonly SHELL: string = "/bin/bash";
  private static readonly HUNG: string = "hung";
  private static readonly TRAPPING: readonly string[] = ["--norc", "--noprofile", "-c", "trap 'trap - HUP; echo hung' HUP; echo ready; while :; do read -r -t 1 _; done"];
  private static readonly STOPPED_STATE: string = "T";
  private static readonly JOB_PATTERN: RegExp = /job=(\d+)/u;
  private static readonly PROMPT_PATTERN: RegExp = /[$#] /u;
  private static readonly FLOODED: number = 65_536;
  private static readonly COMMAND_PROMPT: string = path.join(ProcessSupervisorFixture.SYSTEM_ROOT, "System32", "cmd.exe");

  private static request(folder: string, launchArguments: readonly string[]): PseudoTerminalRequest {
    return new PseudoTerminalRequest(pty, process.execPath, [ProgramFixture.file, ...launchArguments], folder, 80, 24, NodePtyTerminalsTests.ENVIRONMENT);
  }

  private static requestLine(folder: string, commandLine: string, variables: Readonly<Record<string, string>>): PseudoTerminalRequest {
    return new PseudoTerminalRequest(pty, NodePtyTerminalsTests.COMMAND_PROMPT, [], folder, 80, 24, { ...NodePtyTerminalsTests.ENVIRONMENT, ...variables }, { commandLine });
  }

  private static describe(processId: number): string {
    try {
      const stat = readFileSync(`/proc/${processId}/stat`, "utf8");
      const state = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0];
      return `its process ${processId} runs ${readlinkSync(`/proc/${processId}/exe`)}, in state ${state}, waiting in ${readFileSync(`/proc/${processId}/wchan`, "utf8")}, in the system call ${NodePtyTerminalsTests.systemCallOf(processId)}`;
    }
    catch (error) {
      return `its process ${processId} can't be described: ${String(error)}`;
    }
  }

  private static async readStateAsync(processId: number): Promise<string> {
    const { stdout } = await promisify(execFile)("ps", ["-o", "stat=", "-p", String(processId)], { encoding: "utf8" });
    return stdout.trim();
  }

  private static systemCallOf(processId: number): string {
    try {
      return readFileSync(`/proc/${processId}/syscall`, "utf8").trim();
    }
    catch (error) {
      return `that can't be read: ${String(error)}`;
    }
  }

  private static collect(terminal: PseudoTerminal): () => string {
    let text = String.empty;
    terminal.onOutput(t => {
      text += t;
      if (t.includes(NodePtyTerminalsTests.DEVICE_QUERY) && !terminal.hasExited)
        terminal.write(NodePtyTerminalsTests.DEVICE_ANSWER);
    });
    return () => text;
  }

  @TestMethod
  public async keepsWhatAProgramPrintsAtOnceBeforeItExitsAndItsExitCode(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);

    const printing = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.ARGUMENTS, "printed"]));
    const failing = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.EXIT, "3"]));
    const [printed, failed] = await Promise.all([printing.exited, failing.exited]);
    const output = NodePtyTerminalsTests.collect(printing);
    await ProcessSupervisorFixture.outputAsync(printing, output, () => output().includes(JSON.stringify(["printed"])));
    await ProcessSupervisorFixture.changedAsync(processes, () => processes.programs.length === 0);

    Assert.isTrue(printed.isClean, `The printing program exited with ${printed.code} ${printed.signal}.`);
    Assert.areEqual("3 null", `${failed.code} ${failed.signal}`);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async givesTheExitCodeOfAProgramThatExitsByItselfAndSaysNothingOfIt(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);

    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.EXIT, "7"]));
    const exit = await terminal.exited;
    await ProcessSupervisorFixture.changedAsync(processes, () => processes.programs.length === 0);

    Assert.areEqual("7 null", `${exit.code} ${exit.signal}`);
    Assert.areEqual(String.empty, settings.diagnostics.text);
  }

  @TestMethod
  public async writesResizesPausesAndResumesARunningProgram(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);

    const echo = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.ECHO]));
    const sized = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.SIZE]));
    const echoed = NodePtyTerminalsTests.collect(echo);
    const sizes = NodePtyTerminalsTests.collect(sized);
    await Promise.all([ProcessSupervisorFixture.printedAsync(echo, echoed, ProgramFixture.READY), ProcessSupervisorFixture.printedAsync(sized, sizes, ProgramFixture.READY)]);
    echo.write("hello\r");
    await ProcessSupervisorFixture.printedAsync(echo, echoed, "HELLO");
    echo.pause();
    echo.write("again\r");
    echo.resume();
    await ProcessSupervisorFixture.printedAsync(echo, echoed, "AGAIN");
    sized.resize(100, 30);
    await ProcessSupervisorFixture.printedAsync(sized, sizes, "100x30");
    const ended = await Promise.all([echo.stopAsync(), sized.stopAsync()]);

    Assert.isTrue(sizes().includes("80x24"), sizes());
    Assert.areEqual("true,true", ended.join(","));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async endsARunningProgramItsOwnWayAndWhatAnEarlierRuntimeLeftRunning(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const earlier = ProcessSupervisorFixture.create(settings);
    const stopped = await earlier.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.WAIT]));
    const left = await earlier.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.WAIT]));
    const stoppedOutput = NodePtyTerminalsTests.collect(stopped);
    const leftOutput = NodePtyTerminalsTests.collect(left);
    await Promise.all([ProcessSupervisorFixture.printedAsync(stopped, stoppedOutput, ProgramFixture.READY), ProcessSupervisorFixture.printedAsync(left, leftOutput, ProgramFixture.READY)]);

    const ended = await stopped.stopAsync();
    const exit = await stopped.exited;
    await ProcessSupervisorFixture.changedAsync(earlier, () => earlier.programs.length === 1);
    const later = ProcessSupervisorFixture.create(settings);
    await later.cleanUpAsync();
    await left.exited;
    await earlier.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.isTrue(ended);
    if (process.platform !== "win32")
      Assert.areEqual("SIGHUP", exit.signal);
    Assert.isTrue(
      ProcessSupervisorFixture.endsTheTree(settings.diagnostics.text, left, "An earlier runtime left processes", "running, so they were ended."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async endsAConsoleProgramWhoseParentExitedButNotAnAppItLaunchedWhenATerminalStops(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    await using end = await ProgramEndFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.LAUNCH, String(end.port)]));
    const output = NodePtyTerminalsTests.collect(terminal);
    try {
      await ProcessSupervisorFixture.printedAsync(terminal, output, ProgramFixture.LAUNCHED_PATTERN);
      await end.connectedAsync();
      const [child, app] = ProgramFixture.readLaunched(output());
      Assert.isTrue(ProgramFixture.isRunning(child), "The console program ended before the terminal stopped.");
      const ended = await terminal.stopAsync();
      await end.endedAsync();

      Assert.isTrue(ProgramFixture.isRunning(app), `The app the terminal's program launched ended with the terminal. ${settings.diagnostics.text}`);
      Assert.isTrue(ended);
      Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    }
    finally {
      await terminal.stopAsync();
      await ProgramFixture.endLaunchedAsync(output());
    }
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsAProgramWhoseOutputIsHeldPausedWhenItStops(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const flood = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.FLOOD]));
    const output = NodePtyTerminalsTests.collect(flood);
    await ProcessSupervisorFixture.waitForAsync(() => output().length > NodePtyTerminalsTests.FLOODED, () => `The program printed ${output().length} characters.`, ProgramFixture.LAUNCH_MILLISECONDS);
    flood.pause();

    const ended = await flood.stopAsync();
    await ProcessSupervisorFixture.exitedAsync(flood, () => `The diagnostics said ${JSON.stringify(settings.diagnostics.text)}.`);
    await ProcessSupervisorFixture.changedAsync(processes, () => processes.programs.length === 0);

    Assert.isTrue(ended);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async hangsUpAShellThatLostItsFirstHangupOnceMoreSoItEndsByTheHangupBeforeTheKill(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const grace = 3_000;
    const early = grace / 3;
    const processes = ProcessSupervisorFixture.createWith(settings, new ProcessSettings(grace, 500));
    const shell = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, new PseudoTerminalRequest(
      pty, NodePtyTerminalsTests.SHELL, NodePtyTerminalsTests.TRAPPING, folder.path, 80, 24, NodePtyTerminalsTests.ENVIRONMENT));
    const output = NodePtyTerminalsTests.collect(shell);
    const order: string[] = [];
    void shell.exited.then(t => order.push(`exited by ${t.signal}`));
    await ProcessSupervisorFixture.printedAsync(shell, output, ProgramFixture.READY);

    mock.timers.enable({ apis: ["Date"], now: Date.now() });
    try {
      const stopping = shell.stopAsync();
      await ProcessSupervisorFixture.printedAsync(shell, output, NodePtyTerminalsTests.HUNG);
      order.push("lost the first hangup");
      mock.timers.tick(early);
      await shell.exited;
      mock.timers.tick(grace - early);
      const isClean = await stopping;

      Assert.areEqual("lost the first hangup | exited by SIGHUP", order.join(" | "), output());
      Assert.isTrue(isClean, settings.diagnostics.text);
      Assert.isFalse(settings.diagnostics.text.includes("ended forcefully"), settings.diagnostics.text);
    }
    finally {
      mock.timers.reset();
    }
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async killsAShellWhoseSecondHangupCameBeforeItRanItsTrapOnceTheGraceEnds(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const grace = 3_000;
    const early = grace / 3;
    const processes = ProcessSupervisorFixture.createWith(settings, new ProcessSettings(grace, 500));
    const shell = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, new PseudoTerminalRequest(
      pty, NodePtyTerminalsTests.SHELL, NodePtyTerminalsTests.TRAPPING, folder.path, 80, 24, NodePtyTerminalsTests.ENVIRONMENT));
    const output = NodePtyTerminalsTests.collect(shell);
    const order: string[] = [];
    void shell.exited.then(t => order.push(`exited by ${t.signal}`));
    await ProcessSupervisorFixture.printedAsync(shell, output, ProgramFixture.READY);
    const groupHangup = Promise.withResolvers<void>();
    const shellHangup = Promise.withResolvers<void>();
    using kill: ProcessKillFixture = new ProcessKillFixture((processId: number, signal: string | number): boolean => {
      const isSent = kill.real(processId, signal);
      if (signal === "SIGHUP" && processId === -shell.processId)
        groupHangup.resolve();
      if (signal === "SIGHUP" && processId === shell.processId)
        shellHangup.resolve();
      return isSent;
    });
    process.kill(shell.processId, "SIGSTOP");
    const isStopped = await WaitFixture.untilAsync(async () => (await NodePtyTerminalsTests.readStateAsync(shell.processId)).startsWith(NodePtyTerminalsTests.STOPPED_STATE),
      ProgramFixture.LAUNCH_MILLISECONDS);
    Assert.isTrue(isStopped, NodePtyTerminalsTests.describe(shell.processId));

    mock.timers.enable({ apis: ["Date"], now: Date.now() });
    try {
      const stopping = shell.stopAsync();
      await groupHangup.promise;
      mock.timers.tick(early);
      await shellHangup.promise;
      order.push("both hangups pending");
      process.kill(shell.processId, "SIGCONT");
      await ProcessSupervisorFixture.printedAsync(shell, output, NodePtyTerminalsTests.HUNG);
      order.push("ran its trap once");
      mock.timers.tick(grace - early);
      const isClean = await stopping;
      await shell.exited;

      Assert.areEqual("both hangups pending | ran its trap once | exited by SIGKILL", order.join(" | "), output());
      Assert.areEqual(1, output().split(NodePtyTerminalsTests.HUNG).length - 1, output());
      Assert.isFalse(isClean, settings.diagnostics.text);
      Assert.isTrue(settings.diagnostics.text.includes("did not end within the grace period"), settings.diagnostics.text);
    }
    finally {
      mock.timers.reset();
    }
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async hangsUpAJobOnceItsShellThatKeptTheHangupFromItIsKilled(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const shell = await processes.startPseudoTerminalAsync(
      ProcessSupervisorFixture.MODULE, new PseudoTerminalRequest(pty, NodePtyTerminalsTests.SHELL, ["--norc", "--noprofile", "-i"], folder.path, 80, 24, NodePtyTerminalsTests.ENVIRONMENT));
    const output = NodePtyTerminalsTests.collect(shell);
    const printed = (): string => `The shell printed: ${JSON.stringify(output())}; ${NodePtyTerminalsTests.describe(shell.processId)}`;
    await ProcessSupervisorFixture.waitForAsync(() => NodePtyTerminalsTests.PROMPT_PATTERN.test(output()), printed, ProgramFixture.LAUNCH_MILLISECONDS);
    shell.write("set +H; trap 'echo hung' HUP; sleep 600 & echo job=$!\r");
    await ProcessSupervisorFixture.waitForAsync(() => NodePtyTerminalsTests.JOB_PATTERN.test(output()), printed, ProgramFixture.LAUNCH_MILLISECONDS);
    const job = Number(NodePtyTerminalsTests.JOB_PATTERN.exec(output())?.[1]);
    try {
      await shell.stopAsync();

      Assert.isTrue(await ProgramFixture.waitForEndAsync(job, 2_000), output());
    }
    finally {
      if (ProgramFixture.isRunning(job))
        process.kill(job, "SIGKILL");
    }
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async readsTheShellsGroupAtItsPromptTheCommandsWhileItRunsAndNullOnceTheShellExited(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const shell = await processes.startPseudoTerminalAsync(
      ProcessSupervisorFixture.MODULE, new PseudoTerminalRequest(pty, NodePtyTerminalsTests.SHELL, ["--norc", "--noprofile", "-i"], folder.path, 80, 24, NodePtyTerminalsTests.ENVIRONMENT));
    const output = NodePtyTerminalsTests.collect(shell);
    const groups: (number | null)[] = [];
    const holds = async (group: number): Promise<boolean> => {
      groups.push(await shell.readForegroundProcessGroupAsync());
      return groups.at(-1) === group;
    };
    const printed = (): string => `The shell printed: ${JSON.stringify(output())}; the groups read were ${groups.join(",")}; ${NodePtyTerminalsTests.describe(shell.processId)}`;
    await ProcessSupervisorFixture.waitForAsync(() => NodePtyTerminalsTests.PROMPT_PATTERN.test(output()), printed, ProgramFixture.LAUNCH_MILLISECONDS);
    let job = 0;
    try {
      const atPrompt = await WaitFixture.untilAsync(() => holds(shell.processId), ProgramFixture.LAUNCH_MILLISECONDS);
      shell.write("/bin/sh -c 'echo job=$$; exec sleep 600'\r");
      await ProcessSupervisorFixture.waitForAsync(() => NodePtyTerminalsTests.JOB_PATTERN.test(output()), printed, ProgramFixture.LAUNCH_MILLISECONDS);
      job = Number(NodePtyTerminalsTests.JOB_PATTERN.exec(output())?.[1]);
      const whileRunning = await WaitFixture.untilAsync(() => holds(job), ProgramFixture.LAUNCH_MILLISECONDS);
      shell.write("\u0003");
      const ended = await ProgramFixture.waitForEndAsync(job, ProgramFixture.LAUNCH_MILLISECONDS);
      const afterCommand = await WaitFixture.untilAsync(() => holds(shell.processId), ProgramFixture.LAUNCH_MILLISECONDS);
      await shell.stopAsync();
      await shell.exited;
      const afterExit = await shell.readForegroundProcessGroupAsync();

      Assert.isTrue(atPrompt && whileRunning && ended && afterCommand, printed());
      Assert.areNotEqual(shell.processId, job, printed());
      Assert.isNull(afterExit);
    }
    finally {
      await shell.stopAsync();
      if (job > 0 && ProgramFixture.isRunning(job))
        process.kill(job, "SIGKILL");
    }
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async readsNoForegroundGroupOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.request(folder.path, [ProgramFixture.WAIT]));
    const output = NodePtyTerminalsTests.collect(terminal);
    try {
      await ProcessSupervisorFixture.waitForAsync(() => output().includes(ProgramFixture.READY), () => `The terminal printed: ${JSON.stringify(output())}`, ProgramFixture.LAUNCH_MILLISECONDS);

      Assert.isNull(await terminal.readForegroundProcessGroupAsync());
    }
    finally {
      await terminal.stopAsync();
    }
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async runsACommandPromptLineWithItsQuotesAndOperatorsAsItIsOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const line = "/d /s /c \"echo \"a b\" & echo \"one&two\" & echo three^&four^^ & echo \"bang!\" & echo \"q^^\" & exit 3\"";

    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.requestLine(folder.path, line, {}));
    const output = NodePtyTerminalsTests.collect(terminal);
    const exit = await terminal.exited;
    const expected = ["\"a b\"", "\"one&two\"", "three&four^", "\"bang!\"", "\"q^^\""];
    await ProcessSupervisorFixture.outputAsync(terminal, output, () => expected.every(t => output().includes(t)));

    Assert.areEqual("3 null", `${exit.code} ${exit.signal}`);
    Assert.isFalse(output().includes("\\\""), output());
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async runsACommandHeldInTheEnvironmentAfterACommandPromptStartScriptAsItIsOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const script = path.join(folder.path, "start&go (x86).bat");
    await writeFile(script, "@echo started %1\r\n@set NOLDOVA_STARTED=yes\r\n");
    const shell = NodePtyTerminalsTests.COMMAND_PROMPT;
    const line = `/d /s /c ""${script}" "-note=a&b" && "${shell}" /d /v:on /s /c ""${shell}" /d /s /c "set "NOLDOVA_TERMINAL_COMMAND=" ^& !NOLDOVA_TERMINAL_COMMAND!"""`;
    const command = "echo \"a b\" & echo \"one&two\" & echo after %NOLDOVA_STARTED% & exit 4";

    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, NodePtyTerminalsTests.requestLine(folder.path, line, { NOLDOVA_TERMINAL_COMMAND: command }));
    const output = NodePtyTerminalsTests.collect(terminal);
    const exit = await terminal.exited;
    const expected = ["started \"-note=a&b\"", "\"a b\"", "\"one&two\"", "after yes"];
    await ProcessSupervisorFixture.outputAsync(terminal, output, () => expected.every(t => output().includes(t)));

    Assert.areEqual("4 null", `${exit.code} ${exit.signal}`);
    Assert.isTrue(output().indexOf(expected[0] ?? String.empty) < output().indexOf(expected[1] ?? String.empty), output());
  }
}

@TestClass
export class ProcessSupervisorTerminalsTests {
  private static readonly KEPT: string = "NOLDOVA_DESKTOP_FIXTURE_TERMINAL";
  private static readonly CONSOLE_FAILURE: string = "The pseudo console was already closed.";
  private static readonly WORKER_FAILURE: string = "The output worker had already stopped.";
  private static readonly UNREPORTED: string = "The program ended, but its pseudo-terminal library didn't report its exit, so it ended without a code.";
  private static readonly COMMAND_LINE: string = "/d /s /c \"echo \"a b\"\"";
  private static readonly NODE_SHIM: string = [
    "@ECHO off", "GOTO start", ":find_dp0", "SET dp0=%~dp0", "EXIT /b", ":start", "SETLOCAL", "CALL :find_dp0", String.empty, "IF EXIST \"%dp0%\\node.exe\" (", "  SET \"_prog=%dp0%\\node.exe\"",
    ") ELSE (", "  SET \"_prog=node\"", "  SET PATHEXT=%PATHEXT:;.JS;=;%", ")", String.empty, "endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & \"%_prog%\"  \"%dp0%\\tool.js\" %*", String.empty
  ].join("\r\n");

  private static request(library: PseudoTerminalLibraryFixture, folder: string, launchArguments: readonly string[], signal?: AbortSignal): PseudoTerminalRequest {
    const environment: Record<string, string> = { [ProcessSupervisorTerminalsTests.KEPT]: "whole" };
    if (process.platform === "win32")
      environment["SystemRoot"] = ProcessSupervisorFixture.SYSTEM_ROOT;
    return new PseudoTerminalRequest(library, process.execPath, [ProgramFixture.file, ...launchArguments], folder, 80, 24, environment, Object.isUndefined(signal) ? {} : { signal });
  }

  private static async writeProgramAsync(folder: string): Promise<string> {
    const program = path.join(folder, "tool.exe");
    await writeFile(program, String.empty);
    return program;
  }

  private static start(processes: ProcessSupervisor, handle: PseudoTerminalHandleFixture, program: string, folder: string): Promise<PseudoTerminal> {
    const library: IPseudoTerminalLibrary = { spawn: (): IPseudoTerminalHandle => handle };
    return processes.startPseudoTerminalAsync(
      ProcessSupervisorFixture.MODULE, new PseudoTerminalRequest(library, program, [], folder, 80, 24, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }));
  }

  private static async refuseAsync(processes: ProcessSupervisor, handle: PseudoTerminalHandleFixture, program: string, folder: string): Promise<string> {
    const starting = ProcessSupervisorTerminalsTests.start(processes, handle, program, folder);
    await ProcessSupervisorFixture.waitForAsync(() => handle.listenerCount === 3);
    handle.exit({ exitCode: undefined });
    return (await Assert.throwsAsync(() => starting, ProcessStartFailedException)).message;
  }

  private static collect(terminal: PseudoTerminal): () => string {
    let text = String.empty;
    terminal.onOutput(t => {
      text += t;
    });
    return () => text;
  }

  @TestMethod
  public async startsAProgramInAPseudoTerminalWithTheWholeEnvironmentAndForgetsItOnceItExits(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const library = new PseudoTerminalLibraryFixture();

    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.ENVIRONMENT]));
    const listed = processes.programs.map(t => `${t.moduleId} ${t.processId}`).join(",");
    const records = settings.database.readAll(ProcessSupervisorFixture.RECORDS).length;
    const output = ProcessSupervisorTerminalsTests.collect(terminal);
    const exit = await terminal.exited;
    await ProcessSupervisorFixture.outputAsync(terminal, output, () => output().includes("\n"));
    await ProcessSupervisorFixture.changedAsync(processes, () => processes.programs.length === 0);
    const [options] = library.options;

    Assert.isTrue(exit.isClean);
    Assert.areEqual(`notes ${terminal.processId}`, listed);
    Assert.areEqual(1, records);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    Assert.areEqual(`[["${ProcessSupervisorTerminalsTests.KEPT}","whole"]]`, JSON.stringify(JsonReader.parse(output()).readValue("kept")));
    Assert.areEqual(`xterm-256color 80x24 ${folder.path} true false`, `${options?.name} ${options?.cols}x${options?.rows} ${options?.cwd} ${options?.useConptyDll} ${options?.conptyInheritCursor}`);
    Assert.areEqual(`${process.execPath} ${ProgramFixture.file} ${ProgramFixture.ENVIRONMENT}`, library.started.join(","));
  }

  @TestMethod
  public async keepsTheOutputOfAProgramThatPrintsAtOnceAndExitsUntilItsFirstListener(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const library = new PseudoTerminalLibraryFixture();

    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.ARGUMENTS, "printed", "at", "once"]));
    const exit = await ProcessSupervisorFixture.exitedAsync(terminal);
    const output = ProcessSupervisorTerminalsTests.collect(terminal);
    await ProcessSupervisorFixture.outputAsync(terminal, output, () => output().includes("\n"));

    Assert.isTrue(exit.isClean);
    Assert.areEqual(JSON.stringify(["printed", "at", "once"]), output().trim());
    Assert.isTrue(await terminal.stopAsync());
  }

  @TestMethod
  public async writesToTheProgramAndPassesItsSizePauseAndResumeToTheLibrary(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const library = new PseudoTerminalLibraryFixture();

    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.ECHO]));
    const output = ProcessSupervisorTerminalsTests.collect(terminal);
    await ProcessSupervisorFixture.printedAsync(terminal, output, ProgramFixture.READY);
    terminal.write("hello\n");
    await ProcessSupervisorFixture.printedAsync(terminal, output, "HELLO");
    terminal.resize(132, 43);
    terminal.pause();
    terminal.resume();
    const calls = library.calls.join(",");
    const ended = await terminal.stopAsync();

    Assert.areEqual("resize 132x43,pause,resume", calls);
    Assert.isTrue(ended);
  }

  @TestMethod
  public async endsATerminalItsOwnWayAndStopsTheLibrarysOutputWorkerOnceItExits(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const library = new PseudoTerminalLibraryFixture();
    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.WAIT]));
    const output = ProcessSupervisorTerminalsTests.collect(terminal);
    await ProcessSupervisorFixture.printedAsync(terminal, output, ProgramFixture.READY);

    const ended = await terminal.stopAsync();
    const exit = await terminal.exited;
    await ProcessSupervisorFixture.waitForAsync(() => library.calls.includes("terminate"));

    Assert.isTrue(ended);
    Assert.areEqual(process.platform === "win32" ? "resume,kill,terminate" : "resume,terminate", library.calls.join(","));
    if (process.platform !== "win32")
      Assert.areEqual("SIGHUP", exit.signal);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async killsATerminalThatIgnoresTheHangupAfterTheGraceAndGivesASecondCallerTheSameAnswer(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const library = new PseudoTerminalLibraryFixture();
    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.DEAF]));
    const output = ProcessSupervisorTerminalsTests.collect(terminal);
    await ProcessSupervisorFixture.printedAsync(terminal, output, ProgramFixture.READY);

    const first = terminal.stopAsync();
    await ProcessSupervisorFixture.waitForAsync(() => library.calls.includes("resume"));
    const second = terminal.stopAsync();
    const answers = await Promise.all([first, second]);
    const exit = await terminal.exited;

    Assert.areEqual(first, second);
    Assert.areEqual("false,false", answers.join(","));
    Assert.areEqual("SIGKILL", exit.signal);
    Assert.isTrue(
      ProcessSupervisorFixture.endsTheTree(settings.diagnostics.text, terminal, "It did not end within the grace period, so processes", "were ended forcefully."),
      settings.diagnostics.text);
  }

  @TestMethod
  public async resolvesAnExitThatCameBeforeAnyoneAwaitedItAndAnswersALaterStopAtOnce(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const library = new PseudoTerminalLibraryFixture();

    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.EXIT, "3"]));
    await ProcessSupervisorFixture.changedAsync(processes, () => processes.programs.length === 0);
    await ProcessSupervisorFixture.waitForAsync(() => terminal.hasExited);
    const exit = await terminal.exited;
    const ended = await terminal.stopAsync();

    Assert.areEqual("3 null", `${exit.code} ${exit.signal}`);
    Assert.isTrue(ended);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async stopsATerminalWhenItsSignalAbortsAndEndsWhatAnEarlierRuntimeLeftRunning(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const earlier = ProcessSupervisorFixture.create(settings);
    const library = new PseudoTerminalLibraryFixture();
    const controller = new AbortController();
    const aborted = await earlier.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.WAIT], controller.signal));
    const left = await earlier.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.WAIT]));
    const output = ProcessSupervisorTerminalsTests.collect(left);
    await ProcessSupervisorFixture.printedAsync(left, output, ProgramFixture.READY);

    controller.abort();
    await aborted.exited;
    await ProcessSupervisorFixture.changedAsync(earlier, () => earlier.programs.length === 1);
    const later = ProcessSupervisorFixture.create(settings);
    await later.cleanUpAsync();
    await left.exited;
    await earlier.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.isTrue(
      ProcessSupervisorFixture.endsTheTree(settings.diagnostics.text, left, "An earlier runtime left processes", "running, so they were ended."),
      settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async refusesAProgramTheLibraryCannotStartAndAPausedStartAndRecordsNothing(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const failure = new Error("posix_spawnp failed.");

    const failed = await Assert.throwsAsync(
      () => processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(new PseudoTerminalLibraryFixture(failure), folder.path, [])),
      ProcessStartFailedException);
    processes.pause();
    const paused = await Assert.throwsAsync(
      () => processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(new PseudoTerminalLibraryFixture(), folder.path, [])),
      UpdatePreparingException);
    processes.resume();

    Assert.areEqual(`${process.execPath} could not be started.`, failed.message);
    Assert.areEqual(failure, failed.cause);
    Assert.areEqual(`${process.execPath} was not started for the module notes, because the runtime is preparing for an update.`, paused.message);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async endsATerminalItCannotRecordAndStopsTheLibrarysOutputWorker(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    database.close();
    const processes = ProcessSupervisor.create(database, process.platform, process.env, new TextOutputFixture());
    const library = new PseudoTerminalLibraryFixture();

    const failure = await Assert.throwsAsync(
      () => processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.WAIT])),
      Error);
    await ProcessSupervisorFixture.waitForAsync(() => library.calls.includes("terminate"));

    Assert.isFalse(failure instanceof ProcessStartException);
    Assert.areEqual(process.platform === "win32" ? "kill,terminate" : "kill SIGKILL,terminate", library.calls.join(","));
    Assert.areEqual(0, processes.programs.length);
  }

  @TestMethod
  public async waitsForTheProgramsProcessIdBeforeItRecordsTheProgram(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings);
    const handle = new PseudoTerminalHandleFixture(0);
    const library: IPseudoTerminalLibrary = { spawn: (): IPseudoTerminalHandle => handle };
    const other = await ProcessSupervisorFixture.spawnAsync();

    const starting = processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, new PseudoTerminalRequest(library, process.execPath, [], folder.path, 80, 24, {}));
    await ProcessSupervisorFixture.waitForAsync(() => handle.listenerCount === 3);
    const early = settings.database.readAll(ProcessSupervisorFixture.RECORDS).length;
    handle.pid = other.pid ?? 0;
    handle.emit("\u001b[c");
    const terminal = await starting;
    const recorded = settings.database.readAll(ProcessSupervisorFixture.RECORDS).map(t => Number(t["process_id"]));
    const listeners = handle.listenerCount;
    handle.exit({ exitCode: 0 });
    await ProcessSupervisorFixture.endAsync(other);
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(0, early);
    Assert.areEqual(other.pid, terminal.processId);
    Assert.areEqual(String(other.pid), recorded.join(","));
    Assert.areEqual(2, listeners);
  }

  @TestMethod
  public async stopsWaitingForTheProcessIdWhenItsSignalAbortsAndEndsTheTerminal(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.create(settings, "linux");
    const handle = new PseudoTerminalHandleFixture(0);
    PseudoTerminalHandleFixture.addWorker(handle, () => handle.calls.push("terminate"));
    const library: IPseudoTerminalLibrary = { spawn: (): IPseudoTerminalHandle => handle };
    const abort = new AbortController();

    const starting = processes.startPseudoTerminalAsync(
      ProcessSupervisorFixture.MODULE, new PseudoTerminalRequest(library, process.execPath, [], folder.path, 80, 24, {}, { signal: abort.signal }));
    await ProcessSupervisorFixture.waitForAsync(() => handle.listenerCount === 3);
    abort.abort();
    const refused = await Assert.throwsAsync(() => starting, Error);
    handle.exit({ exitCode: undefined });
    await ProcessSupervisorFixture.waitForAsync(() => handle.calls.includes("terminate"));

    Assert.areEqual("AbortError", refused.name);
    Assert.areEqual("kill SIGKILL,terminate", handle.calls.join(","));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async refusesAProgramWhosePseudoConsoleEndsBeforeItStartsAndReleasesTheConsoleEvenWhenThatFails(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path);
    const posix = new PseudoTerminalHandleFixture(0);
    PseudoTerminalHandleFixture.addWorker(posix, () => {
      posix.calls.push("terminate");
      throw new Error(ProcessSupervisorTerminalsTests.WORKER_FAILURE);
    });
    const windows = new PseudoTerminalHandleFixture(0);
    windows.killFailure = new Error(ProcessSupervisorTerminalsTests.CONSOLE_FAILURE);
    PseudoTerminalHandleFixture.addWorker(windows, () => windows.calls.push("terminate"));

    const refused = await Promise.all([
      ProcessSupervisorTerminalsTests.refuseAsync(ProcessSupervisorFixture.create(settings, "linux"), posix, process.execPath, folder.path),
      ProcessSupervisorTerminalsTests.refuseAsync(ProcessSupervisorFixture.createWindows(settings, new WindowsProcessApiFixture([])), windows, program, folder.path)
    ]);
    await ProcessSupervisorFixture.waitForAsync(() => posix.calls.includes("terminate") && windows.calls.includes("terminate"));

    Assert.areEqual(`${process.execPath} could not be started.|${program} could not be started.`, refused.join("|"));
    Assert.areEqual("kill SIGKILL,terminate", posix.calls.join(","));
    Assert.areEqual("kill,terminate", windows.calls.join(","));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    Assert.isFalse(settings.diagnostics.text.includes("gave its exit code"), settings.diagnostics.text);
  }

  @TestMethod
  public async closesTheJobOfATerminalsProgramItCannotRecordOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const windows = new WindowsProcessApiFixture([]);
    settings.database.run("DROP TABLE owned_processes");
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);
    const handle = new PseudoTerminalHandleFixture();
    const program = await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path);

    const failure = await Assert.throwsAsync(() => ProcessSupervisorTerminalsTests.start(processes, handle, program, folder.path), Error);

    Assert.isFalse(failure instanceof ProcessStartException);
    Assert.areEqual(1, windows.opened.filter(t => t.endsWith(` ${WindowsProcessApiFixture.JOB}`)).length);
    Assert.areEqual(0, windows.openHandles);
    Assert.areEqual(0, processes.programs.length);
  }

  @TestMethod
  public async putsATerminalsProgramInAJobThatLetsWhatItStartsLeaveBeforeItRecordsItOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const windows = new WindowsProcessApiFixture([]);
    const recorded: number[] = [];
    windows.onAssign = () => recorded.push(settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);
    const handle = new PseudoTerminalHandleFixture();

    const terminal = await ProcessSupervisorTerminalsTests.start(processes, handle, await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path), folder.path);
    const stopping = terminal.stopAsync();
    await ProcessSupervisorFixture.waitForAsync(() => handle.calls.includes("kill"));
    handle.exit({ exitCode: 0 });
    await stopping;

    Assert.areEqual("0", recorded.join(","));
    Assert.areEqual("false", windows.createdJobs.join(","));
    Assert.areEqual(0, windows.openHandles);
  }

  @TestMethod
  public async givesATerminalWhoseLibraryReportsNoCodeItsProgramsExitCodeFromWindowsAndClosesItsProcess(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const windows = new WindowsProcessApiFixture([]);
    windows.exitCodes.set(4_250, 5);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);
    const handle = new PseudoTerminalHandleFixture(4_250);
    PseudoTerminalHandleFixture.addWorker(handle, () => handle.calls.push("terminate"));

    const terminal = await ProcessSupervisorTerminalsTests.start(processes, handle, await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path), folder.path);
    handle.exit({ exitCode: undefined });
    const exit = await terminal.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.length === 0);

    Assert.areEqual("5 null", `${exit.code} ${exit.signal}`);
    Assert.areEqual(String.empty, settings.diagnostics.text);
    Assert.areEqual(0, windows.openHandles);
    Assert.areEqual(String.empty, simulated.signals.join(","));
  }

  @TestMethod
  public async endsATerminalWithoutACodeAndSaysWhyWhenNeitherTheLibraryNorWindowsGivesItsCode(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const windows = new WindowsProcessApiFixture([]);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);
    const handle = new PseudoTerminalHandleFixture(4_251);

    const terminal = await ProcessSupervisorTerminalsTests.start(processes, handle, await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path), folder.path);
    handle.exit({ exitCode: undefined });
    const exit = await terminal.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.length === 0);
    const diagnostics = settings.diagnostics.text;

    Assert.areEqual("null null", `${exit.code} ${exit.signal}`);
    Assert.isTrue(diagnostics.startsWith(ProcessSupervisorFixture.line(terminal,
      "The program ended, but neither its pseudo-terminal library nor Windows gave its exit code, so it ended without a code: ").slice(0, -1)), diagnostics);
    Assert.isTrue(diagnostics.includes("Windows gave no exit code for process 4251."), diagnostics);
    Assert.areEqual(0, windows.openHandles);
    Assert.areEqual(String.empty, simulated.signals.join(","));
  }

  @TestMethod
  public async endsATerminalWithoutACodeAndSaysWhyWhenItsProgramHasNoJobAndTheLibraryGivesNoCode(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    const windows = new WindowsProcessApiFixture([]);
    windows.denied.set(4_252, WindowsProcessApiFixture.JOB);
    const processes = ProcessSupervisorFixture.createWindows(settings, windows);
    const handle = new PseudoTerminalHandleFixture(4_252);

    const terminal = await ProcessSupervisorTerminalsTests.start(processes, handle, await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path), folder.path);
    handle.exit({ exitCode: undefined });
    const exit = await terminal.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.length === 0);
    const diagnostics = settings.diagnostics.text;

    Assert.areEqual("null null", `${exit.code} ${exit.signal}`);
    Assert.isTrue(diagnostics.includes("Process 4252 could not be put in a job of its own, with Windows error 5"), diagnostics);
    Assert.isTrue(diagnostics.includes(ProcessSupervisorFixture.line(terminal,
      "The program ended, but neither its pseudo-terminal library nor Windows gave its exit code, so it ended without a code: ").slice(0, -1)), diagnostics);
    Assert.isTrue(diagnostics.includes("Process 4252 is in no job of the runtime's, so Windows wasn't asked for its exit code."), diagnostics);
    Assert.areEqual(0, windows.openHandles);
    Assert.areEqual(String.empty, simulated.signals.join(","));
  }

  @TestMethod
  public async endsATerminalOnWindowsByClosingItsPseudoConsoleAndStopsTheOutputWorkerOnceItExits(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.createWindows(settings, new WindowsProcessApiFixture([]));
    const handle = new PseudoTerminalHandleFixture();
    PseudoTerminalHandleFixture.addWorker(handle, () => handle.calls.push("terminate"));

    const terminal = await ProcessSupervisorTerminalsTests.start(processes, handle, await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path), folder.path);
    const stopping = terminal.stopAsync();
    await ProcessSupervisorFixture.waitForAsync(() => handle.calls.includes("kill"));
    handle.exit({ exitCode: 0 });
    const ended = await stopping;
    await ProcessSupervisorFixture.waitForAsync(() => handle.calls.includes("terminate"));

    Assert.isTrue(ended);
    Assert.areEqual("resume,kill,terminate", handle.calls.join(","));
  }

  @TestMethod
  public async reportsAPseudoConsoleThatFailsToCloseAndAnOutputWorkerThatFailsToStopOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.createWindows(settings, new WindowsProcessApiFixture([]));
    const handle = new PseudoTerminalHandleFixture();
    handle.killFailure = new Error(ProcessSupervisorTerminalsTests.CONSOLE_FAILURE);
    PseudoTerminalHandleFixture.addWorker(handle, () => {
      throw new Error(ProcessSupervisorTerminalsTests.WORKER_FAILURE);
    });

    const terminal = await ProcessSupervisorTerminalsTests.start(processes, handle, await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path), folder.path);
    const stopping = terminal.stopAsync();
    await ProcessSupervisorFixture.waitForAsync(() => settings.diagnostics.text.includes(ProcessSupervisorTerminalsTests.CONSOLE_FAILURE));
    handle.exit({ exitCode: 0 });
    await stopping;
    await ProcessSupervisorFixture.waitForAsync(() => settings.diagnostics.text.includes(ProcessSupervisorTerminalsTests.WORKER_FAILURE));

    Assert.isTrue(
      settings.diagnostics.text.startsWith(ProcessSupervisorFixture.line(terminal, `Error: ${ProcessSupervisorTerminalsTests.CONSOLE_FAILURE}`).slice(0, -1)),
      settings.diagnostics.text);
    Assert.areEqual("resume,kill", handle.calls.join(","));
  }

  @TestMethod
  public async refusesABatchFileThatWouldRunThroughCmdOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.createWindows(settings, new WindowsProcessApiFixture([]));
    const library = new PseudoTerminalLibraryFixture();
    const file = path.join(folder.path, "tool.cmd");
    await writeFile(file, "@echo %*\r\n");

    const refused = await Assert.throwsAsync(
      () => processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, new PseudoTerminalRequest(library, file, ["a"], folder.path, 80, 24, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT })),
      PseudoTerminalBatchRefusedException);

    Assert.areEqual(`${file} is a batch file whose program could not be traced, and a pseudo-terminal starts no batch file through cmd.exe.`, refused.message);
    Assert.areEqual(0, library.started.length);
  }

  @TestMethod
  @Category("Timing")
  public async endsATerminalWhoseProgramIsFoundGoneWithoutACodeWhenTheLibraryReportsNoExitOnMacOSAndLinux(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const posix = new PseudoTerminalHandleFixture(4_240);
    const windows = new PseudoTerminalHandleFixture(4_241);
    const probes: number[] = [];
    using kill = new ProcessKillFixture((processId, signal) => {
      if (signal === 0)
        probes.push(processId);
      return processId === posix.pid && probes.filter(t => t === posix.pid).length === 1;
    });
    PseudoTerminalHandleFixture.addSocket(posix, { destroy: () => posix.calls.push("destroy") });
    PseudoTerminalHandleFixture.addWorker(windows, () => windows.calls.push("terminate"));
    const starting = Date.now();
    const terminal = await ProcessSupervisorTerminalsTests.start(ProcessSupervisor.create(settings.database, "linux", process.env, settings.diagnostics, new ProcessSettings(300, 500, 5_000, 100, 100)), posix, process.execPath, folder.path);
    const processes = ProcessSupervisorFixture.createWindows(settings, new WindowsProcessApiFixture([]));
    const other = await ProcessSupervisorTerminalsTests.start(processes, windows, await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path), folder.path);
    const otherProbes = probes.filter(t => t === windows.pid).length;
    terminal.pause();

    await ProcessSupervisorFixture.waitForAsync(() => terminal.hasExited, () => settings.diagnostics.text, 10_000);
    const waited = Date.now() - starting;
    const exit = await terminal.exited;
    await ProcessSupervisorFixture.waitForAsync(() => settings.database.readAll(ProcessSupervisorFixture.RECORDS).length === 1);
    posix.exit({ exitCode: 0 });
    const diagnostics = settings.diagnostics.text;
    const hasOtherExited = other.hasExited;
    const laterOtherProbes = probes.filter(t => t === windows.pid).length;
    windows.exit({ exitCode: 0 });
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.length === 0 && settings.database.readAll(ProcessSupervisorFixture.RECORDS).length === 0);

    Assert.areEqual("null null", `${exit.code} ${exit.signal}`);
    Assert.isTrue(waited >= 290, `A timing test: the program was given up on ${waited} ms after it started, though a probe found it running 100 ms after; the terminal watch's interval and report wait set this lower bound, with 10 ms for a timer's rounding, and a busy machine only makes the wait longer, so it cannot fail this bound.`);
    Assert.areEqual("pause,destroy", posix.calls.join(","));
    Assert.areEqual(ProcessSupervisorFixture.line(terminal, ProcessSupervisorTerminalsTests.UNREPORTED), diagnostics);
    Assert.areEqual(diagnostics, settings.diagnostics.text);
    Assert.isFalse(hasOtherExited);
    Assert.areEqual(otherProbes, laterOtherProbes);
    Assert.areEqual(0, kill.signals.length);
  }

  @TestMethod
  public async watchesAStoppedTerminalOftenAndEndsItWithoutACodeOnceItsProgramIsGoneAndTheLibraryReportsNoExit(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const handle = new PseudoTerminalHandleFixture(4_242);
    let isHungUp = false;
    using kill = new ProcessKillFixture((processId, signal) => {
      if (processId === -handle.pid && signal === "SIGHUP")
        isHungUp = true;
      return Math.abs(processId) === handle.pid && !isHungUp;
    });
    PseudoTerminalHandleFixture.addSocket(handle, { destroy: () => handle.calls.push("destroy") });
    const processes = ProcessSupervisorFixture.createLinux(settings, new ProcessTableFixture([]), new ProcessSettings(300, 500, 5_000, 60_000, 100));
    const terminal = await ProcessSupervisorTerminalsTests.start(processes, handle, process.execPath, folder.path);

    const ended = await terminal.stopAsync();
    await ProcessSupervisorFixture.waitForAsync(() => terminal.hasExited, () => settings.diagnostics.text);
    const exit = await terminal.exited;

    Assert.isTrue(ended);
    Assert.areEqual("null null", `${exit.code} ${exit.signal}`);
    Assert.areEqual(`-${handle.pid} SIGHUP`, kill.signals.join(","));
    Assert.areEqual("resume,destroy", handle.calls.join(","));
    Assert.areEqual(ProcessSupervisorFixture.line(terminal, ProcessSupervisorTerminalsTests.UNREPORTED), settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsAStoppedTerminalWhoseOutputIsPausedWithoutACodeWhenTheLibraryNeverReportsItsExit(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisor.create(settings.database, process.platform, process.env, settings.diagnostics, new ProcessSettings(300, 500, 5_000, 100, 100));
    const library = new PseudoTerminalLibraryFixture();
    library.holdsExits = true;
    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.WAIT]));
    const output = ProcessSupervisorTerminalsTests.collect(terminal);
    await ProcessSupervisorFixture.printedAsync(terminal, output, ProgramFixture.READY);
    terminal.pause();

    const ended = await terminal.stopAsync();
    const exit = await terminal.exited;
    await ProcessSupervisorFixture.waitForAsync(() => library.calls.includes("terminate"), () => settings.diagnostics.text);
    library.terminals[0]?.releaseExit();

    Assert.isTrue(ended);
    Assert.areEqual("null null", `${exit.code} ${exit.signal}`);
    Assert.areEqual("pause,resume,destroy,terminate", library.calls.join(","));
    Assert.areEqual(ProcessSupervisorFixture.line(terminal, ProcessSupervisorTerminalsTests.UNREPORTED), settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsATerminalItCannotRecordWithoutACodeWhenTheLibraryNeverReportsItsExit(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    const database = await ShellDatabase.openAsync(lock, ShellMigrations.all);
    database.close();
    const diagnostics = new TextOutputFixture();
    const processes = ProcessSupervisor.create(database, process.platform, process.env, diagnostics, new ProcessSettings(300, 500, 5_000, 50, 100));
    const library = new PseudoTerminalLibraryFixture();
    library.holdsExits = true;

    const failure = await Assert.throwsAsync(
      () => processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.WAIT])),
      Error);
    await ProcessSupervisorFixture.waitForAsync(() => library.calls.includes("terminate"), () => diagnostics.text);
    library.terminals[0]?.releaseExit();

    Assert.isFalse(failure instanceof ProcessStartException);
    Assert.areEqual("kill SIGKILL,destroy,terminate", library.calls.join(","));
    Assert.isTrue(diagnostics.text.endsWith(`${ProcessSupervisorTerminalsTests.UNREPORTED}\n`), diagnostics.text);
    Assert.areEqual(0, processes.programs.length);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsATerminalWhoseProgramExitsByItselfWithoutACodeWhenTheLibraryNeverReportsItsExit(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisor.create(settings.database, process.platform, process.env, settings.diagnostics, new ProcessSettings(300, 500, 5_000, 100, 100));
    const library = new PseudoTerminalLibraryFixture();
    library.holdsExits = true;

    const terminal = await processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, ProcessSupervisorTerminalsTests.request(library, folder.path, [ProgramFixture.EXIT, "0"]));
    terminal.pause();
    const exit = await ProcessSupervisorFixture.exitedAsync(terminal, () => `The diagnostics said ${JSON.stringify(settings.diagnostics.text)}; the library was called with ${library.calls.join(",")}.`);
    await ProcessSupervisorFixture.changedAsync(processes, () => processes.programs.length === 0, () => `The diagnostics said ${JSON.stringify(settings.diagnostics.text)}.`);

    Assert.areEqual("null null", `${exit.code} ${exit.signal}`);
    Assert.areEqual("pause,destroy,terminate", library.calls.join(","));
    Assert.areEqual(ProcessSupervisorFixture.line(terminal, ProcessSupervisorTerminalsTests.UNREPORTED), settings.diagnostics.text);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async passesACommandLineToTheLibraryAsItIsOnWindows(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const processes = ProcessSupervisorFixture.createWindows(settings, new WindowsProcessApiFixture([]));
    const handle = new PseudoTerminalHandleFixture();
    const spawned: (string | readonly string[])[] = [];
    const library: IPseudoTerminalLibrary = {
      spawn: (file: string, launchArguments: string[] | string): IPseudoTerminalHandle => {
        spawned.push(file, launchArguments);
        return handle;
      }
    };
    const program = await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path);

    const terminal = await processes.startPseudoTerminalAsync(
      ProcessSupervisorFixture.MODULE,
      new PseudoTerminalRequest(library, program, [], folder.path, 80, 24, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, { commandLine: ProcessSupervisorTerminalsTests.COMMAND_LINE }));
    const stopping = terminal.stopAsync();
    await ProcessSupervisorFixture.waitForAsync(() => handle.calls.includes("kill"));
    handle.exit({ exitCode: 0 });
    await stopping;

    Assert.areEqual(JSON.stringify([program, ProcessSupervisorTerminalsTests.COMMAND_LINE]), JSON.stringify(spawned));
  }

  @TestMethod
  public async refusesACommandLineOnMacOSAndLinuxBesideArgumentsAndForABatchFile(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const library = new PseudoTerminalLibraryFixture();
    const windows = ProcessSupervisorFixture.createWindows(settings, new WindowsProcessApiFixture([]));
    const program = await ProcessSupervisorTerminalsTests.writeProgramAsync(folder.path);
    const batch = path.join(folder.path, "start&go (x86).cmd");
    const shim = path.join(folder.path, "tool.cmd");
    const upper = path.join(folder.path, "RUN.BAT");
    const found = path.join(folder.path, "run.cmd");
    for (const file of [batch, upper, found])
      await writeFile(file, "@echo %*\r\n");
    await writeFile(shim, ProcessSupervisorTerminalsTests.NODE_SHIM);
    for (const file of ["node.exe", "tool.js"])
      await writeFile(path.join(folder.path, file), String.empty);
    const request = (file: string, launchArguments: readonly string[], variables: Readonly<Record<string, string>> = {}): PseudoTerminalRequest => new PseudoTerminalRequest(
      library, file, launchArguments, folder.path, 80, 24, { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT, ...variables }, { commandLine: ProcessSupervisorTerminalsTests.COMMAND_LINE });
    const refuseAsync = async (
      processes: ProcessSupervisor,
      refusedRequest: PseudoTerminalRequest,
      exceptionType: new (...arguments_: never[]) => ProcessStartException): Promise<string> =>
      (await Assert.throwsAsync(() => processes.startPseudoTerminalAsync(ProcessSupervisorFixture.MODULE, refusedRequest), exceptionType)).message;
    const batchRefusal = (file: string): string =>
      `${file} is a batch file, and a pseudo-terminal passes a command line as it is only to a program that isn't one; give cmd.exe the batch file in its command line instead.`;
    const batchRefused = PseudoTerminalCommandLineBatchRefusedException;

    const refused = [
      await refuseAsync(ProcessSupervisorFixture.create(settings, "linux"), request("/bin/sh", []), PseudoTerminalCommandLineRefusedException),
      await refuseAsync(ProcessSupervisorFixture.create(settings, "darwin"), request("/bin/zsh", []), PseudoTerminalCommandLineRefusedException),
      await refuseAsync(windows, request(program, ["/d"]), PseudoTerminalCommandLineWithArgumentsException),
      await refuseAsync(windows, request(batch, []), batchRefused),
      await refuseAsync(windows, request(shim, []), batchRefused),
      await refuseAsync(windows, request(upper, []), batchRefused),
      await refuseAsync(windows, request("run", [], { Path: folder.path, PATHEXT: ".EXE;.CMD" }), batchRefused)
    ];

    Assert.areEqual([
      "/bin/sh was given a command line to pass as it is, which a pseudo-terminal takes only on Windows.",
      "/bin/zsh was given a command line to pass as it is, which a pseudo-terminal takes only on Windows.",
      `${program} was given both a command line to pass as it is and arguments, and a pseudo-terminal takes one or the other.`,
      batchRefusal(batch),
      batchRefusal(shim),
      batchRefusal(upper),
      batchRefusal(found)
    ].join("|"), refused.join("|"));
    Assert.areEqual(0, library.started.length);
    Assert.areEqual(0, windows.programs.length);
  }
}
