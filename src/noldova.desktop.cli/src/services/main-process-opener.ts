/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";

import type { IMainProcessOpener } from "../interfaces/i-main-process-opener.js";
import { Resources } from "../resources.js";

export class MainProcessOpener implements IMainProcessOpener {
  public async openAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<void> {
    const child = spawn(executable, launchArguments, { detached: true, stdio: Resources.ignoreStdio, env: environment });
    await once(child, Resources.spawnEvent);
    child.unref();
  }
}
