/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";
import { ConnectionException } from "./connection.exception.js";

export class ConnectionClosedException extends ConnectionException {
  public constructor() {
    super(Resources.clientClosed, new Failure(FailureCode.Disconnected, Resources.clientClosed));
  }
}
