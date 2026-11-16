/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";

import "@noldova/context.core";

import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import type { DiagnosticRedactor } from "./diagnostic-redactor.js";
import { LogBatch } from "./log-batch.js";

export class LogFile {
  private readonly file: string;
  private readonly previousFile: string;
  private readonly redactor: DiagnosticRedactor;
  private readonly now: () => Date;
  private readonly limit: number;
  private readonly queue: LogBatch[] = [];
  private readonly pause: Int32Array = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  private writing: Promise<void> | null = null;
  private size: number = 0;
  private end: number = 0;

  public constructor(
    file: string,
    previousFile: string,
    redactor: DiagnosticRedactor,
    now: () => Date = () => new Date(),
    limit: number = Resources.logSizeLimit) {
    this.file = file;
    this.previousFile = previousFile;
    this.redactor = redactor;
    this.now = now;
    this.limit = limit;
  }

  public format(text: string): string {
    const bytes = Buffer.from(Resources.formatLogLine(this.now().toISOString(), this.redactor.redact(text)), Resources.utf8Encoding);
    const room = Math.floor(this.limit / Resources.logRecordShare) - Resources.lineSeparator.length;
    let end = Math.min(bytes.length, room);
    while (end < bytes.length && (bytes.readUInt8(end) & Resources.utf8ContinuationMask) === Resources.utf8ContinuationBits)
      end--;

    return `${bytes.toString(Resources.utf8Encoding, 0, end)}${Resources.lineSeparator}`;
  }

  public open(): void {
    this.flush();
    this.rollOver();
    this.size = 0;
  }

  public append(line: string): void {
    this.flush();
    const length = Buffer.byteLength(line);
    if (this.size > 0 && this.size + length > this.limit)
      this.open();

    appendFileSync(this.file, line, { mode: Resources.privateFileMode });
    this.size += length;
    this.end += length;
  }

  public appendAsync(line: string): Promise<void> {
    const length = Buffer.byteLength(line);
    const isRollOver = this.size > 0 && this.size + length > this.limit;
    this.size = (isRollOver ? 0 : this.size) + length;
    const last = this.queue.at(-1);
    const batch = Object.isUndefined(last) || isRollOver ? new LogBatch(isRollOver) : last;
    if (batch !== last)
      this.queue.push(batch);
    batch.text += line;
    this.drain();
    return batch.written;
  }

  public flush(): void {
    if (!Object.isNull(this.writing))
      this.waitForWrite();
    for (const batch of this.queue.splice(0)) {
      try {
        if (batch.isRollOver)
          this.rollOver();
        appendFileSync(this.file, batch.text, { mode: Resources.privateFileMode });
        this.end += Buffer.byteLength(batch.text);
        batch.resolve();
      }
      catch (failure) {
        batch.reject(failure);
      }
    }
  }

  public async flushAsync(): Promise<void> {
    while (!Object.isNull(this.writing))
      await this.writing;
  }

  private drain(): void {
    for (let batch = this.takeNext(); !Object.isUndefined(batch); batch = this.takeNext()) {
      const taken = batch;
      try {
        if (taken.isRollOver)
          this.rollOver();
      }
      catch (failure) {
        taken.reject(failure);
        continue;
      }
      this.end += Buffer.byteLength(taken.text);
      this.writing = appendFile(this.file, taken.text, { mode: Resources.privateFileMode })
        .then(() => taken.resolve(), (failure: unknown) => taken.reject(failure))
        .finally(() => {
          this.writing = null;
          this.drain();
        });
    }
  }

  private takeNext(): LogBatch | undefined {
    return Object.isNull(this.writing) ? this.queue.shift() : undefined;
  }

  private rollOver(): void {
    this.replacePrevious();
    writeFileSync(this.file, String.empty, { mode: Resources.privateFileMode });
    this.end = 0;
  }

  private waitForWrite(): void {
    const deadline = Date.now() + Resources.logWriteWaitMilliseconds;
    while (Date.now() < deadline && this.readSize() < this.end)
      Atomics.wait(this.pause, 0, 0, Resources.logWriteWaitPause);
  }

  private readSize(): number {
    try {
      return statSync(this.file).size;
    }
    catch {
      return this.end;
    }
  }

  private replacePrevious(): void {
    try {
      renameSync(this.file, this.previousFile);
    }
    catch (failure) {
      if (!SystemErrorCode.is(failure, Resources.missingFileErrorCode))
        throw failure;
    }
  }
}
