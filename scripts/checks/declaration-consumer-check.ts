/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BuildLayout } from "../../src/noldova.desktop.build/src/services/packages/build-layout.ts";
import type { ProcessRunner } from "../../src/noldova.desktop.build/src/services/processes/process-runner.ts";
import { TypeScriptCompiler } from "../../src/noldova.desktop.build/src/services/toolchain/typescript-compiler.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class DeclarationConsumerCheck implements ICheck {
  private readonly layout: BuildLayout;
  private readonly runner: ProcessRunner;

  public readonly title: string = Resources.declarationConsumerCheckTitle;

  public constructor(layout: BuildLayout, runner: ProcessRunner) {
    this.layout = layout;
    this.runner = runner;
  }

  public async runAsync(): Promise<boolean> {
    const folder = this.layout.root;
    return await this.runner.runAsync(process.execPath, [TypeScriptCompiler.locate(folder), ...Resources.declarationConsumerProjectArguments], folder) === Resources.successExitCode;
  }
}
