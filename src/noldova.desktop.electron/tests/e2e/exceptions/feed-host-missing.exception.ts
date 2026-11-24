/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class FeedHostMissingException extends ElectronException {
  public readonly host: string;
  public readonly variant: string;

  public constructor(host: string, variant: string) {
    super(`The build's product file names no feed on ${host}; swap in the ${variant} variant first.`);

    this.host = host;
    this.variant = variant;
  }
}
