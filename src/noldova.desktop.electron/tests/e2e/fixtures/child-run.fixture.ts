/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";

import "@noldova/context.core";

import { ChildRunNotKilledException } from "../exceptions/child-run-not-killed.exception.ts";
import { ChildRunNotStartedException } from "../exceptions/child-run-not-started.exception.ts";
import { CleanupSteps } from "./cleanup-steps.ts";
import { ProcessListFixture } from "./process-list.fixture.ts";
import { ProcessRecord } from "./process-record.ts";
import { ProcessesNotKilledException } from "../exceptions/processes-not-killed.exception.ts";
import { RunRecords } from "./run-records.ts";
import { WaitFixture } from "./wait.fixture.ts";

export class ChildRunFixture {
  public static readonly HUNG: string = "The child run's workflow hangs.";
  public static readonly HELD: string = "The child run holds Noldova Desktop Sample.";
  public static readonly LOST_FILE: string = "lost.json";
  public static readonly HUNG_FILE: string = "hung.json";
  public static readonly HELD_FILE: string = "held.json";
  public static readonly OUTLIVING_FILE: string = "outliving.json";
  public static readonly RELEASE_FILE: string = "release";
  public static readonly TEMPORARY_FILE: string = "temporary.txt";

  private static readonly CONFIG: string = path.resolve("src", "noldova.desktop.electron", "tests", "e2e", "fixtures", "child-run", "playwright.config.ts");
  private static readonly CLI: string = path.resolve("node_modules", "playwright", "cli.js");
  private static readonly RESULTS_SUFFIX: string = "-results";
  private static readonly END_INTERVAL: number = 100;
  private static readonly KILL_TIMEOUT: number = 15_000;

  private readonly child: ChildProcessWithoutNullStreams;
  private readonly chunks: string[] = [];
  private code: number | null | undefined;

  public readonly folder: string;
  public readonly name: string;

  private constructor(folder: string, name: string, child: ChildProcessWithoutNullStreams) {
    this.folder = folder;
    this.name = name;
    this.child = child;
    child.stdout.on("data", (data: Buffer) => this.chunks.push(data.toString()));
    child.stderr.on("data", (data: Buffer) => this.chunks.push(data.toString()));
    child.once("close", (code: number | null) => {
      this.code = code;
    });
  }

  public get output(): string {
    return this.chunks.join(String.empty);
  }

  public get resultsFolder(): string {
    return path.join(this.folder, `${this.name}${ChildRunFixture.RESULTS_SUFFIX}`);
  }

  public get hasEnded(): boolean {
    return !Object.isUndefined(this.code);
  }

  public get processId(): number {
    if (Object.isUndefined(this.child.pid))
      throw new ChildRunNotStartedException(this.name);
    return this.child.pid;
  }

  public static async startAsync(folder: string, name: string, title: string): Promise<ChildRunFixture> {
    const child = spawn(process.execPath, [ChildRunFixture.CLI, "test", "--config", ChildRunFixture.CONFIG,
      "--output", path.join(folder, `${name}${ChildRunFixture.RESULTS_SUFFIX}`), "--grep", title], { cwd: process.cwd(), windowsHide: true, detached: process.platform !== "win32" });
    const run = new ChildRunFixture(folder, name, child);
    await once(child, "spawn");
    return run;
  }

  public async endAsync(limit: number, giveUp: () => boolean = () => false): Promise<number | null> {
    await WaitFixture.holdsWithinAsync(() => this.hasEnded || giveUp(), limit, ChildRunFixture.END_INTERVAL);
    if (!Object.isUndefined(this.code))
      return this.code;
    const isGivenUp = giveUp();

    let started: number[] = [];
    let cleanup = String.empty;
    const failures = await CleanupSteps.collectFailuresAsync([
      async () => {
        started = await ProcessListFixture.readDescendantsAsync(this.processId);
      },
      async () => ProcessRecord.killIfRunning(process.platform === "win32" ? this.processId : -this.processId),
      async () => CleanupSteps.throwFailures(await CleanupSteps.collectFailuresAsync(started.map(t => async () => ProcessRecord.killIfRunning(t)))),
      async () => {
        if (!await WaitFixture.holdsWithinAsync(() => this.hasEnded, ChildRunFixture.KILL_TIMEOUT, ChildRunFixture.END_INTERVAL))
          throw new ChildRunNotKilledException(ChildRunFixture.KILL_TIMEOUT / 1000);
      },
      async () => {
        const left = await ProcessListFixture.waitForExitAsync(started, ChildRunFixture.KILL_TIMEOUT);
        if (left.length > 0)
          throw new ProcessesNotKilledException(left, ChildRunFixture.KILL_TIMEOUT / 1000, null);
      },
      async () => {
        const leftovers = await RunRecords.stopEndedRunsAsync([new RunRecords(this.resultsFolder)]);
        const stopped = [...leftovers.own, ...leftovers.others];
        cleanup = stopped.length === 0 ? "The cleanup of ended runs stopped no process." : `The cleanup of ended runs stopped:\n${stopped.join("\n")}`;
      }
    ]);
    throw new AggregateError(failures, [
      `The child run ${this.name} ${isGivenUp ? "was given up on" : `did not end within ${limit / 1000} s`}, so it was killed with the ${started.length} processes it had started: ${started.join(", ") || "none"}.`,
      ...failures.map(t => t instanceof Error ? t.message : String(t)),
      ...cleanup === String.empty ? [] : [cleanup],
      `Its output:\n${this.output}`
    ].join("\n"));
  }
}
