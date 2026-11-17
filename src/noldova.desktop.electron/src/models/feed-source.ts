/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IFeedResponse } from "../interfaces/i-feed-response.js";
import { Resources } from "../resources.js";

export class FeedSource {
  public readonly feed: string;
  public readonly channelFile: string;
  public readonly packageFile: string;
  public readonly fetchAsync: (url: string, signal: AbortSignal) => Promise<IFeedResponse>;
  public readonly timeout: (milliseconds: number) => AbortSignal;
  public readonly formatReleasedFile: (version: string) => string;

  public constructor(feed: string, channelFile: string, packageFile: string, fetchAsync: (url: string, signal: AbortSignal) => Promise<IFeedResponse>,
    timeout: (milliseconds: number) => AbortSignal = t => AbortSignal.timeout(t), formatReleasedFile: (version: string) => string = () => packageFile) {
    this.feed = feed;
    this.channelFile = channelFile;
    this.packageFile = packageFile;
    this.fetchAsync = fetchAsync;
    this.timeout = timeout;
    this.formatReleasedFile = formatReleasedFile;
  }

  public static create(feed: string | null, productName: string, platform: string, architecture: string, fetchAsync: (url: string, signal: AbortSignal) => Promise<IFeedResponse>,
    isDebianPackage: boolean = false): FeedSource | null {
    const target = Resources.updateTargets.get(platform);
    if (Object.isNull(feed) || Object.isUndefined(target) || !Resources.updateArchitectures.includes(architecture))
      return null;
    const [name, extension] = target;
    const packageExtension = isDebianPackage && platform === Resources.linuxPlatform ? Resources.debianPackageExtension : extension;
    return new FeedSource(feed, Resources.formatChannelFile(name, architecture), Resources.formatPackageFile(productName, name, architecture, packageExtension), fetchAsync,
      undefined, t => Resources.formatReleasedPackageFile(productName, t, name, architecture, packageExtension));
  }
}
