/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProcessResult } from "../../src/models/processes/process-result.js";
import type { SmokeProcessFixture } from "./smoke-process.fixture.js";
import { SmokeRunnerFixture } from "./smoke-runner.fixture.js";

export type CopyRecordKind = "extraction" | "missing" | "text" | "folder";

export class AppImageCopyRunnerFixture extends SmokeRunnerFixture {
  public static readonly RECORD_TEXT: string = "not a copy record";
  public static readonly EXTRACTED_BYTES: number = 1_572_864;

  private static readonly PROGRAM_BYTES: number = 1_048_576;

  public records: readonly CopyRecordKind[] = ["extraction"];
  public keepsStartLog: boolean = false;
  public removesStartLog: boolean = false;
  public removesCopy: boolean = true;
  public extraction: string = String.empty;
  private readonly copies: string[] = [];

  public static formatRecord(logs: string, index: number): string {
    return path.join(logs, `copy-00000000-0000-0000-0000-00000000000${index + 1}.log`);
  }

  public override async startAsync(command: string, commandArguments: readonly string[], directory: string, log: string): Promise<SmokeProcessFixture> {
    const started = await super.startAsync(command, commandArguments, directory, log);
    const data = this.data ?? String.empty;
    const logs = path.join(data, "logs");
    this.extraction = path.join(path.dirname(data), "extraction");
    await mkdir(logs, { recursive: true });
    const startLog = path.join(logs, "start-00000000-0000-0000-0000-000000000000.log");
    if (this.keepsStartLog || this.removesStartLog)
      await writeFile(startLog, "launcher started\n");
    if (this.removesStartLog)
      started.onWaitForExitAsync = () => rm(startLog);
    for (const [index, kind] of this.records.entries())
      await this.writeRecordAsync(AppImageCopyRunnerFixture.formatRecord(logs, index), kind);
    return started;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv):
    Promise<ProcessResult> {
    const result = await super.captureAsync(command, commandArguments, directory, timeout, environment);
    if (this.removesCopy && !this.isRuntimeUp && !Object.isNull(this.data))
      for (const copy of this.copies.splice(0))
        await rm(copy, { recursive: true, force: true });
    return result;
  }

  private async writeRecordAsync(record: string, kind: CopyRecordKind): Promise<void> {
    this.copies.push(record);
    if (kind === "folder") {
      await mkdir(record);
      return;
    }
    if (kind === "text") {
      await writeFile(record, AppImageCopyRunnerFixture.RECORD_TEXT);
      return;
    }
    await writeFile(record, JSON.stringify({ extraction: this.extraction }));
    if (kind === "missing")
      return;
    this.copies.push(this.extraction);
    await mkdir(path.join(this.extraction, "usr", "lib"), { recursive: true });
    await writeFile(path.join(this.extraction, "AppRun"), Buffer.alloc(AppImageCopyRunnerFixture.PROGRAM_BYTES));
    await writeFile(path.join(this.extraction, "usr", "lib", "libapp.so"),
      Buffer.alloc(AppImageCopyRunnerFixture.EXTRACTED_BYTES - AppImageCopyRunnerFixture.PROGRAM_BYTES));
  }
}
