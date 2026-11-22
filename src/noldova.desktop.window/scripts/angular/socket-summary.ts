/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class SocketSummary {
  private static readonly CONNECTION: RegExp = /^\s*TCP\s+\S+:(\d+)\s+\S+:(\d+)\s+(\S+)\s+(\d+)\s*$/u;
  private static readonly START_PORT: RegExp = /Start Port\s*:\s*(\d+)/u;
  private static readonly PORT_COUNT: RegExp = /Number of Ports\s*:\s*(\d+)/u;
  private static readonly TIME_WAIT: string = "TIME_WAIT";
  private static readonly LISTED_PROCESSES: number = 5;
  private static readonly NONE: string = "none";

  public static format(connections: string, portRange: string, port: number): string {
    const states = new Map<string, number>();
    const portStates = new Map<string, number>();
    const processes = new Map<string, number>();
    let total = 0;
    for (const line of connections.split(/\r?\n/u)) {
      const match = SocketSummary.CONNECTION.exec(line);
      if (Object.isNull(match))
        continue;
      const local = Number(match[1]);
      const foreign = Number(match[2]);
      const state = match[3] ?? String.empty;
      const owner = match[4] ?? String.empty;
      total++;
      SocketSummary.count(states, state);
      if (local === port || foreign === port)
        SocketSummary.count(portStates, state);
      if (state !== SocketSummary.TIME_WAIT)
        SocketSummary.count(processes, owner);
    }
    const owners = SocketSummary.largest(processes).slice(0, SocketSummary.LISTED_PROCESSES).map(t => `${t} (${processes.get(t) ?? 0})`);
    return `${total} TCP sockets, ${SocketSummary.list(states)}; to or from port ${port}: ${SocketSummary.list(portStates)}; most held outside TIME_WAIT by process ${owners.length === 0 ? SocketSummary.NONE : owners.join(", ")}; ${SocketSummary.range(portRange)}`;
  }

  private static count(counts: Map<string, number>, key: string): void {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  private static largest(counts: ReadonlyMap<string, number>): string[] {
    return [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b));
  }

  private static list(counts: ReadonlyMap<string, number>): string {
    const keys = SocketSummary.largest(counts);
    return keys.length === 0 ? SocketSummary.NONE : keys.map(t => `${t} ${counts.get(t) ?? 0}`).join(", ");
  }

  private static range(portRange: string): string {
    const start = SocketSummary.START_PORT.exec(portRange)?.[1];
    const count = SocketSummary.PORT_COUNT.exec(portRange)?.[1];
    return Object.isUndefined(start) || Object.isUndefined(count) ? "dynamic port range unread" : `dynamic ports from ${start}, ${count} of them`;
  }
}
