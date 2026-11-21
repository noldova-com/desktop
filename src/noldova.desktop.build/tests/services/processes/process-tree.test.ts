/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { Resources } from "../../../src/resources.js";
import { ProcessTree } from "../../../src/services/processes/process-tree.js";

@TestClass
export class ProcessTreeTests {
  private static readonly LAUNCHED: number = Date.parse("2026-11-21T08:00:00.000Z");
  private static readonly EXITED: number = ProcessTreeTests.LAUNCHED + 3_000;

  @TestMethod
  public groupsAProcessTreeEverywhereButWindows(): void {
    const grouped = ["linux", "darwin", "win32"].map(t => new ProcessTree(t).isGrouped);

    Assert.areEqual(JSON.stringify([true, true, false]), JSON.stringify(grouped));
  }

  @TestMethod
  public async killsTheGroupStartedForTheCommandAndWaitsUntilItIsGone(): Promise<void> {
    const signals: (readonly [number, string | number])[] = [];
    const lists: string[] = [];
    const delays: number[] = [];
    let probes = 0;
    const tree = new ProcessTree("linux", (processId, signal) => {
      signals.push([processId, signal]);
      if (signal === 0 && ++probes > 2)
        throw ProcessTreeTests.failure("ESRCH");
    }, async (command, commandArguments) => {
      lists.push(JSON.stringify([command, commandArguments]));
      return ProcessTreeTests.posix([[4321, 4321, 10], [4400, 4321, 500], [900, 900, -60_000]]);
    }, async t => {
      delays.push(t);
    });

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(JSON.stringify([JSON.stringify(["ps", ["-A", "-o", "pid=,pgid=,lstart="]])]), JSON.stringify(lists));
    Assert.areEqual(JSON.stringify([[-4321, "SIGKILL"], [-4321, 0], [-4321, 0], [-4321, 0]]), JSON.stringify(signals));
    Assert.areEqual(JSON.stringify([100, 100]), JSON.stringify(delays));
  }

  @TestMethod
  public async killsTheGroupACommandThatExitedLeftBehind(): Promise<void> {
    const signals: (readonly [number, string | number])[] = [];
    const tree = new ProcessTree("darwin", (processId, signal) => {
      signals.push([processId, signal]);
      if (signal === 0)
        throw ProcessTreeTests.failure("ESRCH");
    }, async () => ProcessTreeTests.posix([[4400, 4321, 500]]), async () => undefined);

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, ProcessTreeTests.EXITED);

    Assert.areEqual(JSON.stringify([[-4321, "SIGKILL"], [-4321, 0]]), JSON.stringify(signals));
  }

  @TestMethod
  public async signalsNoGroupItCannotTellIsTheCommands(): Promise<void> {
    const signals: number[] = [];
    const listings: [string | null, number | null][] = [
      [null, null],
      [ProcessTreeTests.posix([[900, 900, 10]]), null],
      [ProcessTreeTests.posix([[4321, 4321, -60_000], [4400, 4321, -30_000]]), null],
      [ProcessTreeTests.posix([[4321, 4321, 5_000], [4400, 4321, 500]]), ProcessTreeTests.EXITED],
    ];

    for (const [listing, exited] of listings) {
      const tree = new ProcessTree("linux", processId => {
        signals.push(processId);
      }, async () => listing ?? Promise.reject(new Error("ps failed")), async () => undefined);
      await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, exited);
    }

    Assert.areEqual(0, signals.length);
  }

  @TestMethod
  public async stopsWaitingForTheGroupAtItsGrace(): Promise<void> {
    const delays: number[] = [];
    const tree = new ProcessTree("linux", () => undefined, async () => ProcessTreeTests.posix([[4321, 4321, 10]]), async t => {
      delays.push(t);
    });

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(Resources.processTreeGrace / Resources.processTreeGracePoll, delays.length);
  }

  @TestMethod
  public async endsQuietlyForAGroupAlreadyGoneAndRejectsWithAnyOtherKillFailure(): Promise<void> {
    const failures: Error[] = [ProcessTreeTests.failure("ESRCH"), ProcessTreeTests.failure("EPERM"), new Error("kill failed")];
    const signals: (readonly [number, string | number])[] = [];
    const answers: string[] = [];

    for (const failure of failures) {
      const tree = new ProcessTree("linux", (processId, signal) => {
        signals.push([processId, signal]);
        throw failure;
      }, async () => ProcessTreeTests.posix([[4321, 4321, 10]]), async () => undefined);
      answers.push(await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null).then(() => "ended", (t: unknown) => t instanceof Error ? t.message : String(t)));
    }

    Assert.areEqual(JSON.stringify(["ended", "kill EPERM", "kill failed"]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify([[-4321, "SIGKILL"], [-4321, "SIGKILL"], [-4321, "SIGKILL"]]), JSON.stringify(signals));
  }

  @TestMethod
  public async endsARunningCommandsTreeOnWindowsByStartTimeUntilNoneIsListed(): Promise<void> {
    const start = ProcessTreeTests.LAUNCHED;
    const listing = ProcessTreeTests.windows([[4321, 100, start + 5], [4400, 4321, start + 50], [4500, 4400, start + 80], [4600, 4321, start - 10_000], [700, 1, start - 60_000]]);
    const answers = [listing, ProcessTreeTests.windows([[4500, 4400, start + 80], [700, 1, start - 60_000]]), ProcessTreeTests.windows([[700, 1, start - 60_000]])];
    const lists: string[] = [];
    const signals: number[] = [];
    const tree = new ProcessTree("win32", processId => {
      signals.push(processId);
    }, async (command, commandArguments) => {
      lists.push(JSON.stringify([command, commandArguments]));
      return answers[lists.length - 1] ?? String.empty;
    }, async () => undefined);

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(JSON.stringify([
      ProcessTreeTests.powershell(Resources.processListScript),
      ProcessTreeTests.powershell(Resources.formatProcessEndScript([4321, 4400, 4500], [start + 5, start + 50, start + 80])),
      ProcessTreeTests.powershell(Resources.formatProcessEndScript([4500], [start + 80])),
    ]), JSON.stringify(lists));
    Assert.areEqual(0, signals.length);
  }

  @TestMethod
  public async endsOnlyTheChildrenAnExitedCommandStartedOnWindows(): Promise<void> {
    const start = ProcessTreeTests.LAUNCHED;
    const lists: string[] = [];
    const tree = new ProcessTree("win32", () => undefined, async (_, commandArguments) => {
      lists.push(commandArguments.at(-1) ?? String.empty);
      return lists.length === 1
        ? ProcessTreeTests.windows([[4321, 1, start + 5_000], [4400, 4321, start + 50], [4500, 4400, start + 80], [4401, 4321, start + 6_000], [4402, 4321, start - 10_000]])
        : String.empty;
    }, async () => undefined);

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, ProcessTreeTests.EXITED);

    Assert.areEqual(JSON.stringify([Resources.processListScript, Resources.formatProcessEndScript([4400, 4500], [start + 50, start + 80])]), JSON.stringify(lists));
  }

  @TestMethod
  public async endsNothingOnWindowsItCannotTellIsTheCommandsAndStopsAtItsRounds(): Promise<void> {
    const start = ProcessTreeTests.LAUNCHED;
    const cases: [string | null, number][] = [
      [null, 1],
      [ProcessTreeTests.windows([[4321, 1, start - 60_000]]), 1],
      [ProcessTreeTests.windows([[700, 1, start]]), 1],
      [ProcessTreeTests.windows([[4321, 1, start + 5]]), 1 + Resources.processTreeRounds],
    ];
    const counts: number[] = [];

    for (const [listing] of cases) {
      let count = 0;
      const tree = new ProcessTree("win32", () => undefined, async () => {
        count += 1;
        return listing ?? Promise.reject(new Error("powershell failed"));
      }, async () => undefined);
      await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);
      counts.push(count);
    }

    Assert.areEqual(JSON.stringify(cases.map(t => t[1])), JSON.stringify(counts));
  }

  @TestMethod
  public async stopsEndingOnWindowsWhenAnEndScriptFails(): Promise<void> {
    let count = 0;
    const tree = new ProcessTree("win32", () => undefined, async () => {
      count += 1;
      return count === 1 ? ProcessTreeTests.windows([[4321, 1, ProcessTreeTests.LAUNCHED + 5]]) : Promise.reject(new Error("powershell failed"));
    }, async () => undefined);

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(2, count);
  }

  @TestMethod
  public async endsNothingForAProcessThatNeverStarted(): Promise<void> {
    const calls: string[] = [];
    for (const platform of ["linux", "win32"]) {
      const tree = new ProcessTree(platform, () => {
        calls.push("kill");
      }, async () => {
        calls.push("list");
        return String.empty;
      }, async () => undefined);
      await tree.endAsync(undefined, ProcessTreeTests.LAUNCHED, null);
    }

    Assert.areEqual(0, calls.length);
  }

  private static posix(entries: readonly (readonly [number, number, number])[]): string {
    return entries.map(([id, group, offset]) => `${String(id)} ${String(group)} ${new Date(ProcessTreeTests.LAUNCHED + offset).toISOString()}\n`).join(String.empty);
  }

  private static windows(entries: readonly (readonly [number, number, number])[]): string {
    return entries.map(([id, parent, start]) => `${String(id)} ${String(parent)} ${String(start)}\r\n`).join(String.empty);
  }

  private static powershell(script: string): string {
    return JSON.stringify(["powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]]);
  }

  private static failure(code: string): Error {
    return Object.assign(new Error(`kill ${code}`), { code });
  }
}
