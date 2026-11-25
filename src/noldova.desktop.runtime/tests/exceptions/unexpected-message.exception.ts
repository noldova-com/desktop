/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "@noldova/desktop.runtime";

export class UnexpectedMessageException extends RuntimeException {
  public readonly expected: string;
  public readonly received: string;

  public constructor(expected: string, received: string) {
    super(`Expected ${expected}, not ${received}.`);

    this.expected = expected;
    this.received = received;
  }
}
