/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile, mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { CleanupSteps } from "./cleanup-steps.ts";
import { ErrorCodeFixture } from "./error-code.fixture.ts";
import { ProcessListFixture } from "./process-list.fixture.ts";
import { TestRoots } from "./test-roots.ts";

export interface IProcessRecordEntry {
  readonly root: string;
  readonly dataDirectory: string;
  readonly processIds: readonly number[];
}

export class ProcessRecord {
  private static readonly FILE_PREFIX: string = "worker-";
  private static readonly FILE_SUFFIX: string = ".jsonl";
  private static readonly LINE_SEPARATOR: string = "\n";
  private static readonly EXIT_TIMEOUT: number = 15_000;
  private static readonly NO_SUCH_PROCESS: string = "ESRCH";
  private static readonly NO_SUCH_FILE: string = "ENOENT";

  public readonly folder: string;

  public constructor(folder: string) {
    this.folder = folder;
  }

  public async createAsync(): Promise<void> {
    await mkdir(this.folder, { recursive: true });
  }

  public async appendAsync(workerIndex: number, entry: IProcessRecordEntry): Promise<void> {
    await appendFile(path.join(this.folder, `${ProcessRecord.FILE_PREFIX}${workerIndex}${ProcessRecord.FILE_SUFFIX}`), `${JSON.stringify(entry)}${ProcessRecord.LINE_SEPARATOR}`);
  }

  public async stopLeftoversAsync(): Promise<readonly string[]> {
    const entries = await this.readAsync();
    const stopped = await ProcessRecord.stopEntriesAsync(entries, `${entries.length} entries in ${this.folder}`, "it is");
    await rm(this.folder, { recursive: true, force: true });
    return stopped;
  }

  public static async stopEntriesAsync(entries: readonly IProcessRecordEntry[], described: string, kept: string): Promise<readonly string[]> {
    const running = entries.length === 0 ? new Map<number, string>() : await ProcessListFixture.readCommandLinesAsync();
    const stopped: string[] = [];
    const failures = await CleanupSteps.collectFailuresAsync(entries.map(entry => async () => {
      const owned = [...running].filter(([, line]) => line.includes(entry.dataDirectory));
      for (const [processId, line] of owned) {
        ProcessRecord.killIfRunning(processId);
        stopped.push(`${processId}, ${entry.processIds.includes(processId) ? "by its recorded id" : "found by its data directory"}: ${line}`);
      }
      const left = await ProcessListFixture.waitForExitAsync(owned.map(([t]) => t), ProcessRecord.EXIT_TIMEOUT);
      if (left.length > 0)
        throw new Error(`Processes ${left.join(", ")} still ran ${ProcessRecord.EXIT_TIMEOUT / 1000} s after they were killed, so ${entry.root} is kept.`);
      await TestRoots.removeAsync(entry.root);
    }));
    if (failures.length > 0)
      throw new AggregateError(failures, [
        `${failures.length} of the ${described} could not be cleaned up, so ${kept} kept.`,
        ...failures.map(t => t instanceof Error ? t.message : String(t)),
        stopped.length === 0 ? "No process was killed." : `These processes were killed:\n${stopped.join("\n")}`
      ].join("\n"));
    return stopped;
  }

  public static killIfRunning(processId: number): void {
    try {
      process.kill(processId, "SIGKILL");
    }
    catch (error) {
      if (ErrorCodeFixture.of(error) !== ProcessRecord.NO_SUCH_PROCESS)
        throw error;
    }
  }

  private async readAsync(): Promise<IProcessRecordEntry[]> {
    const files = await readdir(this.folder).catch((error: unknown) => {
      if (ErrorCodeFixture.of(error) === ProcessRecord.NO_SUCH_FILE)
        return [];
      throw error;
    });
    const entries = new Map<string, IProcessRecordEntry>();
    for (const file of files.sort())
      for (const line of (await readFile(path.join(this.folder, file), "utf8")).split(ProcessRecord.LINE_SEPARATOR).filter(t => t.length > 0)) {
        const reader = JsonReader.parse(line);
        const entry: IProcessRecordEntry = { root: reader.readString("root"), dataDirectory: reader.readString("dataDirectory"), processIds: ProcessRecord.readProcessIds(reader) };
        const known = entries.get(entry.dataDirectory)?.processIds ?? [];
        entries.set(entry.dataDirectory, { ...entry, processIds: [...new Set([...known, ...entry.processIds])] });
      }
    return [...entries.values()];
  }

  private static readProcessIds(reader: JsonReader): readonly number[] {
    const processIds = reader.readValue("processIds");
    return Array.isArray(processIds) ? processIds.filter(Object.isNumber) : [];
  }
}
