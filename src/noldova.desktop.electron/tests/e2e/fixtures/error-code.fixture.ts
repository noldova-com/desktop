/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class ErrorCodeFixture {
  public static of(error: unknown): string | undefined {
    const code = ErrorCodeFixture.codeOf(error);
    return Object.isString(code) ? code : undefined;
  }

  public static codeOf(error: unknown): unknown {
    return Object.isObject(error) && "code" in error ? error.code : undefined;
  }

  public static errcodeOf(error: unknown): unknown {
    return Object.isObject(error) && "errcode" in error ? error.errcode : undefined;
  }

  public static stdoutOf(error: unknown): string | undefined {
    const output: unknown = Object.isObject(error) && "stdout" in error ? error.stdout : undefined;
    return Object.isString(output) ? output : undefined;
  }

  public static stderrOf(error: unknown): string | undefined {
    const output: unknown = Object.isObject(error) && "stderr" in error ? error.stderr : undefined;
    return Object.isString(output) ? output : undefined;
  }

  public static wasKilled(error: unknown): boolean {
    return Object.isObject(error) && "killed" in error && error.killed === true;
  }

  public static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
