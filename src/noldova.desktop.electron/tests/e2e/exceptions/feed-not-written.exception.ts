/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class FeedNotWrittenException extends ElectronException {
  public readonly feed: string;

  public constructor(feed: string) {
    super(`The build's product file doesn't hold its feed ${feed} as written.`);

    this.feed = feed;
  }
}
