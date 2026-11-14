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
import { DataDirectory, DataDirectoryOwnedException, OwnershipLock } from "@noldova/desktop.runtime";

export class OwnerProcessFixture implements AsyncDisposable {
  private static readonly ACQUIRED: string = "acquired";
  private static readonly OWNED: string = "owned";
  private static readonly START_TIMEOUT: number = 10_000;

  private readonly child: ChildProcessByStdio<Writable, Readable, null>;

  public readonly outcome: string;

  private constructor(child: ChildProcessByStdio<Writable, Readable, null>, outcome: string) {
    this.child = child;
    this.outcome = outcome;
  }

  public get hasAcquired(): boolean {
    return this.outcome === OwnerProcessFixture.ACQUIRED;
  }

  public static async startAsync(root: string): Promise<OwnerProcessFixture> {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), root], { stdio: ["pipe", "pipe", "inherit"], windowsHide: true });
    child.stdout.setEncoding("utf8");
    let timer: NodeJS.Timeout | undefined;
    try {
      const outcome = await Promise.race([
        once(child.stdout, "data").then(t => String(t[0]).trim()),
        once(child, "exit").then(t => `exited with ${String(t[0])}`),
        new Promise<string>(t => {
          timer = setTimeout(() => t("did not report in time"), OwnerProcessFixture.START_TIMEOUT);
        })
      ]);
      return new OwnerProcessFixture(child, outcome);
    }
    finally {
      clearTimeout(timer);
    }
  }

  public static run(root: string): void {
    let lock: OwnershipLock;
    try {
      lock = OwnershipLock.acquire(new DataDirectory(root));
    }
    catch (error) {
      process.stdout.write(`${error instanceof DataDirectoryOwnedException ? OwnerProcessFixture.OWNED : String(error)}\n`);
      return;
    }
    process.stdout.write(`${OwnerProcessFixture.ACQUIRED}\n`);
    process.stdin.on("end", () => lock.release());
    process.stdin.resume();
  }

  public async stopAsync(): Promise<void> {
    const exited = once(this.child, "exit");
    this.child.stdin.end();
    await exited;
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
  OwnerProcessFixture.run(process.argv[2] ?? String.empty);
