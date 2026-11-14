/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";

import { CoverageEnvironmentFixture } from "./coverage-environment.fixture.js";

export class ProgramRunFixture {
  public readonly exitCode: number | null;
  public readonly output: string;

  private constructor(exitCode: number | null, output: string) {
    this.exitCode = exitCode;
    this.output = output;
  }

  public static async runAsync(module: string, commandArguments: readonly string[], folder: string): Promise<ProgramRunFixture> {
    const child = spawn(process.execPath, [fileURLToPath(module), ...commandArguments], {
      cwd: folder, env: CoverageEnvironmentFixture.forChild(process.env), stdio: ["ignore", "pipe", "pipe"], windowsHide: true
    });
    let output = String.empty;
    child.stdout.setEncoding("utf8").on("data", (t: string) => output += t);
    child.stderr.setEncoding("utf8").on("data", (t: string) => output += t);
    const [exitCode] = await once(child, "close");
    return new ProgramRunFixture(Object.isNumber(exitCode) ? exitCode : null, output.replaceAll("\r\n", "\n"));
  }
}
