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
  private static readonly LOADED: string = "loaded";

  private readonly child: ChildProcessByStdio<Writable, Readable, null>;
  private state: string;

  private constructor(child: ChildProcessByStdio<Writable, Readable, null>, state: string) {
    this.child = child;
    this.state = state;
  }

  public get outcome(): string {
    return this.state;
  }

  public get hasAcquired(): boolean {
    return this.state === OwnerProcessFixture.ACQUIRED;
  }

  public static async startAsync(root: string): Promise<OwnerProcessFixture> {
    const owner = await OwnerProcessFixture.loadAsync(root);
    await owner.attemptAsync();
    return owner;
  }

  public static async loadAsync(root: string): Promise<OwnerProcessFixture> {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), root], { stdio: ["pipe", "pipe", "inherit"], windowsHide: true });
    child.stdout.setEncoding("utf8");
    return new OwnerProcessFixture(child, await OwnerProcessFixture.readAsync(child));
  }

  public static run(root: string): void {
    process.stdin.once("data", () => OwnerProcessFixture.attempt(root));
    process.stdout.write(`${OwnerProcessFixture.LOADED}\n`);
  }

  public async attemptAsync(): Promise<void> {
    if (this.state !== OwnerProcessFixture.LOADED)
      return;

    const report = OwnerProcessFixture.readAsync(this.child);
    this.child.stdin.write("\n");
    this.state = await report;
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

  private static attempt(root: string): void {
    let lock: OwnershipLock;
    try {
      lock = OwnershipLock.acquire(new DataDirectory(root));
    }
    catch (error) {
      process.stdout.write(`${error instanceof DataDirectoryOwnedException ? OwnerProcessFixture.OWNED : String(error)}\n`);
      process.stdin.destroy();
      return;
    }
    process.stdout.write(`${OwnerProcessFixture.ACQUIRED}\n`);
    process.stdin.on("end", () => lock.release());
  }

  private static readAsync(child: ChildProcessByStdio<Writable, Readable, null>): Promise<string> {
    return Promise.race([
      once(child.stdout, "data").then(t => String(t[0]).trim()),
      once(child, "close").then(t => `exited with ${String(t[0])}`)
    ]);
  }
}

if (import.meta.main)
  OwnerProcessFixture.run(process.argv[2] ?? String.empty);
