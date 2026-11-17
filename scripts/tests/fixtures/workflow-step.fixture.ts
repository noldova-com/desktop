/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export class WorkflowStepFixture {
  private static readonly WORKFLOWS: string = path.resolve(import.meta.dirname, "..", "..", "..", ".github", "workflows");
  private static readonly RUN: string = "        run: |";
  private static readonly INDENT: string = " ".repeat(10);
  private static readonly BASH: string = process.platform === "win32" ? path.join(process.env["ProgramFiles"] ?? "C:\\Program Files", "Git", "bin", "bash.exe") : "/bin/bash";

  public static readRun(workflow: string, step: string): string {
    const lines = readFileSync(path.join(WorkflowStepFixture.WORKFLOWS, workflow), "utf8").split(/\r?\n/);
    const start = lines.indexOf(WorkflowStepFixture.RUN, lines.indexOf(`      - name: ${step}`)) + 1;
    const end = lines.findIndex((t, index) => index >= start && t.length > 0 && !t.startsWith(WorkflowStepFixture.INDENT));
    return lines.slice(start, end).map(t => t.slice(WorkflowStepFixture.INDENT.length)).join("\n");
  }

  public static async runAsync(text: string, folder: string, bin: string, environment: Readonly<Record<string, string>>, isPathKept: boolean = true): Promise<{ status: number | null, output: string }> {
    const step = path.join(folder, "step.sh");
    await writeFile(step, text);
    const pathKey = Object.keys(process.env).find(t => t.toUpperCase() === "PATH") ?? "PATH";
    const searched = isPathKept ? `${bin}${path.delimiter}${process.env[pathKey] ?? ""}` : bin;
    const result = spawnSync(WorkflowStepFixture.BASH, ["--noprofile", "--norc", "-eo", "pipefail", step], { cwd: folder, encoding: "utf8",
      env: { ...process.env, [pathKey]: searched, RUNNER_TEMP: folder, ...environment } });
    return { status: result.status, output: result.stdout };
  }
}
