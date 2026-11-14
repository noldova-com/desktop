/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { UpdateProcess } from "@noldova/desktop.protocol";

import type { IPosixProcessTableApi } from "../../interfaces/i-posix-process-table-api.js";
import type { IProcessTableReader } from "../../interfaces/i-process-table.reader.js";
import type { IWindowsProcessApi } from "../../interfaces/i-windows-process-api.js";
import type { ProcessTable } from "../../models/process-table.js";
import { Resources } from "../../resources.js";
import { PosixProcessApi } from "../process/posix-process-api.js";
import { PosixProcessTableReader } from "../process/posix-process-table.reader.js";
import { ProcessClock } from "../process/process-clock.js";
import { WindowsProcessApi } from "../process/windows-process-api.js";
import { WindowsProcessTableReader } from "../process/windows-process-table.reader.js";

export class ProcessPresence {
  private readonly createReader: () => IProcessTableReader;
  private reader: IProcessTableReader | null = null;

  public constructor(platform: string, posix: IPosixProcessTableApi, windows: IWindowsProcessApi) {
    this.createReader = () => platform === Resources.windowsPlatform
      ? new WindowsProcessTableReader(windows, ProcessClock.create(platform))
      : new PosixProcessTableReader(posix);
  }

  public static create(platform: string): ProcessPresence {
    return new ProcessPresence(platform, PosixProcessApi.create(platform), WindowsProcessApi.create());
  }

  public async stampAsync(processes: readonly (readonly [number, string])[]): Promise<readonly UpdateProcess[]> {
    if (processes.length === 0)
      return [];
    const table = await this.readTableAsync();
    return processes.flatMap(([processId, role]) => {
      const entry = table.find(processId);
      return Object.isUndefined(entry) ? [] : [new UpdateProcess(processId, entry.earliest, entry.latest, role)];
    });
  }

  public async isRunningAsync(process: UpdateProcess): Promise<boolean> {
    const entry = (await this.readTableAsync()).find(process.processId);
    return !Object.isUndefined(entry) && entry.earliest <= process.latest && process.earliest <= entry.latest;
  }

  private readTableAsync(): Promise<ProcessTable> {
    this.reader ??= this.createReader();
    return this.reader.readAsync();
  }
}
