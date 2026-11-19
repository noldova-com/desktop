/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SpawnSyncOptions, SpawnSyncReturns } from "node:child_process";
import { constants } from "node:os";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class CommandLineRelay {
  private readonly run: (program: string, programArguments: readonly string[], options: SpawnSyncOptions) => SpawnSyncReturns<string | Buffer>;
  private readonly program: string;
  private readonly entry: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly error: Writable;

  public constructor(run: (program: string, programArguments: readonly string[], options: SpawnSyncOptions) => SpawnSyncReturns<string | Buffer>, program: string, entry: string,
    environment: NodeJS.ProcessEnv, error: Writable) {
    this.run = run;
    this.program = program;
    this.entry = entry;
    this.environment = environment;
    this.error = error;
  }

  public static readArguments(argv: readonly string[]): readonly string[] | null {
    const index = argv.indexOf(Resources.commandLineArgument);
    return index < 0 ? null : argv.slice(index + 1);
  }

  public relay(commandArguments: readonly string[]): number {
    const result = this.run(this.program, [this.entry, ...commandArguments],
      { env: { ...this.environment, [Resources.runAsNodeVariable]: Resources.runAsNodeValue }, shell: false, stdio: Resources.inheritedStdio });
    if (!Object.isUndefined(result.error)) {
      this.error.write(Resources.formatCommandLineNotStarted(this.program, result.error.message));
      return Resources.failureExitCode;
    }
    if (!Object.isNull(result.status))
      return result.status;
    return Object.isNull(result.signal) ? Resources.failureExitCode : Resources.signalExitBase + constants.signals[result.signal];
  }
}
