/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CodedError extends Error {
  public readonly code: string | number;

  public constructor(code: string | number, message: string) {
    super(message);
    this.code = code;
  }
}
