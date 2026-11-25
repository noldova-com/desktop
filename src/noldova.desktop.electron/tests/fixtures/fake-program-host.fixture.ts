/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IProgramHost, StartedProgram } from "@noldova/desktop.electron";

import { NoProgramStartedException } from "../exceptions/no-program-started.exception.js";
import { NoProgramWaitingException } from "../exceptions/no-program-waiting.exception.js";

interface IFakeStart {
  readonly file: string;
  readonly programArguments: readonly string[];
  readonly environment: NodeJS.ProcessEnv;
  readonly onOutput: (text: string) => void;
  readonly onExit: () => void;
}

interface IFakeRun {
  readonly file: string;
  readonly programArguments: readonly string[];
  readonly environment: NodeJS.ProcessEnv;
  readonly answer: PromiseWithResolvers<string>;
}

export class FakeProgramHost implements IProgramHost {
  private readonly pending: IFakeRun[] = [];

  public readonly runs: IFakeRun[] = [];
  public readonly starts: IFakeStart[] = [];
  public stops: number = 0;

  public static settleAsync(): Promise<void> {
    return new Promise<void>(resolve => setImmediate(resolve));
  }

  public get waiting(): number {
    return this.pending.length;
  }

  public runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string> {
    const run: IFakeRun = { file, programArguments, environment, answer: Promise.withResolvers<string>() };
    this.runs.push(run);
    this.pending.push(run);
    return run.answer.promise;
  }

  public start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram {
    this.starts.push({ file, programArguments, environment, onOutput, onExit });
    return new StartedProgram(() => this.stops++);
  }

  public async answerAsync(text: string): Promise<void> {
    this.take().answer.resolve(text);
    await FakeProgramHost.settleAsync();
  }

  public async failAsync(): Promise<void> {
    this.take().answer.reject(new Error("The name org.kde.StatusNotifierWatcher was not provided by any .service files"));
    await FakeProgramHost.settleAsync();
  }

  public output(text: string): void {
    this.lastStart().onOutput(text);
  }

  public exit(): void {
    this.lastStart().onExit();
  }

  private take(): IFakeRun {
    const run = this.pending.shift();
    if (Object.isUndefined(run))
      throw new NoProgramWaitingException();
    return run;
  }

  private lastStart(): IFakeStart {
    const start = this.starts.at(-1);
    if (Object.isUndefined(start))
      throw new NoProgramStartedException();
    return start;
  }
}
