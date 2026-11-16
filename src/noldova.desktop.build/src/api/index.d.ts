/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/// <reference types="node" />

import type { Writable } from "node:stream";

/**
 * The `noldova-desktop-build` command line, which builds, starts, packages
 * and releases an app from the `desktop` section of its root `package.json`.
 *
 * @remarks
 * An app runs it through the package's bin, usually from its own
 * `package.json` scripts, such as `"build": "noldova-desktop-build build"`.
 * Its commands are `install`, `build`, `start`, `desktop-tools`, `package`,
 * `package-smoke`, `list-targets`, `release-check`, `release-assets` and
 * `release-publish`; each takes the arguments that follow it, as the
 * package's README describes.
 */
export declare class BuildCommandLine {
  /**
   * Creates the command line.
   *
   * @param folder The app's folder, which holds its root `package.json`;
   * usually the current folder.
   * @param environment The environment the commands read, such as signing
   * credentials and release settings, and pass to the programs they run.
   * @param platform The platform the commands build for, as Node.js's
   * `process.platform` names it.
   * @param architecture The processor the commands build for, as Node.js's
   * `process.arch` names it.
   * @param output Where the commands write their progress and results.
   * @param errors Where the usage and some failures are written.
   */
  public constructor(folder: string, environment: NodeJS.ProcessEnv, platform: string, architecture: string, output: Writable, errors: Writable);

  /**
   * Runs one command.
   *
   * @param commandArguments The command's name, then its arguments.
   * @returns A promise of the exit code: 0 when the command succeeded, 2 with
   * the usage on standard error for an unknown or missing command, and the
   * command's own code otherwise.
   * @example
   * ```ts
   * import { BuildCommandLine } from "@noldova/desktop.build";
   *
   * process.exitCode = await new BuildCommandLine(process.cwd(), process.env, process.platform, process.arch, process.stdout, process.stderr)
   *   .runAsync(["build"]);
   * ```
   */
  public runAsync(commandArguments: readonly string[]): Promise<number>;
}
