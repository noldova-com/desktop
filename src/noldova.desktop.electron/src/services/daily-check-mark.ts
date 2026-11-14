/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class DailyCheckMark {
  private readonly file: string;
  private readonly now: () => Date;
  private readonly log: (text: string) => void;
  private held: string | undefined;
  private turn: Promise<unknown> = Promise.resolve();

  public constructor(file: string, now: () => Date, log: (text: string) => void) {
    this.file = file;
    this.now = now;
    this.log = log;
    this.held = undefined;
  }

  public static formatDate(date: Date): string {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(t => String(t).padStart(Resources.datePadLength, Resources.datePadCharacter)).join(Resources.dateSeparator);
  }

  public takeAsync(): Promise<boolean> {
    return this.queueAsync(() => this.takeNowAsync());
  }

  public recordAsync(): Promise<void> {
    return this.queueAsync(() => this.recordNowAsync());
  }

  public release(): void {
    this.held = undefined;
  }

  private queueAsync<T>(step: () => Promise<T>): Promise<T> {
    const result = this.turn.then(step);
    this.turn = result;
    return result;
  }

  private async takeNowAsync(): Promise<boolean> {
    const today = DailyCheckMark.formatDate(this.now());
    if (this.held === today || await readFile(this.file, Resources.textEncoding).then(t => t.trim(), () => null) === today)
      return false;
    this.held = today;
    return true;
  }

  private async recordNowAsync(): Promise<void> {
    const date = this.held;
    if (Object.isUndefined(date))
      return;
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, date, Resources.textEncoding);
    }
    catch (error) {
      this.log(Resources.formatDailyCheckNotRecorded(String(error)));
    }
  }
}
