/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class UpdateFeed {
  public static isValid(feed: string): boolean {
    if (!URL.canParse(feed) || !feed.endsWith(Resources.pathSegmentSeparator))
      return false;
    const url = new URL(feed);
    return url.protocol === Resources.secureProtocol || (url.protocol === Resources.localUrlProtocol && Resources.updateFeedLocalHosts.has(url.hostname));
  }

  public static isNamed(feed: string): boolean {
    if (!UpdateFeed.isValid(feed) || Resources.updateFeedUnsafePattern.test(feed))
      return false;
    const url = new URL(feed);
    return url.protocol === Resources.secureProtocol && url.username.length === 0 && url.password.length === 0;
  }

  public static ofRepository(repository: string): string {
    return Resources.formatRepositoryUpdateFeed(repository);
  }
}
