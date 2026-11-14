/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants, type RmOptions } from "node:fs";
import { lstat, open, rm } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Failure, FailureCode, type FileGrant } from "@noldova/desktop.protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IIssuedGrant } from "../../interfaces/i-issued-grant.js";
import { GrantedFile } from "../../models/granted-file.js";
import type { ClientClosure } from "../../models/client-closure.js";
import type { RequestContext } from "../../models/request-context.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import type { ClientClosures } from "../endpoint/client-closures.js";
import { FileIdentity } from "./file-identity.js";

export class FileGrantTable {
  private static readonly OPEN_FLAGS: number = constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW;

  private readonly grants: Map<string, IIssuedGrant> = new Map();
  private readonly removals: Set<Promise<void>> = new Set();
  private readonly stagedFolder: string;
  private readonly now: () => number;
  private readonly removeAsync: (target: string, options: RmOptions) => Promise<void>;
  private timer: NodeJS.Timeout | null = null;

  public constructor(stagedFolder: string, closures: ClientClosures, now: () => number = () => performance.now(),
    removeAsync: (target: string, options: RmOptions) => Promise<void> = rm) {
    this.stagedFolder = path.resolve(stagedFolder);
    this.now = now;
    this.removeAsync = removeAsync;
    closures.listen(t => this.close(t));
  }

  public get count(): number {
    return this.grants.size;
  }

  public issue(connection: number, file: FileGrant): void {
    this.add(connection, file, false);
  }

  public share(connection: number, file: FileGrant): void {
    this.add(connection, file, true);
  }

  public resolve(connection: number, grant: string): FileGrant {
    this.sweep();
    const issued = this.grants.get(grant);
    if (Object.isUndefined(issued) || !issued.isShared || issued.connection !== connection)
      throw FileGrantTable.fail(FailureCode.NotFound, Resources.fileShareUnknown);
    return issued.file;
  }

  public discard(request: RequestContext, grants: readonly string[]): void {
    this.end(t => grants.includes(t.file.grant) && FileGrantTable.isOf(t, request));
  }

  public endPage(connection: number, window: number, page: number): void {
    this.end(t => t.connection === connection && t.file.window === window && t.file.page === page);
  }

  public async redeemAsync(module: string, grant: string, request: RequestContext): Promise<GrantedFile> {
    this.sweep();
    const issued = this.grants.get(grant);
    if (Object.isUndefined(issued) || issued.isShared || issued.file.module !== module || !FileGrantTable.isOf(issued, request))
      throw FileGrantTable.fail(FailureCode.NotFound, Resources.fileGrantUnknown);
    this.grants.delete(grant);
    this.schedule();
    const opening = this.openAsync(issued.file);
    this.track(opening.then(() => undefined, () => undefined));
    return opening;
  }

  public async clearStagedAsync(): Promise<void> {
    while (this.removals.size > 0)
      await Promise.all(this.removals);
    await this.removeAsync(this.stagedFolder, { recursive: true, force: true });
  }

  public dispose(): void {
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
    this.timer = null;
    this.end(() => true);
  }

  private async openAsync(file: FileGrant): Promise<GrantedFile> {
    try {
      if (!(await lstat(file.path, { bigint: true })).isFile())
        throw FileGrantTable.fail(FailureCode.InvalidParams, Resources.grantedFileNotRegular);
      const handle = await open(file.path, FileGrantTable.OPEN_FLAGS);
      if (FileIdentity.of(await handle.stat({ bigint: true })) !== file.identity) {
        await handle.close();
        throw FileGrantTable.fail(FailureCode.Conflict, Resources.grantedFileChanged);
      }
      return new GrantedFile(file.name, file.mediaType, file.size, handle, this.stagedPathOf(file));
    }
    catch (error) {
      await this.removeStagedAsync(file);
      if (error instanceof MethodFailureException || !(error instanceof Error && Resources.nodeErrorCodeField in error))
        throw error;
      throw FileGrantTable.fail(FailureCode.Conflict, Resources.formatGrantedFileUnreadable(String(error.code)));
    }
  }

  private add(connection: number, file: FileGrant, isShared: boolean): void {
    this.sweep();
    if (this.grants.has(file.grant))
      throw FileGrantTable.fail(FailureCode.Conflict, Resources.fileGrantTaken);
    if ([...this.grants.values()].filter(t => t.connection === connection && t.file.window === file.window).length >= Resources.maximumWindowFileGrants)
      throw FileGrantTable.fail(FailureCode.Conflict, Resources.formatTooManyFileGrants(file.window, Resources.maximumWindowFileGrants));
    this.grants.set(file.grant, { connection, file, expires: this.now() + file.lifetime, isShared });
    this.schedule();
  }

  private close(closure: ClientClosure): void {
    this.end(t => t.connection === closure.connection && (Object.isNull(closure.window) || t.file.window === closure.window));
  }

  private sweep(): void {
    const now = this.now();
    this.end(t => t.expires <= now);
  }

  private end(predicate: (grant: IIssuedGrant) => boolean): void {
    const ended = [...this.grants.values()].filter(predicate);
    for (const grant of ended) {
      this.grants.delete(grant.file.grant);
      this.track(this.removeStagedAsync(grant.file));
    }
    if (ended.length > 0)
      this.schedule();
  }

  private track(work: Promise<void>): void {
    const tracked = work.finally(() => this.removals.delete(tracked));
    this.removals.add(tracked);
  }

  private schedule(): void {
    if (!Object.isNull(this.timer))
      clearTimeout(this.timer);
    this.timer = null;
    const next = Math.min(...[...this.grants.values()].map(t => t.expires));
    if (!Number.isFinite(next))
      return;
    this.timer = setTimeout(() => {
      this.sweep();
      this.schedule();
    }, Math.max(0, next - this.now()));
    this.timer.unref();
  }

  private stagedPathOf(file: FileGrant): string | null {
    return file.isStaged && path.dirname(path.resolve(file.path)) === this.stagedFolder ? file.path : null;
  }

  private async removeStagedAsync(file: FileGrant): Promise<void> {
    const staged = this.stagedPathOf(file);
    if (!Object.isNull(staged))
      await this.removeAsync(staged, { force: true }).catch((error: unknown) => {
        if (!SystemErrorCode.isAny(error, Resources.stagedKeptErrorCodes))
          throw error;
      });
  }

  private static isOf(grant: IIssuedGrant, request: RequestContext): boolean {
    return grant.connection === request.connection && grant.file.window === request.window && grant.file.page === request.page;
  }

  private static fail(code: FailureCode, message: string): MethodFailureException {
    return new MethodFailureException(new Failure(code, message));
  }
}
