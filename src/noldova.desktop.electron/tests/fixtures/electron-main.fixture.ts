/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import { Assert } from "@noldova/context.testing";

export class ElectronMainFixture {
  private static readonly BINARY_MISSING: string = "Electron's binary is not installed; run npm run build to install it.";

  public static start(fixture: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv = { ...process.env }):
    { process: ChildProcess; text: { output: string; errors: string }; ended: Promise<unknown>; exited: Promise<unknown> } {
    const electron = ElectronMainFixture.findElectron();
    const main = fileURLToPath(new URL(`./${fixture}`, import.meta.url));
    const mainEnvironment = { ...environment };
    delete mainEnvironment["ELECTRON_RUN_AS_NODE"];
    const mainProcess = spawn(electron, [main, ...launchArguments], { stdio: ["ignore", "pipe", "pipe"], env: mainEnvironment });
    const text = { output: String.empty, errors: String.empty };
    mainProcess.stdout.setEncoding("utf8").on("data", (chunk: string) => text.output += chunk);
    mainProcess.stderr.setEncoding("utf8").on("data", (chunk: string) => text.errors += chunk);
    return { process: mainProcess, text, ended: once(mainProcess.stdout, "end"), exited: once(mainProcess, "exit").then(([code]: unknown[]) => code) };
  }

  private static findElectron(): string {
    const require = createRequire(import.meta.url);
    const directory = path.dirname(require.resolve("electron/package.json"));
    const pathFile = path.join(directory, "path.txt");
    if (!existsSync(pathFile) || !existsSync(path.join(directory, "dist", readFileSync(pathFile, "utf8"))))
      Assert.fail(ElectronMainFixture.BINARY_MISSING);
    return String(require("electron"));
  }
}
