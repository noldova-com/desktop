/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ErrorCodeFixture {
  public static of(error: unknown): unknown {
    return error instanceof Error && "code" in error ? error.code : undefined;
  }
}
