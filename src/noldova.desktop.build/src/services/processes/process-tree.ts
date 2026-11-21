/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class ProcessTree {
  private readonly platform: string;
  private readonly kill: (processId: number, signal: NodeJS.Signals | 0) => void;
  private readonly list: (command: string, commandArguments: readonly string[]) => Promise<string>;
  private readonly delayAsync: (milliseconds: number) => Promise<unknown>;

  public constructor(platform: string = process.platform, kill: (processId: number, signal: NodeJS.Signals | 0) => void = process.kill,
    list: (command: string, commandArguments: readonly string[]) => Promise<string> = ProcessTree.listAsync, delayAsync: (milliseconds: number) => Promise<unknown> = delay) {
    this.platform = platform;
    this.kill = kill;
    this.list = list;
    this.delayAsync = delayAsync;
  }

  public get isGrouped(): boolean {
    return this.platform !== Resources.windowsPlatform;
  }

  public async endAsync(processId: number | undefined, launched: number, exited: number | null): Promise<void> {
    if (Object.isUndefined(processId))
      return;
    if (this.isGrouped)
      await this.endGroupAsync(processId, launched, exited);
    else
      await this.endOnWindowsAsync(processId, launched, exited);
  }

  private async endGroupAsync(groupId: number, launched: number, exited: number | null): Promise<void> {
    const listing = await this.readAsync(Resources.psCommand, Resources.psProcessGroupArguments);
    if (Object.isNull(listing) || (!Object.isNull(exited) && listing.has(groupId))
      || ![...listing.values()].some(t => t.parent === groupId && t.start + Resources.psStartTolerance > launched))
      return;
    if (this.signal(-groupId, Resources.killSignal))
      await this.waitUntilGoneAsync([-groupId]);
  }

  private async waitUntilGoneAsync(targets: readonly number[]): Promise<void> {
    for (let waited = 0; waited < Resources.processTreeGrace && targets.some(t => this.isLeft(t)); waited += Resources.processTreeGracePoll)
      await this.delayAsync(Resources.processTreeGracePoll);
  }

  private async endOnWindowsAsync(processId: number, launched: number, exited: number | null): Promise<void> {
    if (Object.isNull(exited)) {
      const ended = await this.list(Resources.taskkillCommand, [...Resources.taskkillTreeArguments, String(processId)]).catch(() => null);
      if (!Object.isNull(ended)) {
        await this.waitUntilGoneAsync([processId, ...[...ended.matchAll(Resources.taskkillEndedPattern)].map(t => Number(t[1]))]);
        return;
      }
    }
    let listing = await this.readAsync(Resources.windowsPowershellCommand, [...Resources.processListArguments, Resources.processListScript]);
    if (Object.isNull(listing))
      return;
    const start = listing.get(processId)?.start;
    let tree = Object.isNull(exited)
      ? new Map(!Object.isUndefined(start) && start + Resources.psStartTolerance > launched ? [[processId, start]] : [])
      : new Map([...listing].filter(([, t]) => t.parent === processId && t.start + Resources.psStartTolerance > launched && t.start <= exited).map(([id, t]) => [id, t.start]));
    for (let round = 0; !Object.isNull(listing) && round < Resources.processTreeRounds; round++) {
      tree = ProcessTree.treeOf(listing, tree);
      const found = ProcessTree.listed(listing, tree);
      if (found.length === 0)
        return;
      listing = await this.readAsync(Resources.windowsPowershellCommand,
        [...Resources.processListArguments, Resources.formatProcessEndScript(found.map(t => t[0]), found.map(t => t[1]))]);
    }
  }

  private async readAsync(command: string, commandArguments: readonly string[]): Promise<ReadonlyMap<number, { readonly parent: number; readonly start: number }> | null> {
    const windows = this.platform === Resources.windowsPlatform;
    const output = await this.list(command, commandArguments).catch(() => null);
    return Object.isNull(output) ? null : new Map([...output.matchAll(Resources.processParentPattern)]
      .map(t => [Number(t[1]), { parent: Number(t[2]), start: windows ? Number(t[3]) : Date.parse(String(t[3])) }]));
  }

  private isLeft(target: number): boolean {
    try {
      return this.signal(target, Resources.probeSignal);
    }
    catch (error) {
      if (error instanceof Error && Resources.errorCodeField in error && error[Resources.errorCodeField] === Resources.refusedSignalCode)
        return true;
      throw error;
    }
  }

  private signal(target: number, signal: NodeJS.Signals | 0): boolean {
    try {
      this.kill(target, signal);
      return true;
    }
    catch (error) {
      if (error instanceof Error && Resources.errorCodeField in error && error[Resources.errorCodeField] === Resources.missingProcessCode)
        return false;
      throw error;
    }
  }

  private static async listAsync(command: string, commandArguments: readonly string[]): Promise<string> {
    const listed = await promisify(execFile)(command, [...commandArguments], { env: { ...process.env, ...Resources.processListEnvironment },
      timeout: Resources.processListTimeout, maxBuffer: Resources.processListOutputLimit, windowsHide: true });
    return listed.stdout;
  }

  private static treeOf(listing: ReadonlyMap<number, { readonly parent: number; readonly start: number }>, known: ReadonlyMap<number, number>): Map<number, number> {
    const tree = new Map(known);
    for (const [id, started] of tree) {
      const listed = listing.get(id);
      if (!Object.isUndefined(listed) && listed.start !== started)
        continue;
      for (const [child, entry] of listing)
        if (entry.parent === id && entry.start >= started)
          tree.set(child, entry.start);
    }
    return tree;
  }

  private static listed(listing: ReadonlyMap<number, { readonly parent: number; readonly start: number }>, tree: ReadonlyMap<number, number>): [number, number][] {
    return [...tree].filter(([id, started]) => listing.get(id)?.start === started);
  }
}
