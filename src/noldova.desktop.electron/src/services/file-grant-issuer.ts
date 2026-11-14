/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";
import type { Stats } from "node:fs";
import { lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { FileGrant, type Response } from "@noldova/desktop.protocol";
import { FileIdentity } from "@noldova/desktop.runtime";

import type { IShownPathFiles } from "../interfaces/i-shown-path-files.js";
import { IssuedFiles } from "../models/issued-files.js";
import type { OfferedFile } from "../models/offered-file.js";
import { ErrorCode } from "../models/error-code.js";
import { Resources } from "../resources.js";
import { ShownFilePolicy } from "./shown-file-policy.js";

export class FileGrantIssuer {
  private readonly stagedFolder: string;
  private readonly platform: string;
  private readonly files: IShownPathFiles;
  private readonly grantAsync: (grant: FileGrant) => Promise<Response>;
  private readonly drawGrant: () => string;
  private issuing: Promise<void> = Promise.resolve();

  public constructor(stagedFolder: string, platform: string, files: IShownPathFiles, grantAsync: (grant: FileGrant) => Promise<Response>,
    drawGrant: () => string = () => randomBytes(Resources.grantByteLength).toString(Resources.hexEncoding)) {
    this.stagedFolder = stagedFolder;
    this.platform = platform;
    this.files = files;
    this.grantAsync = grantAsync;
    this.drawGrant = drawGrant;
  }

  public issueAsync(files: readonly OfferedFile[], module: string, window: number, page: number, lifetime: number): Promise<IssuedFiles> {
    const issued = this.issuing.then(() => this.issueInTurnAsync(files, module, window, page, lifetime));
    this.issuing = issued.then(() => undefined, () => undefined);
    return issued;
  }

  private async issueInTurnAsync(files: readonly OfferedFile[], module: string, window: number, page: number, lifetime: number): Promise<IssuedFiles> {
    const granted: JsonObject[] = [];
    const refused: string[] = [];
    let pasted = 0;
    let staged = files.some(t => !Object.isNull(t.bytes)) ? await this.measureStagedAsync() : 0;
    for (const file of files) {
      const grant = this.drawGrant();
      let issued: FileGrant | string;
      if (!Object.isNull(file.path))
        issued = await this.grantPathAsync(grant, file, file.path, module, window, page, lifetime);
      else if (Object.isNull(file.bytes) || pasted + file.size > Resources.pastedByteLimit)
        issued = Resources.pastedFileTooLarge;
      else if (staged + file.size > Resources.stagedByteLimit)
        issued = Resources.stagedFolderFull;
      else {
        pasted += file.size;
        staged += file.size;
        issued = await this.grantBytesAsync(grant, file, file.bytes, module, window, page, lifetime);
      }
      if (Object.isString(issued))
        refused.push(Resources.formatFileNotGranted(file.name, issued));
      else
        granted.push({ [Resources.grantField]: grant, [Resources.nameField]: issued.name, [Resources.mediaTypeField]: issued.mediaType, [Resources.sizeField]: issued.size });
    }
    return new IssuedFiles(granted, refused);
  }

  private async grantPathAsync(grant: string, file: OfferedFile, filePath: string, module: string, window: number, page: number, lifetime: number): Promise<FileGrant | string> {
    const refusal = ShownFilePolicy.findPathRefusal(filePath, this.platform, Resources.offeredFileNotLocal);
    if (!Object.isNull(refusal))
      return refusal;
    const found = await ShownFilePolicy.findTargetAsync(filePath, this.platform, this.files);
    if (Object.isNull(found))
      return Resources.shownFileMissing;
    if (Object.isNull(found.status))
      return Resources.offeredFileLinkElsewhere;
    let issued: FileGrant;
    try {
      const real = await this.files.realpath(found.path);
      const realRefusal = ShownFilePolicy.findPathRefusal(real, this.platform, Resources.offeredFileNotLocal);
      if (!Object.isNull(realRefusal))
        return realRefusal;
      const stats = await lstat(real, { bigint: true });
      if (!stats.isFile())
        return Resources.offeredFileNotRegular;
      issued = new FileGrant(grant, real, file.name, file.mediaType, Number(stats.size), FileIdentity.of(stats), module, window, page, lifetime, false);
    }
    catch (error) {
      return Resources.formatOfferedFileUnreadable(FileGrantIssuer.codeOf(error));
    }
    return await this.sendAsync(issued);
  }

  private async grantBytesAsync(grant: string, file: OfferedFile, bytes: Uint8Array, module: string, window: number, page: number, lifetime: number): Promise<FileGrant | string> {
    const copy = path.join(this.stagedFolder, grant);
    try {
      await mkdir(this.stagedFolder, { recursive: true, mode: Resources.stagedFolderMode });
      await writeFile(copy, bytes, { flag: Resources.createOnlyFlag, mode: Resources.stagedFileMode });
    }
    catch (error) {
      return Resources.formatOfferedFileUnstaged(FileGrantIssuer.codeOf(error));
    }
    const stats = await lstat(copy, { bigint: true });
    const issued = await this.sendAsync(new FileGrant(grant, copy, file.name, file.mediaType, file.size, FileIdentity.of(stats), module, window, page, lifetime, true));
    if (Object.isString(issued))
      await rm(copy, { force: true });
    return issued;
  }

  private async sendAsync(grant: FileGrant): Promise<FileGrant | string> {
    const response = await this.grantAsync(grant);
    return response.failure?.message ?? grant;
  }

  private async measureStagedAsync(): Promise<number> {
    const names = await readdir(this.stagedFolder).catch(() => []);
    const measured = await Promise.allSettled(names.map(t => lstat(path.join(this.stagedFolder, t))));
    return measured.filter((t): t is PromiseFulfilledResult<Stats> => t.status === "fulfilled").reduce((total, t) => total + t.value.size, 0);
  }

  private static codeOf(error: unknown): string {
    const code = ErrorCode.of(error);
    if (Object.isUndefined(code))
      throw error;
    return code;
  }
}
