/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class RuntimeConnectionsMiscountedException extends ElectronException {
  public readonly endpoint: string;
  public readonly matched: number;
  public readonly descriptions: readonly string[];

  public constructor(endpoint: string, matched: number, descriptions: readonly string[]) {
    super(`The main process should hold one connection to the runtime at ${endpoint} but holds ${matched}. It found these sockets through process._getActiveHandles(), which Node does not document: ${descriptions.length === 0 ? "none" : descriptions.join("; ")}.`);

    this.endpoint = endpoint;
    this.matched = matched;
    this.descriptions = descriptions;
  }
}
