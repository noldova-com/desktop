/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { ConnectionException } from "./connection.exception.js";

export class EndpointUnavailableException extends ConnectionException {
  public constructor() {
    super(Resources.endpointUnavailable, null);
  }
}
