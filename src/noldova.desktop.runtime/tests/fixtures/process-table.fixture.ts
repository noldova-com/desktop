/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IPosixProcessTableApi } from "@noldova/desktop.runtime";

import { ProcessSupervisorFixture } from "./process-supervisor.fixture.js";

export class ProcessTableFixture implements IPosixProcessTableApi {
  private static readonly ROW: RegExp = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(?:(?:(\d+)-)?(\d+):)?(\d+):(\d+)(?:\s+(\d+))?(?:\s+(Z))?\s*$/u;

  private readonly tables: (string | Error | (() => Promise<string>))[];
  private readonly now: () => number;

  public reads: number = 0;

  public constructor(tables: readonly (string | Error | (() => Promise<string>))[], now: () => number = () => ProcessSupervisorFixture.LINUX.now()) {
    this.tables = [...tables];
    this.now = now;
  }

  public async listProcessesAsync(): Promise<readonly (readonly [number, number, number, number, number, number?])[]> {
    this.reads++;
    const table = this.tables.shift() ?? String.empty;
    if (table instanceof Error)
      throw table;
    const text = Object.isFunction(table) ? await table() : table;
    return text.split("\n").filter(t => t.trim().length > 0).map(t => this.parse(t));
  }

  private parse(row: string): readonly [number, number, number, number, number, number?] {
    const match = ProcessTableFixture.ROW.exec(row);
    if (Object.isNull(match))
      throw new Error(`The process table has a row that could not be read: ${row}`);
    const [, processId, parentId, groupId, days, hours, minutes, seconds, terminal, zombie] = match;
    const elapsed = (((Number(days ?? 0) * 24 + Number(hours ?? 0)) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000;
    const values = [Number(processId), Number(parentId), Number(groupId), Number(terminal ?? 0), this.now() - elapsed] as const;
    return Object.isUndefined(zombie) ? values : [...values, 1];
  }
}
