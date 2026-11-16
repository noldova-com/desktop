/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { URL } from "node:url";

import { Provider, type ResolvedUpdateFileInfo, type UpdateFileInfo, type UpdateInfo } from "electron-updater";

import "@noldova/context.core";
import { ArgumentException, ExceptionOptions } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";

import { UpdateFeedRedirectedException } from "../exceptions/update-feed-redirected.exception.js";
import { UpdateFeedRefusedException } from "../exceptions/update-feed-refused.exception.js";
import { UpdateFeedUnreachableException } from "../exceptions/update-feed-unreachable.exception.js";
import { UpdateInfoInvalidException } from "../exceptions/update-info-invalid.exception.js";
import type { IFeedRuntimeOptions } from "../interfaces/i-feed-runtime-options.js";
import { CaughtFailure } from "../models/caught-failure.js";
import { FeedSource } from "../models/feed-source.js";
import { Resources } from "../resources.js";
import { ProductAppAdapter } from "./product-app-adapter.js";

export class FeedProvider extends Provider<UpdateInfo> {
  private readonly source: FeedSource;
  private base: URL | undefined;

  public constructor(options: Readonly<Record<string, unknown>>, _updater: unknown, runtimeOptions: IFeedRuntimeOptions) {
    super(ProductAppAdapter.toProviderOptions(runtimeOptions));
    const source = options[Resources.feedSourceOption];
    if (!(source instanceof FeedSource))
      throw new ArgumentException(Resources.feedSourceMissing, Resources.feedSourceOption);
    this.source = source;
    this.base = undefined;
  }

  public async getLatestVersion(): Promise<UpdateInfo> {
    const requested = new URL(this.source.channelFile, this.source.feed);
    const signal = this.source.timeout(Resources.updateFeedTimeout);
    const response = await FeedProvider.reach(this.source.fetchAsync(requested.href, signal));
    if (!response.ok)
      throw new UpdateFeedRefusedException(response.status);
    const url = response.url.length > 0 ? new URL(response.url) : requested;
    if (url.protocol !== requested.protocol)
      throw new UpdateFeedRedirectedException();
    const info = FeedProvider.parse(await FeedProvider.reach(response.text()), this.source.channelFile, url);
    FeedProvider.check(info);
    if (Object.isUndefined(FeedProvider.findPackage(info, this.source.formatReleasedFile(info.version))))
      throw new UpdateInfoInvalidException();
    this.base = url;
    return info;
  }

  public resolveFiles(updateInfo: UpdateInfo): ResolvedUpdateFileInfo[] {
    const name = this.source.formatReleasedFile(updateInfo.version);
    const file = FeedProvider.findPackage(updateInfo, name);
    if (Object.isUndefined(this.base) || Object.isUndefined(file))
      throw new UpdateInfoInvalidException();
    return [{ url: new URL(name, this.base), info: file }];
  }

  private static async reach<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    }
    catch (error) {
      throw new UpdateFeedUnreachableException(new ExceptionOptions(error));
    }
  }

  private static parse(text: string, channelFile: string, url: URL): UpdateInfo | null | undefined {
    try {
      return ProductAppAdapter.parseUpdateInfo(text, channelFile, url);
    }
    catch (error) {
      throw new UpdateInfoInvalidException(new ExceptionOptions(error));
    }
  }

  private static check(info: UpdateInfo | null | undefined): asserts info is UpdateInfo {
    try {
      const reader = JsonReader.fromValue({ [Resources.updateVersionField]: info?.version, [Resources.updateFilesField]: info?.files });
      reader.readNonBlankString(Resources.updateVersionField);
      reader.readObjectArray(Resources.updateFilesField);
    }
    catch (error) {
      throw new UpdateInfoInvalidException(new ExceptionOptions(CaughtFailure.expect(error, JsonException)));
    }
  }

  private static findPackage(info: UpdateInfo, packageFile: string): UpdateFileInfo | undefined {
    return info.files.find(t => Object.isObject(t) && t.url === packageFile && Object.isString(t.sha512) && t.sha512.length > 0 && Number.isInteger(t.size) && Number(t.size) > 0);
  }
}
