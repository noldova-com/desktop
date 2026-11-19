/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";
import type { Writable } from "node:stream";

import { type DataDirectory, type DiagnosticRedactor, LogFile } from "@noldova/desktop.runtime";

import type { IMainProcessLog } from "../interfaces/i-main-process-log.js";
import { Resources } from "../resources.js";
import { FilePresence } from "./file-presence.js";

export class MainProcessLog implements IMainProcessLog {
  private readonly directory: DataDirectory;
  private readonly error: Writable;
  private readonly file: LogFile;
  private readonly kept: string[] = [];
  private isOpen: boolean = false;
  private hasOpened: boolean = false;
  private isOpening: boolean = false;

  public constructor(directory: DataDirectory, error: Writable, redactor: DiagnosticRedactor, now: () => Date = () => new Date()) {
    this.directory = directory;
    this.error = error;
    this.file = new LogFile(directory.mainProcessLog, directory.previousMainProcessLog, redactor, now);
  }

  public async openAsync(): Promise<void> {
    if (this.hasOpened)
      return;
    this.hasOpened = true;
    this.isOpening = true;
    try {
      if (!await FilePresence.existsAsync(this.directory.logsFolder))
        await mkdir(this.directory.logsFolder);
      this.file.open();
      this.isOpen = true;
    }
    catch (failure) {
      this.write(Resources.formatMainProcessLogUnavailable(String(failure)));
    }
    this.isOpening = false;
    for (const line of this.kept.splice(0))
      this.append(line);
  }

  public write(text: string): void {
    const line = this.file.format(text);
    this.error.write(line);
    if (this.isOpening)
      this.kept.push(line);
    else
      this.append(line);
  }

  public writeKept(text: string): void {
    const line = this.file.format(text);
    this.error.write(line);
    if (this.hasOpened && !this.isOpening)
      this.append(line);
    else
      this.kept.push(line);
  }

  public writeShared(text: string): void {
    const line = this.file.format(text);
    this.error.write(line);
    try {
      this.file.append(line);
    }
    catch (failure) {
      this.error.write(this.file.format(Resources.formatMainProcessLogUnavailable(String(failure))));
    }
  }

  public flush(): void {
    this.file.flush();
  }

  public async closeAsync(): Promise<void> {
    this.isOpen = false;
    await this.file.closeAsync();
  }

  private append(line: string): void {
    if (this.isOpen)
      void this.file.appendAsync(line).catch((failure: unknown) => this.fail(failure));
  }

  private fail(failure: unknown): void {
    if (!this.isOpen)
      return;
    this.isOpen = false;
    this.write(Resources.formatMainProcessLogUnavailable(String(failure)));
  }
}
