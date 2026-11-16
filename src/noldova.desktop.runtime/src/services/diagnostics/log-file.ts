/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, closeSync, fstatSync, openSync, readSync, renameSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";

import "@noldova/context.core";

import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import type { DiagnosticRedactor } from "./diagnostic-redactor.js";
import { LogBatch } from "./log-batch.js";
import { LogWrite } from "./log-write.js";

export class LogFile {
  private readonly file: string;
  private readonly previousFile: string;
  private readonly redactor: DiagnosticRedactor;
  private readonly now: () => Date;
  private readonly limit: number;
  private readonly writeWait: number;
  private readonly queue: LogBatch[] = [];
  private readonly pause: Int32Array = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  private writing: Promise<void> | null = null;
  private written: LogWrite | null = null;
  private size: number = 0;
  private landed: number = 0;

  public constructor(
    file: string,
    previousFile: string,
    redactor: DiagnosticRedactor,
    now: () => Date = () => new Date(),
    limit: number = Resources.logSizeLimit,
    writeWait: number = Resources.logWriteWaitMilliseconds) {
    this.file = file;
    this.previousFile = previousFile;
    this.redactor = redactor;
    this.now = now;
    this.limit = limit;
    this.writeWait = writeWait;
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
    this.landed += length;
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
    if (!Object.isNull(this.written))
      this.waitForWrite(this.written);
    for (const batch of this.queue.splice(0)) {
      try {
        if (batch.isRollOver)
          this.rollOver();
        appendFileSync(this.file, batch.text, { mode: Resources.privateFileMode });
        this.landed += Buffer.byteLength(batch.text);
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
      const text = Buffer.from(taken.text, Resources.utf8Encoding);
      this.written = new LogWrite(text, this.landed);
      this.writing = appendFile(this.file, text, { mode: Resources.privateFileMode })
        .then(() => {
          this.landed += text.length;
          taken.resolve();
        }, (failure: unknown) => taken.reject(failure))
        .finally(() => {
          this.written = null;
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
    this.landed = 0;
  }

  private waitForWrite(write: LogWrite): void {
    const deadline = Date.now() + this.writeWait;
    while (!this.hasLanded(write) && Date.now() < deadline)
      Atomics.wait(this.pause, 0, 0, Resources.logWriteWaitPause);
  }

  private hasLanded(write: LogWrite): boolean {
    try {
      const handle = openSync(this.file, Resources.readFlag);
      try {
        const tail = Buffer.alloc(Math.max(0, fstatSync(handle).size - write.from));
        readSync(handle, tail, 0, tail.length, write.from);
        return tail.includes(write.text);
      }
      finally {
        closeSync(handle);
      }
    }
    catch {
      return true;
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
