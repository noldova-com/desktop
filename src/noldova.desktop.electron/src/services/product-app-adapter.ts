/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { URL } from "node:url";

import type { Session } from "electron";
import type { UpdateInfo } from "electron-updater";
import { getAppCacheDir } from "electron-updater/out/AppAdapter.js";
import { ElectronHttpExecutor, getNetSession } from "electron-updater/out/electronHttpExecutor.js";
import { parseUpdateInfo, type ProviderRuntimeOptions } from "electron-updater/out/providers/Provider.js";

import { ArgumentException } from "@noldova/context.exceptions";

import type { IFeedRuntimeOptions } from "../interfaces/i-feed-runtime-options.js";
import { Resources } from "../resources.js";

export class ProductAppAdapter {
  public static get cacheFolder(): string {
    return getAppCacheDir();
  }

  public static readNetSession(): Session {
    return getNetSession();
  }

  public static parseUpdateInfo(text: string, channelFile: string, url: URL): UpdateInfo {
    return parseUpdateInfo(text, channelFile, url);
  }

  public static toProviderOptions(options: IFeedRuntimeOptions): ProviderRuntimeOptions {
    const { executor } = options;
    if (!(executor instanceof ElectronHttpExecutor))
      throw new ArgumentException(Resources.feedExecutorUnexpected, Resources.feedExecutorOption);
    return { isUseMultipleRangeRequest: options.isUseMultipleRangeRequest, platform: options.platform, executor };
  }
}
