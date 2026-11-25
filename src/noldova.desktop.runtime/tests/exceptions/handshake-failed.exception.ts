/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "@noldova/desktop.runtime";

export class HandshakeFailedException extends RuntimeException {
  public readonly answer: string;

  public constructor(answer: string) {
    super(`The handshake failed: ${answer}`);

    this.answer = answer;
  }
}
