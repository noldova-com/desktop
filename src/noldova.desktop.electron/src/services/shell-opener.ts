/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { LinkPolicy } from "@noldova/desktop.protocol";
import { FolderCreation } from "@noldova/desktop.runtime";

import type { IShellHost } from "../interfaces/i-shell-host.js";
import type { IShownPathFiles } from "../interfaces/i-shown-path-files.js";
import { Resources } from "../resources.js";
import type { OpenWindow } from "./open-window.js";
import { OpenedFilePolicy } from "./opened-file-policy.js";
import { ShownFilePolicy } from "./shown-file-policy.js";

export class ShellOpener {
  private readonly shell: IShellHost;
  private readonly platform: string;
  private readonly files: IShownPathFiles;
  private readonly logsFolder: string;
  private readonly log: (text: string) => void;

  public constructor(shell: IShellHost, platform: string, files: IShownPathFiles, logsFolder: string, log: (text: string) => void) {
    this.shell = shell;
    this.platform = platform;
    this.files = files;
    this.logsFolder = logsFolder;
    this.log = log;
  }

  public async openLogFolderAsync(): Promise<boolean> {
    try {
      await FolderCreation.createAsync(this.logsFolder);
    }
    catch (error) {
      this.log(Resources.formatLogFolderNotOpened(String(error)));
      return false;
    }
    const failure = await this.shell.openPath(this.logsFolder);
    if (failure.length > 0)
      this.log(Resources.formatLogFolderNotOpened(failure));
    return failure.length === 0;
  }

  public async openLinkAsync(open: OpenWindow | null, url: unknown): Promise<boolean> {
    if (Object.isNull(open))
      return false;
    const link = LinkPolicy.findAllowed(url);
    if (Object.isNull(link)) {
      this.log(Resources.linkRefused);
      return false;
    }
    try {
      await this.shell.openExternal(link);
      return true;
    }
    catch (error) {
      this.log(Resources.formatLinkNotOpened(String(error)));
      return false;
    }
  }

  public async showInFolderAsync(open: OpenWindow | null, file: unknown): Promise<string | null> {
    if (Object.isNull(open))
      return this.refuseShow(Resources.shownFileUntrusted);
    if (!Object.isString(file))
      return this.refuseShow(Resources.shownFileNotText);
    const checked = await ShownFilePolicy.checkAsync(file, this.platform, this.files);
    if (!Object.isNull(checked.refusal))
      return this.refuseShow(checked.refusal);
    this.shell.showItemInFolder(checked.path);
    return null;
  }

  public async openFileAsync(open: OpenWindow | null, file: unknown): Promise<string | null> {
    if (Object.isNull(open))
      return this.refuseOpen(Resources.shownFileUntrusted);
    if (!Object.isString(file))
      return this.refuseOpen(Resources.shownFileNotText);
    const checked = await OpenedFilePolicy.checkAsync(file, this.platform, this.files);
    if (!Object.isNull(checked.refusal))
      return this.refuseOpen(checked.refusal);
    const failure = await this.shell.openPath(checked.path);
    return failure.length === 0 ? null : this.refuseOpen(Resources.openedFileFailed);
  }

  private refuseShow(reason: string): string {
    this.log(Resources.formatFileNotShown(reason));
    return reason;
  }

  private refuseOpen(reason: string): string {
    this.log(Resources.formatFileNotOpened(reason));
    return reason;
  }
}
