/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class ErrorCode {
  public static of(error: unknown): string | undefined {
    if (!(error instanceof Error) || !(Resources.errorCodeField in error))
      return undefined;
    const code: unknown = error[Resources.errorCodeField];
    return Object.isString(code) ? code : undefined;
  }

  public static isOneOf(error: unknown, codes: readonly string[]): boolean {
    const code = ErrorCode.of(error);
    return !Object.isUndefined(code) && codes.includes(code);
  }
}
