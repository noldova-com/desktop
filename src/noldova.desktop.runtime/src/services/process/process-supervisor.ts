/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { addAbortListener, once } from "node:events";
import path from "node:path";
import type { Writable } from "node:stream";
import { inspect } from "node:util";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { ProgramStatusList, UpdateProcess } from "@noldova/desktop.protocol";

import { ModuleStoppingException } from "../../exceptions/module-stopping.exception.js";
import { ProcessStartFailedException } from "../../exceptions/process-start-failed.exception.js";
import { PseudoTerminalBatchRefusedException } from "../../exceptions/pseudo-terminal-batch-refused.exception.js";
import { PseudoTerminalCommandLineBatchRefusedException } from "../../exceptions/pseudo-terminal-command-line-batch-refused.exception.js";
import { PseudoTerminalCommandLineRefusedException } from "../../exceptions/pseudo-terminal-command-line-refused.exception.js";
import { PseudoTerminalCommandLineWithArgumentsException } from "../../exceptions/pseudo-terminal-command-line-with-arguments.exception.js";
import { UpdatePreparingException } from "../../exceptions/update-preparing.exception.js";
import { VerbatimBatchRefusedException } from "../../exceptions/verbatim-batch-refused.exception.js";
import type { IPosixProcessTableApi } from "../../interfaces/i-posix-process-table-api.js";
import type { IProcessEnder } from "../../interfaces/i-process-ender.js";
import type { IPseudoTerminalHandle } from "../../interfaces/i-pseudo-terminal-handle.js";
import type { IPseudoTerminalSubscription } from "../../interfaces/i-pseudo-terminal-subscription.js";
import type { IWindowsProcessApi } from "../../interfaces/i-windows-process-api.js";
import { KeptProgram } from "../../models/kept-program.js";
import { OwnedProcess } from "../../models/owned-process.js";
import type { ProcessEnding } from "../../models/process-ending.js";
import { ProcessExit } from "../../models/process-exit.js";
import type { ProcessLaunch } from "../../models/process-launch.js";
import type { ProcessRecord } from "../../models/process-record.js";
import type { ProcessRequest } from "../../models/process-request.js";
import { PseudoTerminal } from "../../models/pseudo-terminal.js";
import { PseudoTerminalConsole } from "../../models/pseudo-terminal-console.js";
import type { PseudoTerminalRequest } from "../../models/pseudo-terminal-request.js";
import { ProcessSettings } from "../../models/process-settings.js";
import { Registration } from "../../models/registration.js";
import { RunningProcess } from "../../models/running-process.js";
import { RunningProgram } from "../../models/running-program.js";
import { WatchedPseudoTerminalHandle } from "../../models/watched-pseudo-terminal-handle.js";
import { Resources } from "../../resources.js";
import type { ShellDatabase } from "../database/shell-database.js";
import { CurrentEnvironment } from "../environment/current-environment.js";
import { ForegroundProcessGroupReader } from "./foreground-process-group.reader.js";
import { ProcessClock } from "./process-clock.js";
import { ProcessEnderFactory } from "./process-ender-factory.js";
import { PosixProcessApi } from "./posix-process-api.js";
import { ProcessEnvironment } from "./process-environment.js";
import { ProcessRecordStore } from "./process-record-store.js";
import { ProcessSignals } from "./process-signals.js";
import { ProgramLaunchResolver } from "./program-launch-resolver.js";
import { ProgramLocator } from "./program-locator.js";
import { WindowsProcessApi } from "./windows-process-api.js";

export class ProcessSupervisor {
  private readonly platform: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly records: ProcessRecordStore;
  private readonly locator: ProgramLocator;
  private readonly resolver: ProgramLaunchResolver;
  private readonly clock: ProcessClock;
  private readonly ender: IProcessEnder;
  private readonly diagnostics: Writable;
  private readonly seenMilliseconds: number;
  private readonly endMilliseconds: number;
  private readonly terminalWatchMilliseconds: number;
  private readonly terminalReportMilliseconds: number;
  private readonly currentEnvironment: CurrentEnvironment;
  private readonly foregroundGroups: ForegroundProcessGroupReader;
  private readonly running: Map<OwnedProcess | PseudoTerminal, RunningProcess> = new Map();
  private readonly kept: Map<KeptProgram, Date> = new Map();
  private readonly pending: Map<Promise<void>, string> = new Map();
  private readonly stopping: Set<string> = new Set();
  private readonly unrenewed: Set<ProcessRecord> = new Set();
  private readonly listeners: Set<() => void> = new Set();
  private isStopping: boolean = false;
  private sequence: number = 0;
  private isPaused: boolean = false;
  private seeing: NodeJS.Timeout | undefined;

  public constructor(
    database: ShellDatabase,
    platform: string,
    environment: NodeJS.ProcessEnv,
    posix: IPosixProcessTableApi,
    diagnostics: Writable,
    windows: IWindowsProcessApi,
    settings: ProcessSettings = new ProcessSettings(),
    clock: ProcessClock = ProcessClock.create(process.platform)) {
    this.platform = platform;
    this.environment = environment;
    this.records = new ProcessRecordStore(database);
    this.locator = new ProgramLocator(platform);
    this.resolver = new ProgramLaunchResolver(platform, environment);
    this.clock = clock;
    this.ender = ProcessEnderFactory.create(platform, posix, windows, settings, clock);
    this.diagnostics = diagnostics;
    this.seenMilliseconds = settings.seenMilliseconds;
    this.endMilliseconds = settings.endMilliseconds;
    this.terminalWatchMilliseconds = settings.terminalWatchMilliseconds;
    this.terminalReportMilliseconds = settings.terminalReportMilliseconds;
    this.currentEnvironment = CurrentEnvironment.create(platform, environment, diagnostics);
    this.foregroundGroups = new ForegroundProcessGroupReader(platform);
  }

  public static create(
    database: ShellDatabase,
    platform: string,
    environment: NodeJS.ProcessEnv,
    diagnostics: Writable,
    settings: ProcessSettings = new ProcessSettings(),
    clock: ProcessClock = ProcessClock.create(process.platform)): ProcessSupervisor {
    return new ProcessSupervisor(database, platform, environment, PosixProcessApi.create(platform), diagnostics, WindowsProcessApi.create(), settings, clock);
  }

  public get programs(): readonly RunningProgram[] {
    return [
      ...[...this.running.values()].map(t => new RunningProgram(t.record.moduleId, t.record.program, t.record.processId, t.started, false)),
      ...[...this.kept].map(([kept, started]) => new RunningProgram(kept.record.moduleId, kept.record.program, kept.record.processId, started, true))
    ];
  }

  public get status(): ProgramStatusList {
    return new ProgramStatusList(this.programs.map(t => t.toStatus()), this.sequence);
  }

  public onChanged(listener: () => void): Registration {
    const entry = (): void => listener();
    this.listeners.add(entry);
    return new Registration(() => this.listeners.delete(entry));
  }

  public get updateProcesses(): readonly UpdateProcess[] {
    return [...this.running.values(), ...this.kept.keys()].map(t => new UpdateProcess(t.record.processId, t.record.requested, t.record.started, Resources.programRole));
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public startAsync(moduleId: string, request: ProcessRequest): Promise<OwnedProcess> {
    const starting = this.launchAsync(moduleId, request);
    this.track(moduleId, starting.then(() => undefined, () => undefined));
    return starting;
  }

  public startPseudoTerminalAsync(moduleId: string, request: PseudoTerminalRequest): Promise<PseudoTerminal> {
    const starting = this.launchTerminalAsync(moduleId, request);
    this.track(moduleId, starting.then(() => undefined, () => undefined));
    return starting;
  }

  public async stopOwnedByAsync(moduleId: string): Promise<void> {
    this.stopping.add(moduleId);
    await Promise.all([...this.pending].filter(([, t]) => t === moduleId).map(([t]) => t));
    await this.endAsync(
      [...this.running.values()].filter(t => t.record.moduleId === moduleId),
      [...this.kept.keys()].filter(t => t.record.moduleId === moduleId));
  }

  public readEnvironmentAsync(): Promise<Readonly<Record<string, string>>> {
    return this.currentEnvironment.readAsync();
  }

  public async stopAllAsync(): Promise<void> {
    this.isStopping = true;
    this.currentEnvironment.end();
    await Promise.all(this.pending.keys());
    await this.endAsync([...this.running.values()], [...this.kept.keys()]);
  }

  public async cleanUpAsync(): Promise<void> {
    const records = this.records.readAll();
    for (const record of records.filter(t => !this.clock.isSameBoot(t.boot)))
      this.records.remove(record);
    const stepped = records.filter(t => this.clock.isSameBoot(t.boot) && this.clock.hasStepped(t.clockOffset));
    for (const record of stepped) {
      this.write(record, Resources.clockStepped);
      this.records.remove(record);
    }
    const current = records.filter(t => this.clock.isSameBoot(t.boot) && !stepped.includes(t));
    if (current.length === 0)
      return;
    try {
      for (const ending of await this.ender.endLeftoversAsync(current))
        this.finish(ending, Resources.formatLeftoversEnded(ending.forced));
    }
    catch (error) {
      for (const record of current)
        this.report(record, error);
    }
  }

  private async launchAsync(moduleId: string, request: ProcessRequest): Promise<OwnedProcess> {
    this.checkStart(moduleId, request.program, request.signal);
    const environment = ProcessEnvironment.create(this.platform, this.environment, request);
    const program = await this.locator.locateAsync(request.program, environment);
    if (request.isVerbatim && this.platform === Resources.windowsPlatform && Resources.batchExtensions.includes(path.extname(program).toLowerCase()))
      throw new VerbatimBatchRefusedException(program);
    const launch = await this.resolver.resolveAsync(program, request.arguments, environment, request.isVerbatim);
    const requested = this.clock.now();
    const child = this.spawn(program, launch, request.workingFolder, environment.values);
    const created = this.clock.now();
    this.adopt(child.pid);
    const ending = new Promise<readonly [ProcessExit, number]>(resolve =>
      child.once(Resources.exitEvent, (code: number | null, signal: NodeJS.Signals | null) => resolve([new ProcessExit(code, signal), this.clock.now()])));
    const exited = ending.then(([t]) => t);
    try {
      await once(child, Resources.spawnEvent);
    }
    catch (error) {
      this.ender.release(Number(child.pid));
      throw new ProcessStartFailedException(program, new ExceptionOptions(error));
    }

    const started = new Date();
    const record = this.record(child, moduleId, program, launch.executable, requested, created);
    this.claim(record);
    const owned = new OwnedProcess(child, program, started, exited, t => this.stopAsync(t));
    child.stdin.on(Resources.errorEvent, (error: Error) => this.report(record, error));
    const askToEnd = (): void => {
      if (this.platform === Resources.windowsPlatform && !child.stdin.writableEnded)
        child.stdin.end();
    };
    this.running.set(owned, new RunningProcess(record, started, ending.then(([, t]) => t), Resources.terminateSignal, askToEnd));
    this.watch();
    this.publish();
    if (!Object.isUndefined(request.signal)) {
      const listener = addAbortListener(request.signal, () => void owned.stopAsync());
      void exited.then(() => listener[Symbol.dispose]());
    }
    void exited.then(t => this.track(moduleId, this.handleExitAsync(owned, record, started, t.isClean)));
    return owned;
  }

  private async launchTerminalAsync(moduleId: string, request: PseudoTerminalRequest): Promise<PseudoTerminal> {
    this.checkStart(moduleId, request.program, request.signal);
    this.checkCommandLine(request);
    const environment = ProcessEnvironment.whole(this.platform, request.environment);
    const program = await this.locator.locateAsync(request.program, environment);
    if (!Object.isUndefined(request.commandLine) && Resources.batchExtensions.includes(path.extname(program).toLowerCase()))
      throw new PseudoTerminalCommandLineBatchRefusedException(program);
    const launch = await this.resolver.resolveAsync(program, request.arguments, environment);
    if (launch.isVerbatim)
      throw new PseudoTerminalBatchRefusedException(program);
    const requested = this.clock.now();
    const library = this.spawnTerminal(program, launch, request);
    const handle = new WatchedPseudoTerminalHandle(library, this.terminalWatchMilliseconds, this.terminalReportMilliseconds, () => this.readExitCodeAsync(moduleId, program, library.pid));
    const terminal = new PseudoTerminal(handle, program, new Date(), t => this.stopTerminalAsync(t), (t, u) => this.foregroundGroups.readAsync(t, u),
      (t, u) => this.foregroundGroups.readProcessAsync(t, u));
    const terminalConsole = new PseudoTerminalConsole(library, this.platform);
    const exitTime = terminal.exited.then(() => this.clock.now());
    await ProcessSupervisor.waitForProcessAsync(handle, terminal, request.signal);
    const created = this.clock.now();
    if (handle.pid <= 0) {
      this.abandon(moduleId, program, handle, terminal, terminalConsole);
      request.signal?.throwIfAborted();
      throw new ProcessStartFailedException(program);
    }
    this.ender.adopt(handle.pid, false);
    if (this.platform !== Resources.windowsPlatform)
      handle.watch(t => this.diagnostics.write(Resources.formatProcessDiagnostic(moduleId, program, handle.pid, t)));
    let record: ProcessRecord;
    try {
      record = this.records.add(moduleId, handle.pid, program, launch.executable, this.clock.boot, requested, created, this.clock.offset());
    }
    catch (error) {
      this.ender.release(handle.pid);
      this.abandon(moduleId, program, handle, terminal, terminalConsole);
      throw error;
    }
    this.claim(record);
    const askToEnd = (): void => {
      terminal.resume();
      handle.watchClosely();
      if (this.platform === Resources.windowsPlatform)
        this.closeConsole(terminalConsole, record);
    };
    this.running.set(terminal, new RunningProcess(record, terminal.started, exitTime, Resources.hangupSignal, askToEnd));
    this.watch();
    this.publish();
    if (!Object.isUndefined(request.signal)) {
      const listener = addAbortListener(request.signal, () => void terminal.stopAsync());
      void terminal.exited.then(() => listener[Symbol.dispose]());
    }
    void terminal.exited.then(t => {
      this.releaseConsole(terminalConsole, record);
      this.track(moduleId, this.handleExitAsync(terminal, record, terminal.started, t.isClean));
    });
    return terminal;
  }

  private checkStart(moduleId: string, program: string, signal: AbortSignal | undefined): void {
    if (this.isStopping || this.stopping.has(moduleId))
      throw new ModuleStoppingException(moduleId, program);
    if (this.isPaused)
      throw new UpdatePreparingException(moduleId, program);
    signal?.throwIfAborted();
  }

  private checkCommandLine(request: PseudoTerminalRequest): void {
    if (Object.isUndefined(request.commandLine))
      return;
    if (this.platform !== Resources.windowsPlatform)
      throw new PseudoTerminalCommandLineRefusedException(request.program);
    if (request.arguments.length > 0)
      throw new PseudoTerminalCommandLineWithArgumentsException(request.program);
  }

  private spawnTerminal(program: string, launch: ProcessLaunch, request: PseudoTerminalRequest): IPseudoTerminalHandle {
    try {
      return request.library.spawn(launch.executable, request.commandLine ?? [...launch.arguments], {
        name: Resources.terminalName,
        cols: request.columns,
        rows: request.rows,
        cwd: request.workingFolder,
        env: { ...request.environment },
        useConptyDll: true,
        conptyInheritCursor: request.inheritsCursor
      });
    }
    catch (error) {
      throw new ProcessStartFailedException(program, new ExceptionOptions(error));
    }
  }

  private static waitForProcessAsync(handle: IPseudoTerminalHandle, terminal: PseudoTerminal, signal: AbortSignal | undefined): Promise<void> {
    if (handle.pid > 0)
      return Promise.resolve();
    let output: IPseudoTerminalSubscription | undefined;
    let aborted: Disposable | undefined;
    const started = new Promise<void>(resolve => {
      output = handle.onData(() => {
        if (handle.pid > 0)
          resolve();
      });
      void terminal.exited.then(() => resolve());
      if (!Object.isUndefined(signal))
        aborted = addAbortListener(signal, () => resolve());
    });
    return started.finally(() => {
      output?.dispose();
      aborted?.[Symbol.dispose]();
    });
  }

  private abandon(moduleId: string, program: string, handle: IPseudoTerminalHandle, terminal: PseudoTerminal, terminalConsole: PseudoTerminalConsole): void {
    const report = (error: unknown): void => {
      this.diagnostics.write(Resources.formatProcessDiagnostic(moduleId, program, handle.pid, Resources.formatTerminalNotAbandoned(inspect(error))));
    };
    void Promise.resolve()
      .then(() => this.platform === Resources.windowsPlatform ? terminalConsole.close() : handle.kill(Resources.killSignal))
      .catch(report)
      .then(() => terminal.exited)
      .then(() => terminalConsole.stopOutputWorkerAsync())
      .catch(report);
  }

  private async readExitCodeAsync(moduleId: string, program: string, processId: number): Promise<number | undefined> {
    if (processId <= 0)
      return undefined;
    try {
      return await this.ender.readExitCodeAsync(processId);
    }
    catch (error) {
      this.diagnostics.write(Resources.formatProcessDiagnostic(moduleId, program, processId, Resources.formatExitCodeUnread(inspect(error))));
      return undefined;
    }
  }

  private closeConsole(terminalConsole: PseudoTerminalConsole, record: ProcessRecord): void {
    try {
      terminalConsole.close();
    }
    catch (error) {
      this.report(record, error);
    }
  }

  private releaseConsole(terminalConsole: PseudoTerminalConsole, record: ProcessRecord): void {
    if (this.platform === Resources.windowsPlatform)
      this.closeConsole(terminalConsole, record);
    terminalConsole.stopOutputWorkerAsync().catch((error: unknown) => this.report(record, error));
  }

  private async stopTerminalAsync(terminal: PseudoTerminal): Promise<boolean> {
    const running = this.running.get(terminal);
    if (Object.isUndefined(running))
      return true;
    const stop = this.endAsync([running], []);
    this.track(running.record.moduleId, stop.then(() => undefined));
    const endings = await stop;
    return !Object.isNull(endings) && endings.every(t => t.forced.length === 0 && Object.isUndefined(t.failure));
  }

  private spawn(program: string, launch: ProcessLaunch, workingFolder: string, environment: NodeJS.ProcessEnv): ChildProcessWithoutNullStreams {
    try {
      return spawn(launch.executable, [...launch.arguments], {
        cwd: workingFolder,
        env: environment,
        stdio: Resources.pipedOutput,
        windowsHide: true,
        detached: this.platform !== Resources.windowsPlatform,
        argv0: launch.programArgument,
        windowsVerbatimArguments: launch.isVerbatim
      });
    }
    catch (error) {
      throw new ProcessStartFailedException(program, new ExceptionOptions(error));
    }
  }

  private record(child: ChildProcessWithoutNullStreams, moduleId: string, program: string, executable: string, requested: number, created: number): ProcessRecord {
    try {
      return this.records.add(moduleId, Number(child.pid), program, executable, this.clock.boot, requested, created, this.clock.offset());
    }
    catch (error) {
      this.ender.release(Number(child.pid));
      child.kill(Resources.killSignal);
      throw error;
    }
  }

  private stopAsync(owned: OwnedProcess): Promise<void> {
    const running = this.running.get(owned);
    if (Object.isUndefined(running))
      return Promise.resolve();
    const stop = this.endAsync([running], []).then(() => undefined);
    this.track(running.record.moduleId, stop);
    return stop;
  }

  private async handleExitAsync(owned: OwnedProcess | PseudoTerminal, record: ProcessRecord, started: Date, isClean: boolean): Promise<void> {
    if (!this.running.delete(owned))
      return;
    this.unrenewed.delete(record);
    this.watch();
    try {
      const ended = await this.ender.endAfterExitAsync(record, isClean);
      if (ended instanceof KeptProgram)
        this.kept.set(ended, started);
      else
        this.finishAll(ended);
    }
    catch (error) {
      this.kept.set(new KeptProgram(record, []), started);
      this.report(record, error);
    }
    this.publish();
  }

  private async endAsync(running: readonly RunningProcess[], kept: readonly KeptProgram[]): Promise<readonly ProcessEnding[] | null> {
    if (running.length === 0 && kept.length === 0)
      return [];
    for (const [key, item] of [...this.running].filter(([, t]) => running.includes(t))) {
      this.running.delete(key);
      this.unrenewed.delete(item.record);
    }
    this.watch();
    for (const item of kept)
      this.kept.delete(item);
    this.publish();
    try {
      const endings = await this.ender.stopAsync(running, kept);
      this.finishAll(endings);
      return endings;
    }
    catch (error) {
      for (const record of [...running, ...kept].map(t => t.record))
        this.report(record, error);
      return null;
    }
    finally {
      await Promise.all(running.map(t => ProcessSignals.waitForAsync(t.exitTime, this.endMilliseconds)));
    }
  }

  private publish(): void {
    this.sequence++;
    for (const listener of [...this.listeners])
      listener();
  }

  private watch(): void {
    if (this.running.size > 0) {
      this.seeing ??= setInterval(() => this.markSeen(), this.seenMilliseconds).unref();
      return;
    }
    clearInterval(this.seeing);
    this.seeing = undefined;
  }

  private markSeen(): void {
    const records = [...this.running.values()].map(t => t.record);
    try {
      this.records.markSeen(records, this.clock.now(), this.clock.offset());
    }
    catch (error) {
      for (const record of records.filter(t => !this.unrenewed.has(t))) {
        this.unrenewed.add(record);
        this.report(record, error);
      }
    }
  }

  private finishAll(endings: readonly ProcessEnding[]): void {
    for (const ending of endings)
      this.finish(ending, Resources.formatProcessesForced(ending.forced));
  }

  private finish(ending: ProcessEnding, forced: string): void {
    if (!Object.isUndefined(ending.failure)) {
      this.report(ending.record, ending.failure);
      return;
    }
    this.records.remove(ending.record);
    if (ending.forced.length > 0)
      this.write(ending.record, forced);
    if (ending.remaining.length > 0)
      this.write(ending.record, Resources.formatProcessesRemaining(ending.remaining));
    if (ending.left.length > 0)
      this.write(ending.record, Resources.formatProcessesLeft(ending.left));
    if (!Object.isUndefined(ending.jobFailure))
      this.write(ending.record, Resources.formatJobsNotHungUp(inspect(ending.jobFailure)));
  }

  private adopt(processId: number | undefined): void {
    if (!Object.isUndefined(processId))
      this.ender.adopt(processId, true);
  }

  private claim(record: ProcessRecord): void {
    try {
      this.ender.claim(record);
    }
    catch (error) {
      this.report(record, error);
    }
  }

  private report(record: ProcessRecord, error: unknown): void {
    this.write(record, inspect(error));
  }

  private write(record: ProcessRecord, text: string): void {
    this.diagnostics.write(Resources.formatProcessDiagnostic(record.moduleId, record.program, record.processId, text));
  }

  private track(moduleId: string, work: Promise<void>): void {
    this.pending.set(work, moduleId);
    void work.finally(() => this.pending.delete(work));
  }
}
