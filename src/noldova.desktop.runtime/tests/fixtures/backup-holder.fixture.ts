/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessByStdio, spawn } from "node:child_process";
import { once } from "node:events";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import { BackupGuard } from "@noldova/desktop.runtime";

export class BackupHolderFixture implements AsyncDisposable {
  private static readonly HELD: string = "held";
  private static readonly START_TIMEOUT: number = 10_000;

  private readonly child: ChildProcessByStdio<Writable, Readable, null>;

  public readonly outcome: string;

  private constructor(child: ChildProcessByStdio<Writable, Readable, null>, outcome: string) {
    this.child = child;
    this.outcome = outcome;
  }

  public get isHeld(): boolean {
    return this.outcome === BackupHolderFixture.HELD;
  }

  public static async startAsync(folder: string): Promise<BackupHolderFixture> {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), folder], { stdio: ["pipe", "pipe", "inherit"], windowsHide: true });
    child.stdout.setEncoding("utf8");
    let timer: NodeJS.Timeout | undefined;
    try {
      const outcome = await Promise.race([
        once(child.stdout, "data").then(t => String(t[0]).trim()),
        once(child, "exit").then(t => `exited with ${String(t[0])}`),
        new Promise<string>(t => {
          timer = setTimeout(() => t("did not report in time"), BackupHolderFixture.START_TIMEOUT);
        })
      ]);
      return new BackupHolderFixture(child, outcome);
    }
    finally {
      clearTimeout(timer);
    }
  }

  public static async runAsync(folder: string): Promise<void> {
    let guard: BackupGuard;
    try {
      guard = await BackupGuard.holdAsync(folder);
    }
    catch (error) {
      process.stdout.write(`${String(error)}\n`);
      return;
    }
    process.stdout.write(`${BackupHolderFixture.HELD}\n`);
    process.stdin.on("end", () => guard.release());
    process.stdin.resume();
  }

  public async killAsync(): Promise<void> {
    const exited = once(this.child, "exit");
    this.child.kill("SIGKILL");
    await exited;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    if (Object.isNull(this.child.exitCode) && Object.isNull(this.child.signalCode))
      await this.killAsync();
  }
}

if (import.meta.main)
  await BackupHolderFixture.runAsync(process.argv[2] ?? String.empty);
