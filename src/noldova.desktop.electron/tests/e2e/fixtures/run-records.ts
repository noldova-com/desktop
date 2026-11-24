/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import type { FullConfig } from "@playwright/test";

import { CleanupSteps } from "./cleanup-steps.ts";
import { EarlierRunProcessesKilledException } from "../exceptions/earlier-run-processes-killed.exception.ts";
import { ErrorCodeFixture } from "./error-code.fixture.ts";
import { ProcessRecord } from "./process-record.ts";
import { ProcessStartTimes } from "./process-start-times.ts";
import { RunProcessesKilledException } from "../exceptions/run-processes-killed.exception.ts";
import { TestRoots } from "./test-roots.ts";
import { UiRun } from "./ui-run.ts";

export interface IStoppedLeftovers {
  readonly own: readonly string[];
  readonly others: readonly string[];
  readonly endedRunFolders: readonly string[];
}

export class RunRecords {
  private static readonly FOLDER: string = "processes";
  private static readonly NO_SUCH_FILE: string = "ENOENT";

  public readonly folder: string;

  public constructor(outputDirectory: string) {
    this.folder = path.join(path.dirname(outputDirectory), RunRecords.FOLDER);
  }

  public static async setUpAsync(config: FullConfig): Promise<void> {
    TestRoots.forgetRunFolder();
    TestRoots.checkSocketPath(config.workers);
    const run = await UiRun.startAsync();
    const all = RunRecords.listOf(config);
    const stopped = await RunRecords.stopEndedRunsAsync(all, TestRoots.runBase);
    const undeleted = await TestRoots.deleteRemovedAsync(TestRoots.runBase);
    const unremovedRunFolders = (await CleanupSteps.collectFailuresAsync(stopped.endedRunFolders.map(t => () => TestRoots.removeRunFolderAsync(t))))
      .map(t => t instanceof Error ? t.message : String(t));
    if (stopped.others.length > 0)
      console.warn(`Processes of ended UI runs that other checkouts started still ran after their runners had ended, so they were killed:\n${stopped.others.join("\n")}`);
    if (undeleted.length > 0)
      console.warn(`Test folders that were renamed to be deleted are still there:\n${undeleted.join("\n")}`);
    if (unremovedRunFolders.length > 0)
      console.warn(`Ended runs' temporary folders are still there:\n${unremovedRunFolders.join("\n")}`);
    if (stopped.own.length > 0)
      throw new EarlierRunProcessesKilledException(stopped.own);
    for (const records of all)
      await records.recordOf(run).createAsync();
    await TestRoots.useRunFolderAsync(run);
  }

  public static async tearDownAsync(config: FullConfig): Promise<void> {
    const run = UiRun.readCurrent();
    const stopped: string[] = [];
    const failures = await CleanupSteps.collectFailuresAsync([
      ...RunRecords.listOf(config).map(t => async () => {
        stopped.push(...await t.recordOf(run).stopLeftoversAsync());
      }),
      async () => {
        const roots = await TestRoots.scanAsync(TestRoots.base);
        if (roots.unmarked.length > 0)
          console.warn(`These test folders have no readable run marker, which every test folder of this harness gets before it has its name, so whose they are is unknown and they are left alone:\n${roots.unmarked.join("\n")}`);
        if (roots.staging.length > 0)
          console.warn(`These folders that a UI worker began to create never got their run marker, so whose they are is unknown and they are left alone:\n${roots.staging.join("\n")}`);
        stopped.push(...await RunRecords.stopRootsAsync(roots.marked.filter(t => t.run.id === run.id).map(t => t.root), "of this run"));
      }
    ]);
    await TestRoots.removeOwnRunFolderAsync().catch((error: unknown) => console.warn(error instanceof Error ? error.message : String(error)));
    const killed = stopped.length === 0 ? null : new RunProcessesKilledException(stopped);
    if (failures.length > 0)
      throw new AggregateError(failures, [...failures.map(t => t instanceof Error ? t.message : String(t)), ...Object.isNull(killed) ? [] : [killed.message]].join("\n"));
    if (!Object.isNull(killed))
      throw killed;
  }

  public static async stopEndedRunsAsync(all: readonly RunRecords[], base: string = os.tmpdir()): Promise<IStoppedLeftovers> {
    const runs = (await Promise.all(all.map(t => t.listRunsAsync()))).flat();
    const roots = await TestRoots.scanAsync(base);
    const startTimes = await ProcessStartTimes.readAsync([...runs, ...roots.marked.map(t => t.run), ...roots.runFolders.map(t => t.run)].map(t => t.runner));
    const ended = roots.marked.filter(t => t.run.hasEnded(startTimes));
    const ownRoots = ended.filter(root => runs.some(t => t.id === root.run.id)).map(t => t.root);
    const otherRoots = ended.map(t => t.root).filter(t => !ownRoots.includes(t));
    const own: string[] = [];
    const others: string[] = [];
    CleanupSteps.throwFailures(await CleanupSteps.collectFailuresAsync([
      ...all.map(t => async () => {
        own.push(...await t.stopEndedAsync(startTimes));
      }),
      async () => {
        own.push(...await RunRecords.stopRootsAsync(ownRoots, "of this checkout's ended runs"));
      },
      async () => {
        others.push(...await RunRecords.stopRootsAsync(otherRoots, "of other checkouts' ended runs"));
      }
    ]));
    return { own, others, endedRunFolders: roots.runFolders.filter(t => t.run.hasEnded(startTimes)).map(t => t.root) };
  }

  public recordOf(run: UiRun): ProcessRecord {
    return new ProcessRecord(path.join(this.folder, run.id));
  }

  public async listRunsAsync(): Promise<UiRun[]> {
    const names = await readdir(this.folder).catch((error: unknown) => {
      if (ErrorCodeFixture.of(error) === RunRecords.NO_SUCH_FILE)
        return [];
      throw error;
    });
    return names.sort().map(t => UiRun.parse(t));
  }

  public async stopEndedAsync(startTimes: ProcessStartTimes): Promise<readonly string[]> {
    const stopped: string[] = [];
    for (const run of (await this.listRunsAsync()).filter(t => t.hasEnded(startTimes)))
      stopped.push(...await this.recordOf(run).stopLeftoversAsync());
    return stopped;
  }

  private static stopRootsAsync(roots: readonly string[], owner: string): Promise<readonly string[]> {
    return ProcessRecord.stopEntriesAsync(roots.map(t => ({ root: t, dataDirectory: TestRoots.dataDirectoryOf(t), processIds: [] })), `${roots.length} test folders ${owner}`, "they are");
  }

  private static listOf(config: FullConfig): RunRecords[] {
    return [...new Set(config.projects.map(t => t.outputDir))].map(t => new RunRecords(t));
  }
}
