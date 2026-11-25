/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import childProcess from "node:child_process";
import type { TestContext } from "node:test";

import { ExecCall } from "./exec-call.ts";

export class ExecPassThroughFixture {
  public static readonly TEST_LIMIT: number = 60_000;

  private static readonly EXEC_FILE_SYNC: typeof childProcess.execFileSync = childProcess.execFileSync;

  private readonly recorded: ExecCall[] = [];

  public constructor(context: TestContext) {
    context.mock.method(childProcess, "execFileSync",
      (command: string, arguments_: readonly string[], options: childProcess.ExecFileSyncOptionsWithStringEncoding): string => this.passThroughAtTheTestLimit(command, arguments_, options));
  }

  public get calls(): readonly ExecCall[] {
    return this.recorded;
  }

  private passThroughAtTheTestLimit(command: string, arguments_: readonly string[], options: childProcess.ExecFileSyncOptionsWithStringEncoding): string {
    const { timeout, ...rest } = options;
    this.recorded.push(new ExecCall(command, arguments_, timeout));
    return ExecPassThroughFixture.EXEC_FILE_SYNC(command, arguments_, { ...rest, timeout: ExecPassThroughFixture.TEST_LIMIT });
  }
}
