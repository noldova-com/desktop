/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcess, SpawnOptions } from "node:child_process";
import { constants } from "node:os";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class CommandLineRelay {
  private readonly start: (program: string, programArguments: readonly string[], options: SpawnOptions) => ChildProcess;
  private readonly program: string;
  private readonly entry: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly error: Writable;

  public constructor(start: (program: string, programArguments: readonly string[], options: SpawnOptions) => ChildProcess, program: string, entry: string,
    environment: NodeJS.ProcessEnv, error: Writable) {
    this.start = start;
    this.program = program;
    this.entry = entry;
    this.environment = environment;
    this.error = error;
  }

  public static readArguments(argv: readonly string[]): readonly string[] | null {
    const index = argv.indexOf(Resources.commandLineArgument);
    return index < 0 ? null : argv.slice(index + 1);
  }

  public runAsync(commandArguments: readonly string[]): Promise<number> {
    return new Promise<number>(resolve => {
      const child = this.start(this.program, [this.entry, ...commandArguments],
        { env: { ...this.environment, [Resources.runAsNodeVariable]: Resources.runAsNodeValue }, shell: false, stdio: Resources.inheritedStdio });
      child.once(Resources.errorEvent, (failure: Error) => {
        this.error.write(Resources.formatCommandLineNotStarted(this.program, failure.message));
        resolve(Resources.failureExitCode);
      });
      child.once(Resources.exitEvent, (code: number | null, signal: NodeJS.Signals | null) =>
        resolve(code ?? (Object.isNull(signal) ? Resources.failureExitCode : Resources.signalExitBase + constants.signals[signal])));
    });
  }
}
