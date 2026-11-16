/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFile } from "node:fs/promises";

import type { IProcessStarter } from "@noldova/desktop.runtime";

export class FinishedStarterFixture implements IProcessStarter {
  private readonly processId: number;
  private readonly errors: string;

  public readonly processIds: number[] = [];

  private constructor(processId: number, errors: string) {
    this.processId = processId;
    this.errors = errors;
  }

  public static async runAsync(script: string): Promise<FinishedStarterFixture> {
    const child = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "ignore", "pipe"] });
    const chunks: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    await once(child, "close");
    return new FinishedStarterFixture(Number(child.pid), Buffer.concat(chunks).toString("utf8"));
  }

  public async startAsync(_executable: string, _launchArguments: readonly string[], _environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
    await writeFile(errorFile, this.errors, { flag: "a" });
    this.processIds.push(this.processId);
    return this.processId;
  }
}
