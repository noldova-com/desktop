/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type BigIntStats, fstat } from "node:fs";
import { open, stat, truncate, writeFile } from "node:fs/promises";
import type { Writable } from "node:stream";
import { promisify } from "node:util";

import "@noldova/context.core";

import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import type { DiagnosticRedactor } from "./diagnostic-redactor.js";

export class StandardErrorCap implements AsyncDisposable {
  private static readonly readDescriptorStats: typeof fstat.__promisify__ = promisify(fstat);

  private readonly descriptor: number;
  private readonly files: readonly string[];
  private readonly previousFile: string;
  private readonly redactor: DiagnosticRedactor;
  private readonly diagnostics: Writable;
  private readonly limit: number;
  private readonly timer: NodeJS.Timeout;
  private checking: Promise<void> = Promise.resolve();

  private constructor(descriptor: number, files: readonly string[], previousFile: string, redactor: DiagnosticRedactor, diagnostics: Writable, limit: number,
    interval: number) {
    this.descriptor = descriptor;
    this.files = files;
    this.previousFile = previousFile;
    this.redactor = redactor;
    this.diagnostics = diagnostics;
    this.limit = limit;
    this.timer = setInterval(() => this.checkOnTimer(), interval).unref();
  }

  public static start(descriptor: number, files: readonly string[], previousFile: string, redactor: DiagnosticRedactor, diagnostics: Writable,
    limit: number = Resources.logSizeLimit, interval: number = Resources.errorsLogCheckInterval): StandardErrorCap {
    return new StandardErrorCap(descriptor, files, previousFile, redactor, diagnostics, limit, interval);
  }

  public static async keepAsync(file: string, previousFile: string, redactor: DiagnosticRedactor, limit: number = Resources.logSizeLimit): Promise<void> {
    const handle = await open(file, Resources.readFlag);
    try {
      const { size } = await handle.stat();
      const tail = Buffer.alloc(Math.min(size, limit));
      const { bytesRead } = await handle.read(tail, 0, tail.length, size - tail.length);
      await writeFile(previousFile, redactor.redact(tail.subarray(0, bytesRead).toString(Resources.utf8Encoding)), { mode: Resources.privateFileMode });
    }
    finally {
      await handle.close();
    }
  }

  public checkAsync(): Promise<void> {
    const next = this.checking.then(() => this.capAsync(), () => this.capAsync());
    this.checking = next;
    return next;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    clearInterval(this.timer);
    await this.checkReportedAsync();
  }

  private checkOnTimer(): void {
    void this.checkReportedAsync();
  }

  private async checkReportedAsync(): Promise<void> {
    try {
      await this.checkAsync();
    }
    catch (error) {
      this.diagnostics.write(Resources.formatErrorsCapFailed(String(error)));
    }
  }

  private async capAsync(): Promise<void> {
    try {
      const own = await StandardErrorCap.readDescriptorStats(this.descriptor, { bigint: true });
      if (own.size <= BigInt(this.limit))
        return;
      const file = await this.findAsync(own);
      if (Object.isUndefined(file))
        return;
      try {
        await StandardErrorCap.keepAsync(file, this.previousFile, this.redactor, this.limit);
      }
      finally {
        await truncate(file, 0);
      }
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.errorsCapSkippedCodes))
        throw error;
    }
  }

  private async findAsync(own: BigIntStats): Promise<string | undefined> {
    for (const file of this.files) {
      const other = await StandardErrorCap.statAsync(file);
      if (other?.dev === own.dev && other.ino === own.ino)
        return file;
    }
    return undefined;
  }

  private static async statAsync(file: string): Promise<BigIntStats | undefined> {
    try {
      return await stat(file, { bigint: true });
    }
    catch (error) {
      if (!SystemErrorCode.is(error, Resources.missingFileErrorCode))
        throw error;
      return undefined;
    }
  }
}
