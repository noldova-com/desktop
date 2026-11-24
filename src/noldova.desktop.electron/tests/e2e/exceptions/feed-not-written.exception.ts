/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class FeedNotWrittenException extends installedElectron.ElectronException {
  public readonly feed: string;

  public constructor(feed: string) {
    super(`The build's product file doesn't hold its feed ${feed} as written.`);

    this.feed = feed;
  }
}
