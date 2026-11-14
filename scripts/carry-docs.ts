/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { ApiDocMerger } from "./api/api-doc-merger.ts";
import { ApiProgram } from "./api/api-program.ts";
import { ApiProject } from "./api/api-project.ts";
import { ApiVisibility } from "./api/api-visibility.ts";
import { ApiException } from "./api/api.exception.ts";
import { Resources } from "./resources.ts";
import { BuildException } from "../src/noldova.desktop.build/src/exceptions/build.exception.ts";

export class CarryDocs {
  private readonly root: string;
  private readonly output: Writable;

  public constructor(root: string, output: Writable) {
    this.root = root;
    this.output = output;
  }

  public async runAsync(args: readonly string[]): Promise<number> {
    const [projectFile, output, ...entries] = args;
    if (Object.isUndefined(projectFile) || Object.isUndefined(output) || entries.length === 0) {
      this.output.write(Resources.carryDocsUsage);
      return Resources.usageExitCode;
    }

    try {
      await this.carryAsync(path.resolve(projectFile), path.resolve(output), entries.map(t => path.resolve(t)));
      return Resources.successExitCode;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      this.output.write(`${error.message}${Resources.lineEnd}`);
      return Resources.failedExitCode;
    }
  }

  private async carryAsync(projectFile: string, output: string, entries: readonly string[]): Promise<void> {
    const pairs = entries.map(t => {
      const name = path.basename(t, Resources.scriptExtension);
      return [path.join(path.dirname(t), `${name}${Resources.declarationsExtension}`), path.join(output, Resources.apiEntryFolder, `${name}${Resources.declarationsExtension}`)] as const;
    });
    for (const [documented, compiled] of pairs) {
      if (!existsSync(documented))
        throw new BuildException(Resources.formatCarryDocsMissingDocumented(this.describe(documented)));
      if (!existsSync(compiled))
        throw new BuildException(Resources.formatCarryDocsMissingCompiled(this.describe(compiled), this.describe(documented)));
    }

    const project = new ApiProject(this.root, Resources.carryDocsPurpose, path.basename(output));
    await project.writeAsync(projectFile, this.root, pairs.flat());
    const problems = await this.mergeAsync(project.file, pairs).catch((error: unknown) => {
      if (error instanceof ApiException)
        throw new BuildException(Resources.formatCarryDocsCarryFailed(this.describe(output), error.message), new ExceptionOptions(error));
      throw error;
    });
    if (problems.length > 0)
      throw new BuildException(Resources.formatCarryDocsDiffering(this.describe(output), problems));
  }

  private async mergeAsync(projectFile: string, pairs: readonly (readonly [documented: string, compiled: string])[]): Promise<readonly string[]> {
    const merger = new ApiDocMerger(ApiProgram.open(projectFile), ApiVisibility.PUBLIC, this.root);
    for (const [documented, compiled] of pairs)
      merger.add(documented, compiled);
    if (merger.problems.length === 0)
      await merger.writeAsync();
    return merger.problems;
  }

  private describe(file: string): string {
    return path.relative(this.root, file).split(path.sep).join(path.posix.sep);
  }
}

if (import.meta.main)
  process.exitCode = await new CarryDocs(process.cwd(), process.stderr).runAsync(process.argv.slice(2));
