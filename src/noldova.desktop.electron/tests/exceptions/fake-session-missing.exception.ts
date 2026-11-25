/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class FakeSessionMissingException extends ElectronException {
  public readonly partition: string;

  public constructor(partition: string) {
    super(`No session for ${partition}.`);

    this.partition = partition;
  }
}
