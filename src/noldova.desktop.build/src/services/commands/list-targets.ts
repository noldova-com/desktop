/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { BuildMatrix } from "../../models/workflows/build-matrix.ts";
import { Resources } from "../../resources.ts";
import { ReleaseTargets } from "../release/release-targets.ts";
import { SupportedTargets } from "../release/supported-targets.ts";

export class ListTargets {
  private readonly output: Writable;
  private readonly errors: Writable;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly command: string;

  public constructor(output: Writable, errors: Writable, environment: NodeJS.ProcessEnv, command: string = Resources.commandName) {
    this.output = output;
    this.errors = errors;
    this.environment = environment;
    this.command = command;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    const [folder, ...rest] = commandArguments;
    if (rest.length > 0 || folder === String.empty) {
      this.output.write(Resources.formatListTargetsUsage(this.command));
      return Resources.usageExitCode;
    }
    const supported = Object.isUndefined(folder) ? null : await SupportedTargets.inspectAsync(path.resolve(folder));
    if (supported instanceof BuildException) {
      this.errors.write(Resources.formatOutputLine(supported.message));
      return Resources.failureExitCode;
    }
    const rows: string[] = [];
    for (const target of BuildMatrix.TARGETS) {
      if (target.architecture !== Resources.optionalTargetArchitecture && !ReleaseTargets.isRequired(new PackageTarget(target.platform, target.architecture), supported))
        continue;
      const variable = Resources.formatRunnerVariable(target.runnerName);
      const runner = this.environment[variable] ?? String.empty;
      if (runner.length === 0 && target.architecture === Resources.optionalTargetArchitecture)
        continue;
      if (!ListTargets.isJson(runner)) {
        this.errors.write(Resources.formatRunnerMissing(variable, target.name, runner));
        return Resources.failureExitCode;
      }
      rows.push(Resources.formatTargetRow([target.name, JSON.stringify(runner), target.architecture, target.platform, target.packagesEachNight ? Resources.targetEachNight : Resources.targetByHand]));
    }
    this.output.write(rows.join(String.empty));
    return 0;
  }

  private static isJson(text: string): boolean {
    try {
      JsonReader.parseValue(text);
      return text.length > 0;
    }
    catch {
      return false;
    }
  }
}
