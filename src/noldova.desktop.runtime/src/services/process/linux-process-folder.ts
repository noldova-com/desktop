/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ProcessTableRowUnreadableException } from "../../exceptions/process-table-row-unreadable.exception.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";

export class LinuxProcessFolder {
  private readonly folder: string;
  private readonly ticksPerSecond: number;
  private readonly read: (file: string) => Promise<string>;

  public constructor(folder: string, ticksPerSecond: number, read: (file: string) => Promise<string> = t => readFile(t, Resources.utf8Encoding)) {
    this.folder = folder;
    this.ticksPerSecond = ticksPerSecond;
    this.read = read;
  }

  public async readAsync(): Promise<readonly (readonly [number, number, number, number, number, number])[]> {
    const names = (await readdir(this.folder)).filter(t => Resources.processIdPattern.test(t));
    const rows: (readonly [number, number, number, number, number, number] | null)[] = [];
    for (let start = 0; start < names.length; start += Resources.processReadBatch)
      rows.push(...await Promise.all(names.slice(start, start + Resources.processReadBatch).map(t => this.readRowAsync(t))));
    return rows.filter(t => !Object.isNull(t));
  }

  private async readRowAsync(name: string): Promise<readonly [number, number, number, number, number, number] | null> {
    let text: string;
    try {
      text = await this.read(path.join(this.folder, name, Resources.processStatFile));
    }
    catch (error) {
      if (SystemErrorCode.isAny(error, Resources.processSkippedCodes))
        return null;
      throw error;
    }
    return this.parse(name, text.trim());
  }

  private parse(name: string, text: string): readonly [number, number, number, number, number, number] | null {
    const end = text.lastIndexOf(Resources.processNameEnd);
    const fields = text.slice(end + 1).trim().split(Resources.processStatFieldSeparator);
    const [parentId, groupId, terminal, ticks] = Resources.processStatFields.map(t => Number(fields[t]));
    const values = [Number(name), parentId, groupId === Resources.processEndingGroupId ? 0 : groupId, terminal, ticks];
    if (end < 0 || !values.every(t => Number.isInteger(t) && Number(t) >= 0))
      throw new ProcessTableRowUnreadableException(text);
    if (fields[Resources.processStateField] === Resources.processDeadState || groupId === Resources.processEndingGroupId)
      return null;
    const zombie = fields[Resources.processStateField] === Resources.processZombieState ? 1 : 0;
    return [Number(name), Number(parentId), Number(groupId), Number(terminal), Math.round(Number(ticks) * Resources.millisecondsPerSecond / this.ticksPerSecond), zombie];
  }
}
