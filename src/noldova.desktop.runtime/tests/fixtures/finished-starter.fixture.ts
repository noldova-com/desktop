/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { once } from "node:events";
import { writeFile } from "node:fs/promises";

import type { IProcessStarter } from "@noldova/desktop.runtime";

export class FinishedStarterFixture implements IProcessStarter {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly chunks: Buffer[] = [];

  public readonly processIds: number[] = [];

  private constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child;
    child.stderr.on("data", (chunk: Buffer) => this.chunks.push(chunk));
  }

  public static async prepareAsync(delay: number, reason: string): Promise<FinishedStarterFixture> {
    const script = `setTimeout(() => {
      process.stdin.on("end", () => { console.error(${JSON.stringify(reason)}); process.exit(1); }).resume();
      process.stdout.write("ready");
    }, ${String(delay)});`;
    const child = spawn(process.execPath, ["-e", script]);
    const starter = new FinishedStarterFixture(child);
    await once(child.stdout, "data");
    return starter;
  }

  public async startAsync(_executable: string, _launchArguments: readonly string[], _environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
    const closed = once(this.child, "close");
    this.child.stdin.end();
    await closed;
    await writeFile(errorFile, Buffer.concat(this.chunks).toString("utf8"), { flag: "a" });
    this.processIds.push(Number(this.child.pid));
    return Number(this.child.pid);
  }
}
