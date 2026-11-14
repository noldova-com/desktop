/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Failure } from "@noldova/desktop.protocol";

import { ConnectionException } from "./connection.exception.js";

export class ConnectionRefusedException extends ConnectionException {
  public constructor(failure: Failure) {
    super(failure.message, failure);
  }
}
