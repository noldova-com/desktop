/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";

import { NoJobForExitCodeException } from "../../exceptions/no-job-for-exit-code.exception.js";
import type { IProcessEnder } from "../../interfaces/i-process-ender.js";
import type { IProcessTableReader } from "../../interfaces/i-process-table.reader.js";
import type { IWindowsProcessApi } from "../../interfaces/i-windows-process-api.js";
import { KeptProgram } from "../../models/kept-program.js";
import { ProcessEnding } from "../../models/process-ending.js";
import type { ProcessRecord } from "../../models/process-record.js";
import type { ProcessSettings } from "../../models/process-settings.js";
import type { ProcessTable } from "../../models/process-table.js";
import type { ProcessTableEntry } from "../../models/process-table-entry.js";
import type { RunningProcess } from "../../models/running-process.js";
import type { ProcessClock } from "./process-clock.js";
import { ProcessSignals } from "./process-signals.js";
import { WindowsProcessJob } from "./windows-process-job.js";
import type { WindowsProcessKiller } from "./windows-process-killer.js";

export class WindowsProcessEnder implements IProcessEnder {
  private readonly api: IWindowsProcessApi;
  private readonly adopted: Map<number, WindowsProcessJob> = new Map();
  private readonly unadopted: Map<number, unknown> = new Map();
  private readonly jobs: Map<ProcessRecord, WindowsProcessJob> = new Map();
  private readonly reader: IProcessTableReader;
  private readonly killer: WindowsProcessKiller;
  private readonly settings: ProcessSettings;
  private readonly clock: ProcessClock;

  public constructor(api: IWindowsProcessApi, reader: IProcessTableReader, killer: WindowsProcessKiller, settings: ProcessSettings, clock: ProcessClock) {
    this.api = api;
    this.reader = reader;
    this.killer = killer;
    this.settings = settings;
    this.clock = clock;
  }

  public adopt(processId: number, holdsDescendants: boolean): void {
    try {
      this.adopted.set(processId, WindowsProcessJob.open(this.api, processId, holdsDescendants));
    }
    catch (error) {
      this.unadopted.set(processId, error);
    }
  }

  public claim(record: ProcessRecord): void {
    const job = this.adopted.get(record.processId);
    const failure = this.unadopted.get(record.processId);
    this.forget(record.processId);
    if (Object.isUndefined(job))
      throw failure;
    this.jobs.set(record, job);
  }

  public release(processId: number): void {
    this.adopted.get(processId)?.close();
    this.forget(processId);
  }

  public async readExitCodeAsync(processId: number): Promise<number> {
    const job = [...this.jobs].find(([t]) => t.processId === processId)?.[1];
    if (Object.isUndefined(job))
      throw new NoJobForExitCodeException(processId);
    return await job.readExitCodeAsync(this.settings.endMilliseconds);
  }

  public async stopAsync(running: readonly RunningProcess[], kept: readonly KeptProgram[]): Promise<readonly ProcessEnding[]> {
    for (const item of running)
      item.beginEnd();
    try {
      const exits = await Promise.all(running.map(async t => [t.record, await ProcessSignals.waitForAsync(t.exitTime, this.settings.graceMilliseconds)] as const));
      const table = await this.reader.readAsync();
      return await this.killTreesAsync([
        ...exits.map(([record, exited]) => [record, this.addMembers(table, record, this.findTree(table, record, exited)), []] as const),
        ...kept.map(t => [t.record, this.addMembers(table, t.record, t.members.filter(u => table.includes(u))), []] as const)
      ]);
    }
    finally {
      for (const record of [...running, ...kept].map(t => t.record))
        this.close(record);
    }
  }

  public async endAfterExitAsync(record: ProcessRecord, isClean: boolean): Promise<readonly ProcessEnding[] | KeptProgram> {
    const job = this.jobs.get(record);
    const members = Object.isUndefined(job) || job.listProcessIds().length === 0 ? [] : this.addMembers(await this.reader.readAsync(), record, []);
    if (members.length === 0) {
      this.close(record);
      return [new ProcessEnding(record)];
    }
    if (isClean)
      return new KeptProgram(record, members);
    try {
      return await this.killTreesAsync([[record, members, []]]);
    }
    finally {
      this.close(record);
    }
  }

  public async endLeftoversAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    const table = await this.reader.readAsync();
    return await this.killTreesAsync(records.map(t => WindowsProcessEnder.findLeftovers(table, t)));
  }

  private static findLeftovers(table: ProcessTable, record: ProcessRecord): readonly [ProcessRecord, readonly ProcessTableEntry[], readonly number[]] {
    const holder = table.find(record.processId);
    if (!Object.isUndefined(holder) && record.isStartOf(holder) && WindowsProcessEnder.isRunBy(holder, record))
      return [record, table.findTree(holder), []];
    const before = holder?.started ?? Number.POSITIVE_INFINITY;
    const orphans = table.findOrphans(record, record.seen, before);
    return [record, orphans, table.findOrphans(record, Number.POSITIVE_INFINITY, before).filter(t => !orphans.includes(t)).map(t => t.processId)];
  }

  private static isRunBy(leader: ProcessTableEntry, record: ProcessRecord): boolean {
    return !Object.isNull(leader.executable) && path.win32.normalize(leader.executable).toLowerCase() === path.win32.normalize(record.executable).toLowerCase();
  }

  private addMembers(table: ProcessTable, record: ProcessRecord, tree: readonly ProcessTableEntry[]): readonly ProcessTableEntry[] {
    const members = this.jobs.get(record)?.listProcessIds() ?? [];
    return [...tree, ...table.entries.filter(t => members.includes(t.processId) && !tree.some(u => u.processId === t.processId))];
  }

  private forget(processId: number): void {
    this.adopted.delete(processId);
    this.unadopted.delete(processId);
  }

  private close(record: ProcessRecord): void {
    this.jobs.get(record)?.close();
    this.jobs.delete(record);
  }

  private findTree(table: ProcessTable, record: ProcessRecord, exited: number | undefined): readonly ProcessTableEntry[] {
    const leader = Object.isUndefined(exited) ? table.findLeader(record) : undefined;
    return Object.isUndefined(leader) ? table.findOrphans(record, exited ?? this.clock.now()) : table.findTree(leader);
  }

  private async killTreesAsync(trees: readonly (readonly [ProcessRecord, readonly ProcessTableEntry[], readonly number[]])[]): Promise<readonly ProcessEnding[]> {
    const targets = trees.flatMap(([, t]) => t);
    if (targets.length === 0)
      return trees.map(([record, , left]) => new ProcessEnding(record, [], [], left));
    const first = await this.killer.killAsync(targets, this.settings.endMilliseconds, true);
    const until = this.clock.now();
    const grown = trees.map(([record, tree, left]) => [record, tree, first.table.findLateChildren(tree.filter(t => !first.replaced.includes(t.processId)), until), left] as const);
    const late = grown.flatMap(([, , t]) => t);
    const second = late.length === 0 ? undefined : await this.killer.killAsync(late, this.settings.endMilliseconds, false);
    const killed = [...first.killed, ...second?.killed ?? []];
    const running = [...first.running, ...second?.running ?? []];
    return grown.map(([record, tree, children, left]) => {
      const processIds = [...tree, ...children].map(t => t.processId);
      return new ProcessEnding(record, processIds.filter(t => killed.includes(t)), processIds.filter(t => running.includes(t)), left);
    });
  }
}
