/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Resources } from "./resources.ts";

export class NpmCi {
  public static run(npm: string, commandArguments: readonly string[], root: string, report: (text: string) => void,
    wait: (milliseconds: number) => void = NpmCi.sleep): number {
    const first = NpmCi.attempt(npm, commandArguments, root);
    if (first.status === Resources.successExitCode || !NpmCi.isStalledRead(first.log))
      return first.status;

    report(Resources.npmCiDropped(first.log.split(/\r?\n/).filter(t => Resources.npmCiRequestPattern.test(t)).slice(-Resources.npmCiRequestLines)));
    wait(Resources.npmCiRetryPause);
    return NpmCi.attempt(npm, commandArguments, root).status;
  }

  public static isStalledRead(log: string): boolean {
    return Resources.npmCiErrorCodePattern.test(log) && Resources.npmCiReadPattern.test(log);
  }

  private static sleep(milliseconds: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
  }

  private static attempt(npm: string, commandArguments: readonly string[], root: string): { status: number, log: string } {
    const logs = mkdtempSync(path.join(tmpdir(), Resources.npmCiLogsPrefix));
    const status = spawnSync(process.execPath, [npm, ...commandArguments], { cwd: root, stdio: Resources.buildStdio,
      env: { ...process.env, [Resources.npmCiLogsVariable]: logs } }).status ?? Resources.failedExitCode;
    return { status, log: readdirSync(logs).sort().map(t => readFileSync(path.join(logs, t), "utf8")).join(Resources.lineEnd) };
  }
}
