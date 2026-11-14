/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { FileGrantsEnded, ShellMethods } from "@noldova/desktop.protocol";

import { FileSaveOutcome } from "../enums/file-save-outcome.js";
import type { IDialogHost } from "../interfaces/i-dialog-host.js";
import type { IIpcEvent } from "../interfaces/i-ipc-event.js";
import { FileGrantRequest } from "../models/file-grant-request.js";
import { FilePathChoice } from "../models/file-path-choice.js";
import { IssuedFiles } from "../models/issued-files.js";
import { OfferedFile } from "../models/offered-file.js";
import type { WindowPage } from "../models/window-page.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import type { FileGrantIssuer } from "./file-grant-issuer.js";
import type { OpenWindow } from "./open-window.js";
import type { RuntimeCaller } from "./runtime-caller.js";

export class FileDialogs {
  private readonly dialog: IDialogHost;
  private readonly windows: WindowRegistry;
  private readonly grants: FileGrantIssuer;
  private readonly runtime: RuntimeCaller;
  private readonly readDownloadsFolder: () => string;
  private readonly log: (text: string) => void;
  private readonly asking: WeakSet<OpenWindow> = new WeakSet();

  public constructor(dialog: IDialogHost, windows: WindowRegistry, grants: FileGrantIssuer, runtime: RuntimeCaller, readDownloadsFolder: () => string, log: (text: string) => void) {
    this.dialog = dialog;
    this.windows = windows;
    this.grants = grants;
    this.runtime = runtime;
    this.readDownloadsFolder = readDownloadsFolder;
    this.log = log;
  }

  public async chooseFolderAsync(event: IIpcEvent): Promise<string | null> {
    const open = this.windows.findTrusted(event);
    if (Object.isNull(open) || !this.beginAsking(open))
      return null;
    try {
      const { canceled, filePaths: [folder] } = await this.dialog.showOpenDialog(open.window.id, { properties: [Resources.openDirectoryProperty] });
      return canceled || this.windows.find(event.sender.id) !== open ? null : folder ?? null;
    }
    finally {
      this.asking.delete(open);
    }
  }

  public async chooseFilePathAsync(event: IIpcEvent, options: unknown): Promise<string | null> {
    const open = this.windows.findTrusted(event);
    if (Object.isNull(open))
      return null;
    const choice = FilePathChoice.read(options);
    if (Object.isNull(choice)) {
      this.log(Resources.filePathChoiceRefused);
      return null;
    }
    if (!this.beginAsking(open))
      return null;
    try {
      const { canceled, filePaths: [file] } = await this.dialog.showOpenDialog(open.window.id, {
        properties: [Resources.openFileProperty],
        ...choice.extensions.length === 0 ? {} : { filters: [{ name: Resources.formatFileFilterName(choice.extensions), extensions: [...choice.extensions] }] },
        ...Object.isNull(choice.folder) ? {} : { defaultPath: choice.folder }
      });
      return canceled || this.windows.find(event.sender.id) !== open ? null : file ?? null;
    }
    finally {
      this.asking.delete(open);
    }
  }

  public async saveFileAsync(event: IIpcEvent, name: unknown, bytes: unknown): Promise<FileSaveOutcome> {
    const open = this.windows.findTrusted(event);
    if (Object.isNull(open)) {
      this.log(Resources.fileSaveUntrusted);
      return FileSaveOutcome.Failed;
    }
    if (!Object.isString(name) || !Resources.plainFileNamePattern.test(name) || Buffer.byteLength(name) > Resources.fileNameByteLimit ||
      !(bytes instanceof Uint8Array) || bytes.byteLength > Resources.fileSaveByteLimit) {
      this.log(Resources.fileSaveRefused);
      return FileSaveOutcome.Failed;
    }
    if (!this.beginAsking(open))
      return FileSaveOutcome.Failed;
    try {
      const { canceled, filePath } = await this.dialog.showSaveDialog(open.window.id, { defaultPath: await this.inDownloadsAsync(name), properties: [Resources.showOverwriteConfirmationProperty] });
      if (canceled || filePath.length === 0 || this.windows.find(event.sender.id) !== open)
        return FileSaveOutcome.Cancelled;
      await FileDialogs.replaceFileAsync(filePath, bytes);
      return FileSaveOutcome.Saved;
    }
    catch (error) {
      this.log(Resources.formatFileNotSaved(String(error)));
      return FileSaveOutcome.Failed;
    }
    finally {
      this.asking.delete(open);
    }
  }

  public async chooseFilesAsync(event: IIpcEvent, module: unknown, options: unknown, page: unknown): Promise<JsonObject | null> {
    const open = this.windows.findTrusted(event);
    const current = this.findGrantingPage(open, event, page);
    const request = FileGrantRequest.read(module, options);
    if (Object.isNull(open) || Object.isNull(current) || Object.isNull(request))
      return this.refuseFileGrant(current);
    if (!this.beginAsking(open))
      return IssuedFiles.none.toJson();
    try {
      const properties = request.isMultiple ? [Resources.openFileProperty, Resources.multiSelectionsProperty] : [Resources.openFileProperty];
      const { canceled, filePaths } = await this.dialog.showOpenDialog(open.window.id, { properties });
      if (canceled || this.windows.find(event.sender.id) !== open)
        return IssuedFiles.none.toJson();
      return await this.issueFilesAsync(event.sender.id, current, request, filePaths.slice(0, Resources.offeredFileLimit).map(t => OfferedFile.ofPath(t)));
    }
    finally {
      this.asking.delete(open);
    }
  }

  public async grantFilesAsync(event: IIpcEvent, module: unknown, files: unknown, options: unknown, page: unknown): Promise<JsonObject | null> {
    const current = this.findGrantingPage(this.windows.findTrusted(event), event, page);
    const request = FileGrantRequest.read(module, options);
    const offered = FileDialogs.readOfferedFiles(files);
    if (Object.isNull(current) || Object.isNull(request) || Object.isNull(offered))
      return this.refuseFileGrant(current);
    return await this.issueFilesAsync(event.sender.id, current, request, offered);
  }

  private beginAsking(open: OpenWindow): boolean {
    if (this.asking.has(open)) {
      this.log(Resources.dialogAlreadyOpen);
      return false;
    }
    this.asking.add(open);
    return true;
  }

  private findGrantingPage(open: OpenWindow | null, event: IIpcEvent, page: unknown): WindowPage | null {
    const current = this.windows.findPage(event.sender.id);
    return Object.isNull(open) || !Object.isString(page) || current?.id !== page ? null : current;
  }

  private refuseFileGrant(page: WindowPage | null): null {
    this.log(Object.isNull(page) ? Resources.fileGrantUntrusted : Resources.fileGrantRefused);
    return null;
  }

  private async issueFilesAsync(contentsId: number, page: WindowPage, request: FileGrantRequest, files: readonly OfferedFile[]): Promise<JsonObject> {
    const issued = await this.grants.issueAsync(files, request.module, contentsId, page.serial, request.lifetime);
    if (this.windows.findPage(contentsId) === page)
      return issued.toJson();
    void this.runtime.callAsync(ShellMethods.endFileGrants, new FileGrantsEnded(contentsId, page.serial).toJson());
    return IssuedFiles.none.toJson();
  }

  private async inDownloadsAsync(name: string): Promise<string> {
    let reason: string;
    try {
      const folder = this.readDownloadsFolder();
      if ((await stat(folder)).isDirectory())
        return join(folder, name);
      reason = Resources.formatNotAFolder(folder);
    }
    catch (error) {
      reason = String(error);
    }
    this.log(Resources.formatDownloadsNotFound(reason));
    return name;
  }

  private static readOfferedFiles(files: unknown): OfferedFile[] | null {
    if (!Array.isArray(files) || files.length === 0 || files.length > Resources.offeredFileLimit)
      return null;
    const offered = files.map((t: unknown) => OfferedFile.read(t)).filter(t => !Object.isNull(t));
    return offered.length === files.length ? offered : null;
  }

  private static async replaceFileAsync(file: string, bytes: Uint8Array): Promise<void> {
    const part = join(dirname(file), Resources.formatSavedFilePart(randomUUID()));
    try {
      await writeFile(part, bytes, { flag: Resources.createOnlyFlag, flush: true });
      await rename(part, file);
    }
    catch (error) {
      await rm(part, { force: true });
      throw error;
    }
  }
}
