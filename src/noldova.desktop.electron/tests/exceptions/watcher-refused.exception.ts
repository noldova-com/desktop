/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class WatcherRefusedException extends ElectronException {
  public readonly answer: string;

  public constructor(answer: string) {
    super(`The private bus refused the watcher: ${answer}`);

    this.answer = answer;
  }
}
