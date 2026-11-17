/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { CancellationToken, type ProgressInfo } from "electron-updater";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { UpdateDownloadInterruptedException } from "../exceptions/update-download-interrupted.exception.js";
import { UpdateDownloadMismatchException } from "../exceptions/update-download-mismatch.exception.js";
import { UpdateFailedUnexpectedlyException } from "../exceptions/update-failed-unexpectedly.exception.js";
import { UpdateInfoInvalidException } from "../exceptions/update-info-invalid.exception.js";
import { UpdateNotSignedException } from "../exceptions/update-not-signed.exception.js";
import { UpdateException } from "../exceptions/update.exception.js";
import type { IAppUpdater } from "../interfaces/i-app-updater.js";
import type { IUpdater } from "../interfaces/i-updater.js";
import type { FeedSource } from "../models/feed-source.js";
import { UpdateVersion } from "../models/update-version.js";
import { ErrorCode } from "../models/error-code.js";
import { Resources } from "../resources.js";
import { FeedProvider } from "./feed-provider.js";

export class FeedUpdater implements IUpdater {
  private readonly updater: IAppUpdater;
  private readonly source: FeedSource;
  private readonly configFile: string;
  private readonly configuration: string;
  private readonly verifyAsync: ((file: string) => Promise<string | null>) | null;
  private readonly log: (text: string) => void;
  private cancellation: CancellationToken | undefined;
  private isConfigured: boolean = false;
  private downloaded: string | null = null;
  private readonly pendingFolder: string;

  public constructor(
    updater: IAppUpdater,
    source: FeedSource,
    installationFolder: string,
    cacheRoot: string,
    productSlug: string,
    verifyAsync: ((file: string) => Promise<string | null>) | null,
    log: (text: string) => void) {
    const cacheFolder = Resources.formatUpdateCacheFolder(productSlug, basename(installationFolder));
    this.updater = updater;
    this.source = source;
    this.configFile = join(installationFolder, Resources.updateConfigFile);
    this.configuration = JSON.stringify({ [Resources.updaterCacheFolderField]: cacheFolder });
    this.verifyAsync = verifyAsync;
    this.log = log;
    this.pendingFolder = join(cacheRoot, cacheFolder, Resources.pendingUpdateFolder);
    this.cancellation = undefined;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.disableDifferentialDownload = true;
    updater.disableWebInstaller = true;
    updater.logger = { info: () => undefined, warn: (message: unknown) => log(Resources.formatUpdaterMessage(String(message))), error: (message: unknown) => log(Resources.formatUpdaterMessage(String(message))) };
    updater.isUpdateSupported = info => UpdateVersion.isOffered(info.version);
  }

  public get downloadedFile(): string | null {
    return this.downloaded;
  }

  public async checkAsync(): Promise<string | null> {
    try {
      await this.configureAsync();
      const result = await this.updater.checkForUpdates();
      return Object.isNull(result) || !result.isUpdateAvailable ? null : result.updateInfo.version;
    }
    catch (error) {
      throw FeedUpdater.explain(error, UpdateFailedUnexpectedlyException);
    }
  }

  public async downloadAsync(version: string, onProgress: (percent: number) => void): Promise<string> {
    const listener = (info: ProgressInfo): void => onProgress(Math.floor(info.percent));
    const cancellation = new CancellationToken();
    this.cancellation = cancellation;
    this.downloaded = null;
    this.updater.on(Resources.downloadProgressEvent, listener);
    try {
      const [file] = await this.updater.downloadUpdate(cancellation);
      if (Object.isUndefined(file))
        throw new UpdateDownloadInterruptedException();
      if (file !== this.formatPackagePath(version))
        throw new UpdateFailedUnexpectedlyException();
      await this.verifyPublisherAsync(file);
      this.downloaded = file;
      return file;
    }
    catch (error) {
      throw FeedUpdater.explain(error, UpdateDownloadInterruptedException);
    }
    finally {
      this.updater.removeListener(Resources.downloadProgressEvent, listener);
      this.cancellation = undefined;
    }
  }

  public formatPackagePath(version: string): string {
    return join(this.pendingFolder, this.source.formatReleasedFile(version));
  }

  public cancel(): void {
    this.cancellation?.cancel();
  }

  private async verifyPublisherAsync(file: string): Promise<void> {
    if (Object.isNull(this.verifyAsync) || Object.isNull(await this.verifyAsync(file)))
      return;
    await rm(file, { force: true }).catch((error: unknown) => this.log(Resources.formatUpdateNotDeleted(String(error))));
    throw new UpdateNotSignedException();
  }

  private static explain(error: unknown, otherwise: new (options: ExceptionOptions) => UpdateException): UpdateException {
    if (error instanceof UpdateException)
      return error;
    const options = new ExceptionOptions(error);
    if (ErrorCode.isOneOf(error, Resources.updateInfoInvalidCodes))
      return new UpdateInfoInvalidException(options);
    if (ErrorCode.isOneOf(error, Resources.updateDownloadMismatchCodes))
      return new UpdateDownloadMismatchException(options);
    return ErrorCode.isOneOf(error, Resources.updateNotSignedCodes) ? new UpdateNotSignedException(options) : new otherwise(options);
  }

  private async configureAsync(): Promise<void> {
    if (this.isConfigured)
      return;
    await mkdir(dirname(this.configFile), { recursive: true });
    await writeFile(this.configFile, this.configuration, Resources.textEncoding);
    this.updater.updateConfigPath = this.configFile;
    this.updater.setFeedURL({ provider: Resources.customProvider, updateProvider: FeedProvider, source: this.source });
    this.isConfigured = true;
  }
}
