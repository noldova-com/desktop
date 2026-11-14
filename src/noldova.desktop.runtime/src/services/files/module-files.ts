/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { Failure, FailureCode, FileGrant, ShellClients } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IFileShareOptions } from "../../interfaces/i-file-share-options.js";
import type { IResolvedFile } from "../../interfaces/i-resolved-file.js";
import type { IRuntimeFiles } from "../../interfaces/i-runtime-files.js";
import type { GrantedFile } from "../../models/granted-file.js";
import type { RequestContext } from "../../models/request-context.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import type { FileGrantTable } from "./file-grant-table.js";
import { FileIdentity } from "./file-identity.js";

export class ModuleFiles implements IRuntimeFiles {
  private readonly moduleId: string;
  private readonly table: FileGrantTable;
  private readonly folders: readonly string[];

  public constructor(moduleId: string, table: FileGrantTable, folders: readonly string[]) {
    this.moduleId = moduleId;
    this.table = table;
    this.folders = folders;
  }

  public redeemAsync(grant: string, request: RequestContext): Promise<GrantedFile> {
    return this.table.redeemAsync(this.moduleId, grant, request);
  }

  public async shareAsync(file: string, request: RequestContext, options: IFileShareOptions = {}): Promise<string> {
    const { window, page } = request;
    if (request.client !== ShellClients.mainProcess || Object.isNull(window) || Object.isNull(page))
      throw ModuleFiles.fail(FailureCode.Unauthorized, Resources.fileSharesNotFromPage);
    const { path: real, stats } = await ModuleFiles.readAsync(file);
    const folders = await Promise.all(this.folders.map(t => realpath(t).catch((error: unknown) => {
      if (!SystemErrorCode.isAny(error, Resources.missingPathCodes))
        throw error;
      return null;
    })));
    if (!folders.some(t => !Object.isNull(t) && ModuleFiles.isInside(t, real)))
      throw ModuleFiles.fail(FailureCode.InvalidParams, Resources.sharedFileOutside);
    if (!stats.isFile())
      throw ModuleFiles.fail(FailureCode.InvalidParams, Resources.sharedFileNotRegular);
    const grant = randomBytes(Resources.grantByteLength).toString(Resources.hexEncoding);
    this.table.share(request.connection, new FileGrant(grant, real, path.basename(real), options.mediaType ?? Resources.sharedMediaType, Number(stats.size),
      FileIdentity.of(stats), this.moduleId, window, page, options.lifetime ?? FileGrant.maximumLifetime, false));
    return grant;
  }

  private static async readAsync(file: string): Promise<IResolvedFile> {
    try {
      const real = await realpath(file);
      return { path: real, stats: await lstat(real, { bigint: true }) };
    }
    catch (error) {
      const code = SystemErrorCode.of(error);
      if (Object.isNull(code) || !Resources.missingPathCodes.includes(code))
        throw error;
      throw ModuleFiles.fail(FailureCode.NotFound, Resources.formatSharedFileUnreadable(code), new ExceptionOptions(error));
    }
  }

  private static isInside(folder: string, file: string): boolean {
    const relative = path.relative(folder, file);
    return !path.isAbsolute(relative) && relative.split(path.sep)[0] !== Resources.parentFolder;
  }

  private static fail(code: FailureCode, message: string, options?: ExceptionOptions): MethodFailureException {
    return new MethodFailureException(new Failure(code, message), options);
  }
}
