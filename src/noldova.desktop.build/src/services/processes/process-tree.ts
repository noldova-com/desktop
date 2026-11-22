/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import "@noldova/context.core";

import { HeldTreeEnd } from "../../models/processes/held-tree-end.ts";
import { ListedProcess } from "../../models/processes/listed-process.ts";
import { Resources } from "../../resources.ts";

export class ProcessTree {
  private readonly platform: string;
  private readonly kill: (processId: number, signal: NodeJS.Signals | 0) => void;
  private readonly list: (command: string, commandArguments: readonly string[]) => Promise<string>;
  private readonly delayAsync: (milliseconds: number) => Promise<unknown>;
  private readonly endTree: (processId: number) => string;

  public constructor(platform: string = process.platform, kill: (processId: number, signal: NodeJS.Signals | 0) => void = process.kill,
    list: (command: string, commandArguments: readonly string[]) => Promise<string> = ProcessTree.listAsync, delayAsync: (milliseconds: number) => Promise<unknown> = delay,
    endTree: (processId: number) => string = ProcessTree.taskkill) {
    this.platform = platform;
    this.kill = kill;
    this.list = list;
    this.delayAsync = delayAsync;
    this.endTree = endTree;
  }

  public get isGrouped(): boolean {
    return this.platform !== Resources.windowsPlatform;
  }

  public async endAsync(processId: number | undefined, launched: number, hasExited: boolean): Promise<void> {
    if (Object.isUndefined(processId))
      return;
    if (this.isGrouped)
      await this.endGroupAsync(processId, launched, hasExited);
    else
      await this.endOnWindowsAsync(processId, launched, hasExited);
  }

  private async endGroupAsync(groupId: number, launched: number, hasExited: boolean): Promise<void> {
    const listing = await this.readAsync(Resources.psCommand, Resources.psProcessGroupArguments);
    if ((hasExited && listing.has(groupId)) || ![...listing.values()].some(t => t.parent === groupId && t.start + Resources.psStartTolerance > launched))
      return;
    if (this.signal(-groupId, Resources.killSignal))
      await this.waitUntilGoneAsync([-groupId]);
  }

  private async waitUntilGoneAsync(targets: readonly number[]): Promise<void> {
    for (let waited = 0; waited < Resources.processTreeGrace && targets.some(t => this.isLeft(t)); waited += Resources.processTreeGracePoll)
      await this.delayAsync(Resources.processTreeGracePoll);
  }

  private async endOnWindowsAsync(processId: number, launched: number, hasExited: boolean): Promise<void> {
    let ended: number[] = [];
    if (!hasExited) {
      const taskkill = this.endHeldTree(processId);
      ended = [...taskkill.output.matchAll(Resources.taskkillEndedPattern)].map(t => Number(t[1]));
      if (taskkill.isEnded) {
        await this.waitUntilGoneAsync([processId, ...ended]);
        return;
      }
    }
    let listing = await this.readAsync(Resources.windowsPowershellCommand, [...Resources.processListArguments, Resources.processListScript]);
    let tree = new Map<number, number>();
    for (const id of ended)
      tree.set(id, launched - Resources.psStartTolerance);
    const start = listing.get(processId)?.start;
    if (!hasExited && !Object.isUndefined(start) && start + Resources.psStartTolerance > launched)
      tree.set(processId, start);
    const reused = hasExited ? start : undefined;
    for (const [id, listed] of listing)
      if (listed.parent === processId && listed.start + Resources.psStartTolerance > launched && (Object.isUndefined(reused) || listed.start < reused))
        tree.set(id, listed.start);
    for (let round = 0; round < Resources.processTreeRounds; round++) {
      tree = ProcessTree.treeOf(listing, tree);
      const found = ProcessTree.listed(listing, tree);
      if (found.size === 0)
        return;
      listing = await this.readAsync(Resources.windowsPowershellCommand,
        [...Resources.processListArguments, Resources.formatProcessEndScript([...found.keys()], [...found.values()])]);
    }
  }

  private endHeldTree(processId: number): HeldTreeEnd {
    try {
      return new HeldTreeEnd(this.endTree(processId), true);
    }
    catch (error) {
      const output = error instanceof Error && Resources.errorOutputField in error ? error[Resources.errorOutputField] : null;
      return new HeldTreeEnd(Object.isString(output) ? output : String.empty, false);
    }
  }

  private async readAsync(command: string, commandArguments: readonly string[]): Promise<ReadonlyMap<number, ListedProcess>> {
    const windows = this.platform === Resources.windowsPlatform;
    const output = await this.list(command, commandArguments);
    const listing = new Map<number, ListedProcess>();
    for (const line of output.matchAll(Resources.processParentPattern))
      listing.set(Number(line[1]), new ListedProcess(Number(line[2]), windows ? Number(line[3]) : Date.parse(String(line[3]))));
    return listing;
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

  private static taskkill(processId: number): string {
    return execFileSync(Resources.taskkillCommand, [...Resources.taskkillTreeArguments, String(processId)],
      { encoding: Resources.textEncoding, timeout: Resources.taskkillTimeout, windowsHide: true, stdio: [Resources.ignoreStdio, Resources.pipeStdio, Resources.pipeStdio] });
  }

  private static async listAsync(command: string, commandArguments: readonly string[]): Promise<string> {
    return (await promisify(execFile)(command, [...commandArguments], { env: { ...process.env, ...Resources.processListEnvironment },
      timeout: Resources.processListTimeout, maxBuffer: Resources.processListOutputLimit, windowsHide: true })).stdout;
  }

  private static treeOf(listing: ReadonlyMap<number, ListedProcess>, known: ReadonlyMap<number, number>): Map<number, number> {
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

  private static listed(listing: ReadonlyMap<number, ListedProcess>, tree: ReadonlyMap<number, number>): ReadonlyMap<number, number> {
    const found = new Map<number, number>();
    for (const [id, started] of tree)
      if (listing.get(id)?.start === started)
        found.set(id, started);
    return found;
  }
}
