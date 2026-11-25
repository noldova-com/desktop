/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class MemorySummary {
  private static readonly HEADER: string = "\"(PDH-CSV";
  private static readonly SEPARATOR: string = "\",\"";
  private static readonly POOL: RegExp = /\\Memory\\Pool Nonpaged Bytes$/u;
  private static readonly PROCESS: RegExp = /\\Process\(((?:chrome[^)#]*)|node)(?:#\d+)?\)\\(Handle Count|Working Set)$/u;
  private static readonly HANDLES: string = "Handle Count";
  private static readonly BYTES_PER_MEGABYTE: number = 1024 * 1024;
  private static readonly NO_PROCESSES: string = "no chrome or node process";

  public static format(text: string): string {
    const lines = text.split(/\r?\n/u).map(t => t.trim());
    const header = lines.findIndex(t => t.startsWith(MemorySummary.HEADER));
    const [head, row] = header < 0 ? [] : lines.slice(header, header + 2);
    const paths = Object.isUndefined(head) ? [] : MemorySummary.cells(head);
    const values = Object.isUndefined(row) ? [] : MemorySummary.cells(row).map(t => Number.parseFloat(t));
    let pool: number | null = null;
    const processes = new Map<string, { count: number; handles: number; workingSet: number }>();
    for (const [index, path] of paths.entries()) {
      const value = values[index];
      if (Object.isUndefined(value) || Number.isNaN(value))
        continue;
      if (MemorySummary.POOL.test(path)) {
        pool = value;
        continue;
      }
      const match = MemorySummary.PROCESS.exec(path);
      if (Object.isNull(match))
        continue;
      const name = match[1] ?? String.empty;
      const total = processes.get(name) ?? { count: 0, handles: 0, workingSet: 0 };
      processes.set(name, match[2] === MemorySummary.HANDLES
        ? { ...total, count: total.count + 1, handles: total.handles + value }
        : { ...total, workingSet: total.workingSet + value });
    }
    const named = [...processes.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, t]) => `${name} ${t.count} ${t.count === 1 ? "process" : "processes"}, ${t.handles} handles, ${MemorySummary.megabytes(t.workingSet)} working set`);
    return `non-paged pool ${Object.isNull(pool) ? "unread" : MemorySummary.megabytes(pool)}; ${named.length === 0 ? MemorySummary.NO_PROCESSES : named.join("; ")}`;
  }

  private static cells(line: string): string[] {
    return line.replace(/^"|"$/gu, String.empty).split(MemorySummary.SEPARATOR);
  }

  private static megabytes(bytes: number): string {
    return `${(bytes / MemorySummary.BYTES_PER_MEGABYTE).toFixed(1)} MB`;
  }
}
