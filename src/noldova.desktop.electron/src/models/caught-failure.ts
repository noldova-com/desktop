/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CaughtFailure {
  public static expect<T>(error: unknown, type: abstract new (...args: never[]) => T): T {
    if (error instanceof type)
      return error;
    throw error;
  }
}
