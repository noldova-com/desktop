/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { realpathSync } from "node:fs";
import path from "node:path";

import { ProcessRunner } from "../src/noldova.desktop.build/src/services/processes/process-runner.ts";
import { Resources } from "./resources.ts";

export class UiWorkflowsCi {
  public static async runAsync(root: string, runner: ProcessRunner, commandArguments: readonly string[]): Promise<number> {
    const script = [path.join(root, ...Resources.uiWorkflowsCiScript), ...commandArguments];
    const exitCode = process.platform === "linux"
      ? await runner.runAsync(Resources.uiWorkflowsCiSessionBus, [...Resources.uiWorkflowsCiSessionBusArguments, Resources.uiWorkflowsCiVirtualDisplay, ...Resources.uiWorkflowsCiVirtualDisplayArguments, process.execPath, ...script], root, process.env)
      : await runner.runAsync(process.execPath, script, root, process.env);
    return exitCode ?? Resources.failedExitCode;
  }
}

if (import.meta.main)
  process.exitCode = await UiWorkflowsCi.runAsync(realpathSync(process.cwd()), new ProcessRunner(), process.argv.slice(2));
