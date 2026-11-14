/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { ProcessRunner } from "../processes/process-runner.ts";
import { DevelopmentBinary } from "../desktop/development-binary.ts";
import { Resources } from "../../resources.ts";

export class DesktopToolsCommand {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly binary: DevelopmentBinary;

  public constructor(root: string, runner: ProcessRunner, binary: DevelopmentBinary) {
    this.root = root;
    this.runner = runner;
    this.binary = binary;
  }

  public async runAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv, report: Writable): Promise<number> {
    const executable = await this.binary.prepareAsync(report);
    const product = await ProductIdentity.readAsync(this.root);
    const launched = { ...environment, [Resources.runAsNodeVariable]: Resources.runAsNodeValue, [product.checkoutVariable]: this.root };
    const folder = environment[Resources.npmStartingFolderVariable] ?? this.root;
    const exitCode = await this.runner.runAsync(executable, [path.join(this.root, ...Resources.desktopToolsEntrySegments), ...commandArguments], folder, launched);
    return exitCode ?? Resources.failureExitCode;
  }
}
