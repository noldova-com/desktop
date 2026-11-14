/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import type { TestInfo } from "@playwright/test";

import type { MainProcessFixture } from "./main-process.fixture.ts";

export class OutlivingProcess {
  private static readonly SCRIPT: string = "((fs, release) => (fs.watch(require(\"node:path\").dirname(release), () => fs.existsSync(release) && process.exit()), fs.existsSync(release) && process.exit(), setTimeout(() => process.exit(), 300000)))(require(\"node:fs\"), process.argv[1])";
  private static readonly RELEASE_SUFFIX: string = ".release";
  private static readonly RELEASES: string[] = [];

  public static async startAsync(mainProcess: MainProcessFixture, testInfo: TestInfo): Promise<number> {
    const release = testInfo.outputPath(`outliving-${OutlivingProcess.RELEASES.length}${OutlivingProcess.RELEASE_SUFFIX}`);
    OutlivingProcess.RELEASES.push(release);
    await mkdir(path.dirname(release), { recursive: true });
    return mainProcess.application.evaluate((_, { script, file }) => {
      const { spawn } = process.getBuiltinModule("node:child_process");
      const child = spawn(process.execPath, ["-e", script, file], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: "ignore", windowsHide: true, detached: process.platform === "win32"
      });
      child.unref();
      return child.pid ?? 0;
    }, { script: OutlivingProcess.SCRIPT, file: release });
  }

  public static async releaseAllAsync(): Promise<void> {
    for (const release of OutlivingProcess.RELEASES.splice(0)) {
      await mkdir(path.dirname(release), { recursive: true });
      await writeFile(release, String.empty);
    }
  }
}
