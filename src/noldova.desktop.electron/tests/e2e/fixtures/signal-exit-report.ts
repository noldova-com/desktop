/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcess } from "node:child_process";

import "@noldova/context.core";

export interface ISignalExit {
  readonly processId: number | undefined;
  readonly signal: NodeJS.Signals;
  readonly step: string;
  readonly drained: Promise<void>;
}

export class SignalExitReport {
  public static readonly ENVIRONMENT: Readonly<Record<string, string>> = { ELECTRON_ENABLE_STACK_DUMPING: "1" };
  public static readonly CRASH_ANNOTATION: string = "crash-output";
  public static readonly START_STEP: string = "while it started";
  public static readonly TEST_STEP: string = "during the test";
  public static readonly QUIT_STEP: string = "while it quit";
  private static readonly DRAIN_TIMEOUT: number = 5_000;

  public static async drainAsync(child: ChildProcess): Promise<void> {
    const errors = child.stderr;
    if (Object.isNull(errors) || errors.closed)
      return;
    const limit = AbortSignal.timeout(SignalExitReport.DRAIN_TIMEOUT);
    await new Promise<void>(resolve => {
      const end = (): void => {
        limit.removeEventListener("abort", end);
        errors.off("close", end);
        resolve();
      };
      limit.addEventListener("abort", end);
      errors.once("close", end);
    });
  }

  public static describe(exit: ISignalExit, stack: readonly string[]): string {
    return [
      `The main process ${exit.processId ?? "(id unknown)"} ended by ${exit.signal} ${exit.step}; the test did not send that signal.`,
      ...stack.length > 0 ? ["Its stack, as Chromium printed it:", ...stack] : ["It printed no stack."]
    ].join("\n");
  }
}
