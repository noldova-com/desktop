/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureTypeMismatchException } from "../exceptions/failure-type-mismatch.exception";

export class FailureFixture {
  public static of<T extends Error>(value: unknown, type: abstract new (...args: never[]) => T): T {
    if (!(value instanceof type))
      throw new FailureTypeMismatchException(type.name);
    return value;
  }
}
