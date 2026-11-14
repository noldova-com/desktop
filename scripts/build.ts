/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { Resources } from "./resources.ts";

const root = path.join(import.meta.dirname, Resources.parentFolder);
const commandLine = path.join(root, ...Resources.buildCommandLineSegments);
const npm = process.env[Resources.npmPathVariable];
const options = process.argv.slice(2);
const spawn = (commandArguments: readonly string[]): number => spawnSync(process.execPath, commandArguments, { cwd: root, stdio: Resources.buildStdio }).status ?? Resources.failedExitCode;
const run = (commandArguments: readonly string[]): number => spawn([commandLine, ...commandArguments]);
const bootstrapped = existsSync(path.join(root, Resources.nodeModulesFolder)) || npm === undefined ? Resources.successExitCode : spawn([npm, ...Resources.buildBootstrapArguments]);
const installed = bootstrapped !== Resources.successExitCode || options.includes(Resources.buildListCopiesOption) ? bootstrapped : run([Resources.buildInstallCommand]);
process.exitCode = installed !== Resources.successExitCode ? installed : run([Resources.buildCommand, ...options]);
