/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, close, closeSync, fstatSync, open, openSync, readSync, renameSync, write, writeFileSync } from "node:fs";

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
  private opening: LogBatch | null = null;
  private written: LogWrite | null = null;
  private size: number = 0;
  private landed: number = 0;
  private generation: number = 0;

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
    const opening = this.opening;
    this.opening = null;
    if (!Object.isNull(opening))
      this.writeAtOnce(opening, false);
    for (const batch of this.queue.splice(0))
      this.writeAtOnce(batch, batch.isRollOver);
  }

  public async flushAsync(): Promise<void> {
    while (!Object.isNull(this.writing))
      await this.writing;
  }

  private writeAtOnce(batch: LogBatch, isRollOver: boolean): void {
    try {
      if (isRollOver)
        this.rollOver();
      appendFileSync(this.file, batch.text, { mode: Resources.privateFileMode });
      this.landed += Buffer.byteLength(batch.text);
      batch.resolve();
    }
    catch (failure) {
      batch.reject(failure);
    }
  }

  private drain(): void {
    for (let batch = this.takeNext(); !Object.isUndefined(batch); batch = this.takeNext()) {
      if (this.rollOverFor(batch))
        this.start(batch);
    }
  }

  private rollOverFor(batch: LogBatch): boolean {
    try {
      if (batch.isRollOver)
        this.rollOver();
      return true;
    }
    catch (failure) {
      batch.reject(failure);
      return false;
    }
  }

  private start(batch: LogBatch): void {
    const settled = Promise.withResolvers<void>();
    this.opening = batch;
    this.writing = settled.promise;
    open(this.file, Resources.appendFlag, Resources.privateFileMode, (failure, handle) => {
      const isTakenBack = this.opening !== batch;
      this.opening = null;
      if (!Object.isNull(failure)) {
        this.settle(settled);
        batch.reject(failure);
      }
      else if (isTakenBack)
        close(handle, () => this.settle(settled));
      else
        this.write(batch, handle, settled);
    });
  }

  private write(batch: LogBatch, handle: number, settled: PromiseWithResolvers<void>): void {
    const text = Buffer.from(batch.text, Resources.utf8Encoding);
    const generation = this.generation;
    this.written = new LogWrite(text, this.landed);
    LogFile.writeAll(handle, text, failure => close(handle, closeFailure => {
      if (Object.isNull(failure) && this.generation === generation)
        this.landed += text.length;
      this.settle(settled);
      const error = failure ?? closeFailure;
      if (Object.isNull(error))
        batch.resolve();
      else
        batch.reject(error);
    }));
  }

  private settle(settled: PromiseWithResolvers<void>): void {
    this.written = null;
    this.writing = null;
    this.drain();
    settled.resolve();
  }

  private takeNext(): LogBatch | undefined {
    return Object.isNull(this.writing) ? this.queue.shift() : undefined;
  }

  private rollOver(): void {
    this.replacePrevious();
    writeFileSync(this.file, String.empty, { mode: Resources.privateFileMode });
    this.landed = 0;
    this.generation++;
  }

  private waitForWrite(pending: LogWrite): void {
    const deadline = Date.now() + this.writeWait;
    while (!this.hasLanded(pending) && Date.now() < deadline)
      Atomics.wait(this.pause, 0, 0, Resources.logWriteWaitPause);
  }

  private hasLanded(pending: LogWrite): boolean {
    try {
      const handle = openSync(this.file, Resources.readFlag);
      try {
        const tail = Buffer.alloc(Math.max(0, fstatSync(handle).size - pending.from));
        readSync(handle, tail, 0, tail.length, pending.from);
        return tail.includes(pending.text);
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

  private static writeAll(handle: number, text: Buffer, done: (failure: NodeJS.ErrnoException | null) => void): void {
    write(handle, text, (failure, written) => {
      if (Object.isNull(failure) && written < text.length)
        LogFile.writeAll(handle, text.subarray(written), done);
      else
        done(failure);
    });
  }
}
