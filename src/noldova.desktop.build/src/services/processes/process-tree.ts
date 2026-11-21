/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawnSync } from "node:child_process";
import { writeSync } from "node:fs";
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
    if (!this.signalGroup(groupId, Resources.killSignal))
      return;
    for (let waited = 0; waited < Resources.processTreeGrace && this.isGroupLeft(groupId); waited += Resources.processTreeGracePoll)
      await this.delayAsync(Resources.processTreeGracePoll);
  }

  private async endOnWindowsAsync(processId: number, launched: number, exited: number | null): Promise<void> {
    let listing = await this.readAsync(Resources.windowsPowershellCommand, [...Resources.processListArguments, Resources.processListScript]);
    if (Object.isNull(listing))
      return;
    const start = listing.get(processId)?.start;
    let tree = Object.isNull(exited)
      ? new Map(!Object.isUndefined(start) && start + Resources.psStartTolerance > launched ? [[processId, start]] : [])
      : new Map([...listing].filter(([, t]) => t.parent === processId && t.start + Resources.psStartTolerance > launched && t.start <= exited).map(([id, t]) => [id, t.start]));
    writeSync(2, `[diag] end ${processId} launched ${launched} exited ${String(exited)} listed ${JSON.stringify(listing.get(processId) ?? null)} tree ${JSON.stringify([...tree])}\n`);
    for (let round = 0; !Object.isNull(listing) && round < Resources.processTreeRounds; round++) {
      tree = ProcessTree.treeOf(listing, tree);
      const found = ProcessTree.listed(listing, tree);
      writeSync(2, `[diag] round ${round} found ${JSON.stringify(found)} at ${Math.round(performance.now())}\n`);
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

  private isGroupLeft(groupId: number): boolean {
    try {
      return this.signalGroup(groupId, Resources.probeSignal);
    }
    catch (error) {
      if (error instanceof Error && Resources.errorCodeField in error && error[Resources.errorCodeField] === Resources.refusedSignalCode)
        return true;
      throw error;
    }
  }

  private signalGroup(groupId: number, signal: NodeJS.Signals | 0): boolean {
    try {
      this.kill(-groupId, signal);
      return true;
    }
    catch (error) {
      if (error instanceof Error && Resources.errorCodeField in error && error[Resources.errorCodeField] === Resources.missingProcessCode)
        return false;
      throw error;
    }
  }

  private static async listAsync(command: string, commandArguments: readonly string[]): Promise<string> {
    if (process.platform !== "win32") {
      const listed = await promisify(execFile)(command, [...commandArguments], { env: { ...process.env, ...Resources.processListEnvironment },
        timeout: Resources.processListTimeout, maxBuffer: Resources.processListOutputLimit, windowsHide: true });
      return listed.stdout;
    }
    const started = performance.now();
    return await new Promise<string>((resolve, reject) => {
      let id = 0;
      const say = (t: string): void => {
        writeSync(2, `[diag ${id}] ${t} at ${Math.round(performance.now() - started)} ms\n`);
      };
      const child = execFile(command, [...commandArguments], { env: { ...process.env, ...Resources.processListEnvironment },
        timeout: Resources.processListTimeout, maxBuffer: Resources.processListOutputLimit, windowsHide: true }, (error, stdout, stderr) => {
        say(`callback ${Object.isNull(error) ? "ok" : String(error)} stdout ${stdout.length} chars, stderr ${stderr.slice(0, 400)}`);
        for (const line of stdout.split(/\r?\n/).filter(t => /^(kill|skip|fail) /.test(t)))
          say(line);
        if (Object.isNull(error))
          resolve(stdout);
        else
          reject(error);
      });
      id = child.pid ?? -1;
      say(`spawned ${String(commandArguments.at(-1)).slice(0, 50)}`);
      child.once("exit", (code, signal) => {
        say(`exit ${String(code)} ${String(signal)}`);
        const held = setTimeout(() => {
          say("no close 1 s after exit; listing what the process left");
          const left = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
            `Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq ${id} -or $_.ProcessId -eq ${id} } | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, $_.CommandLine }`],
          { encoding: "utf8", timeout: 20_000, windowsHide: true });
          say(`left: ${left.stdout} ${left.stderr} ${String(left.error)}`);
        }, 1_000);
        child.once("close", () => clearTimeout(held));
      });
      child.once("close", code => say(`close ${String(code)}`));
    });
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
