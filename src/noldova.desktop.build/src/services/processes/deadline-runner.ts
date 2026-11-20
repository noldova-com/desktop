/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { BuildException } from "../../exceptions/build.exception.ts";
import { ProcessTimeoutException } from "../../exceptions/process-timeout.exception.ts";
import type { ProcessResult } from "../../models/processes/process-result.ts";
import { Resources } from "../../resources.ts";
import { ProcessRunner } from "./process-runner.ts";
import type { StartedProcess } from "./started-process.ts";

export class DeadlineRunner extends ProcessRunner {
  private readonly inner: ProcessRunner;
  private readonly names: ReadonlyMap<string, string>;
  private limit: number | null = null;
  private end: number = 0;

  public constructor(inner: ProcessRunner, names: ReadonlyMap<string, string> = new Map<string, string>()) {
    super();
    this.inner = inner;
    this.names = names;
  }

  public start(limit: number): void {
    this.limit = limit;
    this.end = Date.now() + limit;
  }

  public stop(): void {
    this.limit = null;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv,
    isVerbatim: boolean = false): Promise<ProcessResult> {
    const name = this.name(command, commandArguments);
    const remaining = this.readRemaining(name, timeout);
    try {
      return await this.inner.captureAsync(command, commandArguments, directory, Math.min(timeout, remaining), environment, isVerbatim);
    }
    catch (error) {
      throw this.explain(error, name, timeout, remaining);
    }
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv, watch?: (text: string) => void,
    timeout?: number): Promise<number | null> {
    const own = timeout ?? Number.POSITIVE_INFINITY;
    const name = this.name(command, commandArguments);
    const remaining = this.readRemaining(name, own);
    const bound = Math.min(own, remaining);
    try {
      return await this.inner.runAsync(command, commandArguments, directory, environment, watch, Number.isFinite(bound) ? bound : undefined);
    }
    catch (error) {
      throw this.explain(error, name, own, remaining);
    }
  }

  public override startAsync(command: string, commandArguments: readonly string[], directory: string, log: string): Promise<StartedProcess> {
    return this.inner.startAsync(command, commandArguments, directory, log);
  }

  public override isRunning(processId: number): boolean {
    return this.inner.isRunning(processId);
  }

  public override kill(processId: number): void {
    this.inner.kill(processId);
  }

  private name(command: string, commandArguments: readonly string[]): string {
    return this.names.get(commandArguments[0] ?? String.empty) ?? path.basename(command);
  }

  private readRemaining(name: string, timeout: number): number {
    if (Object.isNull(this.limit))
      return timeout;
    const remaining = this.end - Date.now();
    if (remaining <= 0)
      throw new BuildException(Resources.formatPackagingLimitReached(this.limit, name));
    return remaining;
  }

  private explain(error: unknown, name: string, timeout: number, remaining: number): unknown {
    if (error instanceof ProcessTimeoutException && !Object.isNull(this.limit) && remaining < timeout)
      return new BuildException(Resources.formatPackagingLimitReached(this.limit, name), new ExceptionOptions(error));
    return error;
  }
}
