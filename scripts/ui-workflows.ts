/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import { DevelopmentBinary } from "../src/noldova.desktop.build/src/services/desktop/development-binary.ts";
import { BuildRecord } from "../src/noldova.desktop.build/src/models/packages/build-record.ts";
import { ContentHash } from "../src/noldova.desktop.build/src/services/packages/content-hash.ts";
import { ProcessRunner } from "../src/noldova.desktop.build/src/services/processes/process-runner.ts";
import { Git } from "../src/noldova.desktop.build/src/services/repository/git.ts";
import { Resources } from "./resources.ts";
import { RepositoryFiles } from "./structure/repository-files.ts";
import { UiWorkflowsResources } from "./ui-workflows.resources.ts";

export class UiWorkflows {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly files: RepositoryFiles;
  private readonly output: Writable;
  private readonly binary: DevelopmentBinary;

  public constructor(root: string, runner: ProcessRunner, output: Writable, binary: DevelopmentBinary) {
    this.root = root;
    this.runner = runner;
    this.files = new RepositoryFiles(root, new Git(root, runner));
    this.output = output;
    this.binary = binary;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    const requiresCurrent = commandArguments.includes(UiWorkflowsResources.requireCurrent);
    const playwrightArguments = commandArguments.filter(t => t !== UiWorkflowsResources.requireCurrent);
    const inputs = await this.hashInputsAsync();
    const recordFile = path.join(this.root, ...UiWorkflowsResources.recordSegments);
    if (await this.isCurrentAsync(inputs, recordFile))
      this.output.write(UiWorkflowsResources.current);
    else if (requiresCurrent) {
      this.output.write(UiWorkflowsResources.notCurrent);
      return Resources.failedExitCode;
    }
    else {
      this.output.write(UiWorkflowsResources.building);
      for (const buildArguments of UiWorkflowsResources.builds) {
        const exitCode = await this.runner.runAsync(process.execPath, [path.join(this.root, ...Resources.buildCommandLineSegments), Resources.buildCommand, ...buildArguments], this.root);
        if (exitCode !== Resources.successExitCode)
          return exitCode ?? Resources.failedExitCode;
      }
      await (await this.hashOutputsAsync(inputs)).writeAsync(recordFile);
    }
    await this.binary.prepareAsync(this.output);

    const typeScript = await this.runner.runAsync(process.execPath, [path.join(this.root, ...UiWorkflowsResources.typeScriptCli), UiWorkflowsResources.projectOption, UiWorkflowsResources.endToEndProject], this.root);
    if (typeScript !== Resources.successExitCode)
      return typeScript ?? Resources.failedExitCode;
    return await this.runner.runAsync(process.execPath, [path.join(this.root, ...UiWorkflowsResources.playwrightCli), UiWorkflowsResources.testCommand, UiWorkflowsResources.configOption, UiWorkflowsResources.playwrightConfig, ...playwrightArguments], this.root) ?? Resources.failedExitCode;
  }

  private async isCurrentAsync(inputs: string, recordFile: string): Promise<boolean> {
    return this.listOutputs().every(t => existsSync(t)) && await (await this.hashOutputsAsync(inputs)).isRecordedAsync(recordFile);
  }

  private async hashInputsAsync(): Promise<string> {
    const parts: string[] = [JSON.stringify(UiWorkflowsResources.builds)];
    for (const file of await this.files.listAsync())
      parts.push(file, await ContentHash.ofFileAsync(path.join(this.root, file)));
    return ContentHash.ofParts(parts);
  }

  private async hashOutputsAsync(inputs: string): Promise<BuildRecord> {
    const outputs: string[] = [];
    for (const file of [UiWorkflowsResources.declarationsSegments, UiWorkflowsResources.productSegments])
      outputs.push(await ContentHash.ofFileAsync(path.join(this.root, ...file)));
    for (const tree of UiWorkflowsResources.treeOutputs)
      outputs.push(await ContentHash.ofTreeAsync(path.join(this.root, ...tree)));
    return new BuildRecord(inputs, outputs);
  }

  private listOutputs(): readonly string[] {
    return [path.join(this.root, ...UiWorkflowsResources.declarationsSegments), path.join(this.root, ...UiWorkflowsResources.productSegments), ...UiWorkflowsResources.treeOutputs.map(t => path.join(this.root, ...t))];
  }
}

if (import.meta.main) {
  const root = realpathSync(process.cwd());
  const runner = new ProcessRunner();
  process.exitCode = await new UiWorkflows(root, runner, process.stdout, new DevelopmentBinary(root, runner)).runAsync(process.argv.slice(2));
}
