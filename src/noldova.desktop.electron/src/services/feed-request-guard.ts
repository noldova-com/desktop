/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { URL } from "node:url";

import "@noldova/context.core";

import type { IFeedWebRequest } from "../interfaces/i-feed-web-request.js";
import { Resources } from "../resources.js";
import type { DailyCheckMark } from "./daily-check-mark.js";

export class FeedRequestGuard {
  private readonly origins: readonly string[];
  private readonly product: readonly [slug: string, version: string, platform: string, architecture: string];
  private readonly mark: DailyCheckMark;
  private readonly log: (text: string) => void;
  private marked: number | undefined;

  public constructor(feed: string, product: readonly [slug: string, version: string, platform: string, architecture: string], mark: DailyCheckMark,
    log: (text: string) => void) {
    this.origins = [new URL(feed).origin, ...Resources.updateAssetOrigins];
    this.product = product;
    this.mark = mark;
    this.log = log;
    this.marked = undefined;
  }

  public static formatUserAgent(product: readonly [slug: string, version: string, platform: string, architecture: string], isDaily: boolean): string {
    const [slug, version, platform, architecture] = product;
    return Resources.formatFeedUserAgent(slug, version, [platform, architecture, ...isDaily ? [Resources.dailyCheckToken] : []]);
  }

  public allows(url: string): boolean {
    return URL.canParse(url) && this.origins.includes(new URL(url).origin);
  }

  public headersOf(headers: Readonly<Record<string, string>>, isDaily: boolean): Record<string, string> {
    const kept = Object.entries(headers).filter(([name]) => Resources.updateSentHeaders.includes(name.toLowerCase()));
    return Object.fromEntries([...kept, [Resources.userAgentHeader, FeedRequestGuard.formatUserAgent(this.product, isDaily)]]);
  }

  public install(webRequest: IFeedWebRequest): void {
    webRequest.onBeforeRequest((details, callback) => {
      const isAllowed = this.allows(details.url);
      if (!isAllowed)
        this.log(Resources.formatUpdateRequestCancelled(URL.canParse(details.url) ? new URL(details.url).host : Resources.invalidAddress));
      callback({ cancel: !isAllowed });
    });
    webRequest.onBeforeSendHeaders((details, callback) => {
      void this.mark.takeAsync().then(isDaily => {
        if (isDaily)
          this.marked = details.id;
        callback({ requestHeaders: this.headersOf(details.requestHeaders, isDaily) });
      });
    });
    webRequest.onResponseStarted(details => {
      if (details.id === this.marked) {
        this.marked = undefined;
        void this.mark.recordAsync();
      }
    });
    webRequest.onErrorOccurred(details => {
      if (details.id === this.marked) {
        this.marked = undefined;
        this.mark.release();
      }
    });
  }
}
