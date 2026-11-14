/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IProcessEnder } from "../../interfaces/i-process-ender.js";
import type { IProcessTableReader } from "../../interfaces/i-process-table.reader.js";
import { KeptProgram } from "../../models/kept-program.js";
import { ProcessEnding } from "../../models/process-ending.js";
import type { ProcessRecord } from "../../models/process-record.js";
import type { ProcessSettings } from "../../models/process-settings.js";
import { ProcessTable } from "../../models/process-table.js";
import type { ProcessTableEntry } from "../../models/process-table-entry.js";
import type { RunningProcess } from "../../models/running-process.js";
import { Resources } from "../../resources.js";
import { ProcessSignals } from "./process-signals.js";

export class PosixProcessEnder implements IProcessEnder {
  private readonly reader: IProcessTableReader;
  private readonly settings: ProcessSettings;

  public constructor(reader: IProcessTableReader, settings: ProcessSettings) {
    this.reader = reader;
    this.settings = settings;
  }

  public adopt(): void {
  }

  public claim(): void {
  }

  public release(): void {
  }

  public readExitCodeAsync(): Promise<number | undefined> {
    return Promise.resolve(undefined);
  }

  public async stopAsync(running: readonly RunningProcess[], kept: readonly KeptProgram[]): Promise<readonly ProcessEnding[]> {
    const table = kept.length === 0 ? new ProcessTable([]) : await this.reader.readAsync();
    const claimed = kept.filter(t => t.members.some(u => table.includes(u)));
    const left = kept.filter(t => !claimed.includes(t)).map(t => PosixProcessEnder.leave(table, t.record));
    const shells = running.filter(t => t.signal === Resources.hangupSignal).map(t => t.record);
    const jobs = await this.listJobsAsync(shells);
    for (const item of running)
      item.beginEnd();
    const targets = [...running.map(t => [t.record, t.signal] as const), ...claimed.map(t => [t.record, Resources.terminateSignal] as const)];
    const endings = await this.endGroupsAsync(targets, new Map(running.map(t => [t.record, t.exitTime])));
    return [...await this.hangUpJobsAsync(endings, jobs), ...left];
  }

  public async endAfterExitAsync(record: ProcessRecord, isClean: boolean): Promise<readonly ProcessEnding[] | KeptProgram> {
    if (!ProcessSignals.isRunning(-record.processId))
      return [new ProcessEnding(record)];
    if (!isClean)
      return await this.endGroupsAsync([[record, Resources.terminateSignal]], new Map([[record, Promise.resolve()]]));
    return new KeptProgram(record, (await this.reader.readAsync()).listGroup(record.processId));
  }

  public async endLeftoversAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    if (records.every(t => !ProcessSignals.isRunning(-t.processId) && !ProcessSignals.isRunning(t.processId)))
      return records.map(t => new ProcessEnding(t));

    const table = await this.reader.readAsync();
    const claimed = records.filter(t => Object.isUndefined(table.find(t.processId))
      ? table.listGroup(t.processId).some(u => t.isSeenWith(u))
      : !Object.isUndefined(table.findLeader(t)));
    const others = records.filter(t => !claimed.includes(t)).map(t => Object.isUndefined(table.find(t.processId)) ? PosixProcessEnder.leave(table, t) : new ProcessEnding(t));
    return [...await this.killGroupsAsync(claimed, table), ...others];
  }

  private static findJobs(table: ProcessTable, shell: ProcessRecord): readonly ProcessTableEntry[] {
    const leader = table.findLeader(shell);
    if (Object.isUndefined(leader) || leader.groupId !== shell.processId)
      return [];
    const groups = table.entries
      .filter(t => t.groupId !== shell.processId && (t.parentId === shell.processId || leader.terminal !== 0 && t.terminal === leader.terminal))
      .map(t => t.groupId);
    return table.entries.filter(t => groups.some(u => u === t.groupId));
  }

  private static hangUp(table: ProcessTable, jobs: readonly ProcessTableEntry[]): unknown {
    const failures: unknown[] = [];
    for (const group of new Set(jobs.filter(t => table.includes(t)).map(t => Number(t.groupId)))) {
      try {
        ProcessSignals.send(-group, Resources.hangupSignal);
      }
      catch (error) {
        failures.push(error);
      }
    }
    return failures[0];
  }

  private static isEnded(record: ProcessRecord, ungrouped: readonly ProcessRecord[]): boolean {
    return !ProcessSignals.isRunning(-record.processId) && !(ungrouped.includes(record) && ProcessSignals.isRunning(record.processId));
  }

  private static confirmRefusals(refusals: readonly ProcessEnding[], table: ProcessTable, failure: unknown): readonly ProcessEnding[] {
    return refusals.map(t => !Object.isUndefined(failure) || PosixProcessEnder.holdsLiveProcess(table, t.record) ? t : new ProcessEnding(t.record));
  }

  private static holdsLiveProcess(table: ProcessTable, record: ProcessRecord): boolean {
    return [table.findLeader(record), ...table.listGroup(record.processId)].some(t => !Object.isUndefined(t) && !t.isZombie);
  }

  private static isUngrouped(table: ProcessTable, record: ProcessRecord): boolean {
    const leader = table.findLeader(record);
    return !Object.isUndefined(leader) && leader.groupId !== record.processId;
  }

  private static leave(table: ProcessTable, record: ProcessRecord): ProcessEnding {
    return new ProcessEnding(record, [], [], table.listGroup(record.processId).map(t => t.processId));
  }

  private static signal(targets: readonly (readonly [ProcessRecord, NodeJS.Signals])[], ungrouped: readonly ProcessRecord[]): readonly ProcessEnding[] {
    const failures: ProcessEnding[] = [];
    for (const [record, signal] of targets) {
      try {
        ProcessSignals.send(ungrouped.includes(record) ? record.processId : -record.processId, signal);
      }
      catch (error) {
        failures.push(new ProcessEnding(record, [], [], [], error));
      }
    }
    return failures;
  }

  private async listJobsAsync(shells: readonly ProcessRecord[]): Promise<readonly [ReadonlyMap<ProcessRecord, readonly ProcessTableEntry[]>, unknown]> {
    if (shells.length === 0)
      return [new Map(), undefined];
    const [table, failure] = await this.tryReadAsync();
    return [new Map(shells.map(t => [t, PosixProcessEnder.findJobs(table, t)] as const)), failure];
  }

  private async hangUpJobsAsync(endings: readonly ProcessEnding[], [jobs, listFailure]: readonly [ReadonlyMap<ProcessRecord, readonly ProcessTableEntry[]>, unknown]): Promise<readonly ProcessEnding[]> {
    const [table, checkFailure] = [...jobs.values()].some(t => t.length > 0) ? await this.tryReadAsync() : [new ProcessTable([]), undefined];
    return endings.map(t => {
      const members = jobs.get(t.record);
      if (Object.isUndefined(members) || !Object.isUndefined(t.failure))
        return t;
      const failure = listFailure ?? checkFailure ?? PosixProcessEnder.hangUp(table, members);
      return Object.isUndefined(failure) ? t : new ProcessEnding(t.record, t.forced, t.remaining, t.left, undefined, failure);
    });
  }

  private async tryReadAsync(): Promise<readonly [ProcessTable, unknown]> {
    try {
      return [await this.reader.readAsync(), undefined];
    }
    catch (error) {
      return [new ProcessTable([]), error];
    }
  }

  private async findUngroupedAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessRecord[]> {
    const alone = records.filter(t => !ProcessSignals.isRunning(-t.processId) && ProcessSignals.isRunning(t.processId));
    if (alone.length === 0)
      return [];
    const table = await this.reader.readAsync();
    return alone.filter(t => PosixProcessEnder.isUngrouped(table, t));
  }

  private async endGroupsAsync(targets: readonly (readonly [ProcessRecord, NodeJS.Signals])[], exits: ReadonlyMap<ProcessRecord, Promise<unknown>>): Promise<readonly ProcessEnding[]> {
    const ungrouped = await this.findUngroupedAsync(targets.map(([t]) => t));
    const first = PosixProcessEnder.signal(targets, ungrouped);
    const refused = first.filter(t => ProcessSignals.isRefused(t.failure) && exits.has(t.record));
    const settled = new Map<ProcessRecord, ProcessEnding | null>();
    const exited = new Set<ProcessRecord>();
    for (const [record, exit] of exits)
      void exit.then(() => exited.add(record));
    const isGone = (record: ProcessRecord): boolean => ungrouped.includes(record) && exited.has(record);
    const settle = (record: ProcessRecord): void => {
      settled.set(record, isGone(record) ? null : PosixProcessEnder.signal(targets.filter(([t]) => t === record), ungrouped)[0] ?? null);
    };
    let isSettling = true;
    for (const ending of refused)
      void exits.get(ending.record)?.then(() => {
        if (isSettling)
          settle(ending.record);
      });
    const signalled = (): readonly ProcessRecord[] => targets.map(([t]) => t).filter(t => !first.some(u => u.record === t) || Object.isNull(settled.get(t)));
    const isOver = (): boolean => refused.every(t => settled.has(t.record)) && signalled().every(t => isGone(t) || PosixProcessEnder.isEnded(t, ungrouped));
    const early = Math.floor(this.settings.graceMilliseconds / Resources.hangupAgainDivisor);
    let hasEnded = await ProcessSignals.waitAsync(isOver, early);
    if (!hasEnded) {
      const programs = signalled().filter(t => !exited.has(t) && !PosixProcessEnder.isEnded(t, ungrouped) && targets.some(([u, v]) => u === t && v === Resources.hangupSignal));
      PosixProcessEnder.signal(programs.map(t => [t, Resources.hangupSignal] as const), programs);
      hasEnded = await ProcessSignals.waitAsync(isOver, this.settings.graceMilliseconds - early);
    }
    isSettling = false;
    for (const ending of refused.filter(t => !settled.has(t.record)))
      settle(ending.record);
    const failures = first.filter(t => !refused.includes(t));
    const refusals = [...settled.values()].flatMap(t => Object.isNull(t) ? [] : [t]);
    if (hasEnded)
      return [...signalled().map(t => new ProcessEnding(t)), ...failures, ...await this.confirmRefusalsAsync(refusals)];
    const table = await this.reader.readAsync();
    const gone = signalled().filter(isGone);
    return [...gone.map(t => new ProcessEnding(t)), ...await this.killGroupsAsync(signalled().filter(t => !gone.includes(t)), table), ...failures,
      ...PosixProcessEnder.confirmRefusals(refusals, table, undefined)];
  }

  private async confirmRefusalsAsync(refusals: readonly ProcessEnding[]): Promise<readonly ProcessEnding[]> {
    if (refusals.length === 0)
      return [];
    const [table, failure] = await this.tryReadAsync();
    return PosixProcessEnder.confirmRefusals(refusals, table, failure);
  }

  private async killGroupsAsync(records: readonly ProcessRecord[], table: ProcessTable): Promise<readonly ProcessEnding[]> {
    const ungrouped = records.filter(t => PosixProcessEnder.isUngrouped(table, t));
    const targets = records.map(t => {
      const members = table.listGroup(t.processId).map(u => u.processId);
      return new ProcessEnding(t, ungrouped.includes(t) ? [t.processId, ...members] : members);
    });
    const failures = PosixProcessEnder.signal(targets.filter(t => t.forced.length > 0).map(t => [t.record, Resources.killSignal] as const), ungrouped);
    const killed = targets.filter(t => t.forced.length > 0 && !failures.some(u => u.record === t.record));
    await ProcessSignals.waitAsync(() => killed.every(t => PosixProcessEnder.isEnded(t.record, ungrouped)), this.settings.endMilliseconds);
    return [
      ...targets.filter(t => !failures.some(u => u.record === t.record)).map(t => new ProcessEnding(t.record, t.forced, t.forced.filter(u => ProcessSignals.isRunning(u)))),
      ...failures
    ];
  }
}
