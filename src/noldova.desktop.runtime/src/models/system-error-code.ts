/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class SystemErrorCode {
  public static of(error: unknown): string | null {
    if (!(error instanceof Error) || !(Resources.nodeErrorCodeField in error))
      return null;

    const code = error[Resources.nodeErrorCodeField];

    return Object.isString(code) ? code : null;
  }

  public static is(error: unknown, code: string): boolean {
    return SystemErrorCode.of(error) === code;
  }

  public static expect(error: unknown, code: string): void {
    if (!SystemErrorCode.is(error, code))
      throw error;
  }

  public static isAny(error: unknown, codes: readonly string[]): boolean {
    const code = SystemErrorCode.of(error);

    return !Object.isNull(code) && codes.includes(code);
  }
}
