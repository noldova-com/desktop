/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { ElectronException } from "@noldova/desktop.electron";

export class WatcherConnectionFailedException extends ElectronException {
  public constructor(cause: Error) {
    super(`The fixture watcher's connection to the private session bus failed: ${cause.message}`, new ExceptionOptions(cause));
  }
}
