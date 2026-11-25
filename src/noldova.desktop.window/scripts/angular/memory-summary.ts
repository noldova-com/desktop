/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class MemorySummary {
  private static readonly POOL: RegExp = /^pool (\d+)$/u;
  private static readonly PROCESS: RegExp = /^process (\S+) \d+ (\d+) (\d+)$/u;
  private static readonly BYTES_PER_MEGABYTE: number = 1024 * 1024;
  private static readonly NO_PROCESSES: string = "no chrome or node process";

  public static format(text: string): string {
    let pool: number | null = null;
    const processes = new Map<string, { count: number; handles: number; workingSet: number }>();
    for (const line of text.split(/\r?\n/u).map(t => t.trim())) {
      const poolMatch = MemorySummary.POOL.exec(line);
      if (!Object.isNull(poolMatch)) {
        pool = Number(poolMatch[1]);
        continue;
      }
      const processMatch = MemorySummary.PROCESS.exec(line);
      if (Object.isNull(processMatch))
        continue;
      const name = processMatch[1] ?? String.empty;
      const total = processes.get(name) ?? { count: 0, handles: 0, workingSet: 0 };
      processes.set(name, { count: total.count + 1, handles: total.handles + Number(processMatch[2]), workingSet: total.workingSet + Number(processMatch[3]) });
    }
    const named = [...processes.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, t]) => `${name} ${t.count} ${t.count === 1 ? "process" : "processes"}, ${t.handles} handles, ${MemorySummary.megabytes(t.workingSet)} working set`);
    return `non-paged pool ${Object.isNull(pool) ? "unread" : MemorySummary.megabytes(pool)}; ${named.length === 0 ? MemorySummary.NO_PROCESSES : named.join("; ")}`;
  }

  private static megabytes(bytes: number): string {
    return `${(bytes / MemorySummary.BYTES_PER_MEGABYTE).toFixed(1)} MB`;
  }
}
