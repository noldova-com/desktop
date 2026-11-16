/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import { ProductInfo } from "../../models/product-info.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";
import { LogFile } from "../diagnostics/log-file.js";
import type { OwnershipLock } from "../ownership/ownership-lock.js";

export class RuntimeLog {
  private readonly file: LogFile;
  private readonly error: Writable;
  private isClosed: boolean = false;
  private hasFailed: boolean = false;
  private passedOn: unknown = undefined;

  public readonly diagnostics: Writable;

  private constructor(file: LogFile, error: Writable) {
    this.file = file;
    this.error = error;
    this.diagnostics = new Writable({
      decodeStrings: false,
      write: (chunk: string | Buffer, _encoding, callback) => {
        const text = chunk.toString();
        this.record(text.endsWith(Resources.lineSeparator) ? text.slice(0, -Resources.lineSeparator.length) : text);
        callback();
      }
    });
  }

  public static async openAsync(lock: OwnershipLock, ownStartLogName: string | null, now?: () => Date, error: Writable = process.stderr, homeFolder: string = homedir()): Promise<RuntimeLog> {
    lock.requireHeld();
    const directory = lock.dataDirectory;
    await mkdir(directory.logsFolder, { recursive: true });
    const file = new LogFile(directory.runtimeLog, directory.previousRuntimeLog, new DiagnosticRedactor(homeFolder, [ProductInfo.current.name]), now);
    file.open();
    const log = new RuntimeLog(file, error);
    const stale = (await readdir(directory.logsFolder)).filter(t => Resources.startLogNamePattern.test(t) && t !== ownStartLogName);
    await Promise.allSettled(stale.map(t => rm(path.join(directory.logsFolder, t))));
    return log;
  }

  public writeLine(text: string): void {
    if (this.isClosed || this.hasFailed)
      return;

    try {
      this.file.append(this.file.format(text));
    }
    catch (failure) {
      this.fail(failure);
    }
  }

  public async closeAsync(): Promise<void> {
    if (this.isClosed)
      return;

    this.isClosed = true;
    await new Promise<void>(resolve => this.diagnostics.end(resolve));
    await this.file.flushAsync();
    if (!Object.isUndefined(this.passedOn))
      throw this.passedOn;
  }

  private record(text: string): void {
    if (!this.hasFailed)
      void this.file.appendAsync(this.file.format(text)).catch((failure: unknown) => {
        try {
          this.fail(failure);
        }
        catch (error) {
          this.passedOn = error;
        }
      });
  }

  private fail(failure: unknown): void {
    if (this.hasFailed)
      return;

    this.hasFailed = true;
    try {
      this.error.write(this.file.format(Resources.formatRuntimeLogUnavailable(String(failure))));
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.unwritableStreamCodes))
        throw error;
    }
  }
}
