/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ProcessKillFixture } from "./process-kill.fixture.js";

export class SimulatedProcessesFixture implements Disposable {
  private static readonly KILL_SIGNAL: string = "SIGKILL";

  private readonly kill: ProcessKillFixture;
  private readonly owned: Set<number> = new Set();
  private readonly groups: Map<number, number> = new Map();
  private readonly resistant: Set<number> = new Set();
  private readonly failures: Map<string, unknown> = new Map();
  private readonly refusals: Map<string, unknown> = new Map();
  private readonly late: Map<number, number> = new Map();
  private readonly ended: Set<number> = new Set();
  private readonly timers: Set<NodeJS.Timeout> = new Set();

  public constructor() {
    this.kill = new ProcessKillFixture((processId, signal) => this.isRunning(processId, signal));
  }

  public get signals(): readonly string[] {
    return this.kill.signals;
  }

  public timeOf(entry: string): number {
    return this.kill.timeOf(entry);
  }

  public own(processId: number): void {
    this.owned.add(processId);
  }

  public endLate(processId: number, milliseconds: number): void {
    this.late.set(processId, milliseconds);
  }

  public add(processId: number, groupId: number, resists: boolean = false): void {
    this.groups.set(processId, groupId);
    if (resists)
      this.resistant.add(processId);
    else
      this.resistant.delete(processId);
  }

  public remove(processId: number): void {
    this.groups.delete(processId);
  }

  public fail(processId: number, signal: string | number, failure: unknown): void {
    this.failures.set(`${processId} ${signal}`, failure);
  }

  public refuseWhileRunning(processId: number, signal: string | number, failure: unknown): void {
    this.refusals.set(`${processId} ${signal}`, failure);
  }

  public isAlive(processId: number): boolean {
    return this.groups.has(processId);
  }

  public list(format: (processId: number) => string): string {
    return [...this.groups.keys()].map(format).join("\n");
  }

  public [Symbol.dispose](): void {
    for (const timer of this.timers)
      clearTimeout(timer);
    this.timers.clear();
    this.kill[Symbol.dispose]();
  }

  private isRunning(processId: number, signal: string | number): boolean {
    const key = `${processId} ${signal}`;
    const refusal = this.refusals.get(key);
    if (!Object.isUndefined(refusal) && this.kill.real(processId, 0))
      throw refusal;
    const failure = this.failures.get(key);
    if (!Object.isUndefined(failure))
      throw failure;
    const target = Math.abs(processId);
    const late = this.late.get(target);
    if (!Object.isUndefined(late))
      return this.endLater(target, signal, late);
    const real = this.owned.has(target) && this.kill.real(processId, signal);
    const members = [...this.groups].filter(([id, group]) => processId < 0 ? group === target : id === processId).map(([id]) => id);
    if (signal !== 0)
      for (const member of members.filter(t => !this.resistant.has(t)))
        this.groups.delete(member);
    return real || members.length > 0;
  }

  private endLater(processId: number, signal: string | number, milliseconds: number): boolean {
    if (this.ended.has(processId))
      return false;
    if (signal !== 0) {
      this.ended.add(processId);
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.kill.real(processId, SimulatedProcessesFixture.KILL_SIGNAL);
      }, milliseconds);
      this.timers.add(timer);
    }
    return true;
  }
}
