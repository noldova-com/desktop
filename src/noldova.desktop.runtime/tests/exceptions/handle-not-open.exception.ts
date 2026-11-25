/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "@noldova/desktop.runtime";

export class HandleNotOpenException extends RuntimeException {
  public readonly handle: bigint;

  public constructor(handle: bigint) {
    super(`The handle ${handle} is not open.`);

    this.handle = handle;
  }
}
