/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from "node:events";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import "@noldova/context.core";

import { DataDirectoryOwnedException } from "../exceptions/data-directory-owned.exception.js";
import { UpdateInProgressException } from "../exceptions/update-in-progress.exception.js";
import { RuntimeOptions } from "../models/runtime-options.js";
import { SystemErrorCode } from "../models/system-error-code.js";
import { Resources } from "../resources.js";
import { ProcessPresence } from "./installation/process-presence.js";
import { RuntimeHost } from "./lifetime/runtime-host.js";
import { PosixResponsibilityApi } from "./process/posix-responsibility-api.js";

export class RuntimeEntry {
  public static get entryPath(): string {
    return fileURLToPath(import.meta.url);
  }

  public static async runAsync(entryArguments: readonly string[], platform: string, environment: NodeJS.ProcessEnv, signals: EventEmitter, error: Writable,
    responsibility: PosixResponsibilityApi | null = PosixResponsibilityApi.create(platform)): Promise<number> {
    RuntimeEntry.guard(error);
    let options: RuntimeOptions;
    try {
      options = RuntimeOptions.parse(entryArguments);
    }
    catch (failure) {
      error.write(Resources.formatUsageFailure(String(failure)));
      return Resources.usageExitCode;
    }

    let host: RuntimeHost;
    try {
      host = await RuntimeHost.startAsync(options, platform, environment, ProcessPresence.create(platform));
    }
    catch (failure) {
      if (failure instanceof DataDirectoryOwnedException)
        return Resources.ownedExitCode;
      error.write(Resources.formatFailureLine(String(failure)));
      return failure instanceof UpdateInProgressException ? Resources.updatingExitCode : Resources.failureExitCode;
    }

    const note = RuntimeEntry.describeResponsibility(responsibility);
    if (!Object.isNull(note))
      host.log.writeLine(note);
    const stop = (): void => host.requestStop(Resources.stoppedBySignal);
    const report = (failure: unknown): void => host.log.writeLine(inspect(failure));
    for (const signal of Resources.stopSignals)
      signals.on(signal, stop);
    signals.on(Resources.uncaughtExceptionEvent, report);
    try {
      await host.waitForStopAsync();
      return 0;
    }
    finally {
      for (const signal of Resources.stopSignals)
        signals.off(signal, stop);
      signals.off(Resources.uncaughtExceptionEvent, report);
    }
  }

  public static async settleAsync(run: Promise<number>, error: Writable, exit: Pick<NodeJS.Process, "exitCode">): Promise<void> {
    try {
      exit.exitCode = await run;
    }
    catch (failure) {
      error.write(Resources.formatFailureLine(inspect(failure)));
      exit.exitCode = Resources.failureExitCode;
    }
  }

  private static guard(error: Writable): void {
    error.on(Resources.errorEvent, (failure: Error) => {
      if (!SystemErrorCode.isAny(failure, Resources.unwritableStreamCodes))
        throw failure;
    });
  }

  private static describeResponsibility(responsibility: PosixResponsibilityApi | null): string | null {
    try {
      return responsibility?.describe(process.pid) ?? null;
    }
    catch (failure) {
      return inspect(failure);
    }
  }
}

if (import.meta.main)
  void RuntimeEntry.settleAsync(RuntimeEntry.runAsync(process.argv.slice(Resources.entryArgumentsStart), process.platform, process.env, process, process.stderr), process.stderr, process);
