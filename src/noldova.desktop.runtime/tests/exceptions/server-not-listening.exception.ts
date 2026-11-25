/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeException } from "@noldova/desktop.runtime";

export class ServerNotListeningException extends RuntimeException {
  public constructor() {
    super("The server is not listening.");
  }
}
