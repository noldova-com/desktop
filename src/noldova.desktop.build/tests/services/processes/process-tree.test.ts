/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, Category, TestClass, TestMethod } from "@noldova/context.testing";

import { Resources } from "../../../src/resources.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { ProcessTree } from "../../../src/services/processes/process-tree.js";
import { ListedProcessFixture } from "../../fixtures/listed-process.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";

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
    const signals: (number | string)[][] = [];
    const lists: string[] = [];
    const delays: number[] = [];
    let probes = 0;
    const tree = new ProcessTree("linux", (processId, signal) => {
      signals.push([processId, signal]);
      if (signal === 0 && ++probes > 2)
        throw ProcessTreeTests.failure("ESRCH");
    }, async (command, commandArguments) => {
      lists.push(JSON.stringify([command, commandArguments]));
      return ProcessTreeTests.posix([new ListedProcessFixture(4321, 4321, 10), new ListedProcessFixture(4400, 4321, 500), new ListedProcessFixture(900, 900, -60_000)]);
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
    const signals: (number | string)[][] = [];
    const tree = new ProcessTree("darwin", (processId, signal) => {
      signals.push([processId, signal]);
      if (signal === 0)
        throw ProcessTreeTests.failure("ESRCH");
    }, async () => ProcessTreeTests.posix([new ListedProcessFixture(4400, 4321, 500)]), async () => undefined);

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, ProcessTreeTests.EXITED);

    Assert.areEqual(JSON.stringify([[-4321, "SIGKILL"], [-4321, 0]]), JSON.stringify(signals));
  }

  @TestMethod
  public async signalsNoGroupItCannotTellIsTheCommands(): Promise<void> {
    const signals: number[] = [];
    const listings = new Map<string, number | null>()
      .set(ProcessTreeTests.posix([new ListedProcessFixture(900, 900, 10)]), null)
      .set(ProcessTreeTests.posix([new ListedProcessFixture(4321, 4321, -60_000), new ListedProcessFixture(4400, 4321, -30_000)]), null)
      .set(ProcessTreeTests.posix([new ListedProcessFixture(4321, 4321, 5_000), new ListedProcessFixture(4400, 4321, 500)]), ProcessTreeTests.EXITED);

    for (const [listing, exited] of listings) {
      const tree = new ProcessTree("linux", processId => {
        signals.push(processId);
      }, async () => listing, async () => undefined);
      await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, exited);
    }

    Assert.areEqual(0, signals.length);
  }

  @TestMethod
  public async rejectsWithTheListingsFailureAndEndsNothing(): Promise<void> {
    const failure = new Error("listing failed");
    const signals: number[] = [];

    for (const platform of ["linux", "win32"]) {
      const tree = new ProcessTree(platform, processId => {
        signals.push(processId);
      }, async () => Promise.reject(failure), async () => undefined, ProcessTreeTests.refuseTaskkill);
      const error = await Assert.throwsAsync(() => tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null), Error);
      Assert.areEqual(failure, error);
    }

    Assert.areEqual(0, signals.length);
  }

  @TestMethod
  public async waitsOnAGroupWhoseProcessesTheSystemStillHoldsAndRejectsAnyOtherProbeFailure(): Promise<void> {
    const delays: number[] = [];
    let probes = 0;
    const holding = new ProcessTree("darwin", (_, signal) => {
      if (signal !== 0)
        return;
      probes += 1;
      throw ProcessTreeTests.failure(probes < 3 ? "EPERM" : "ESRCH");
    }, async () => ProcessTreeTests.posix([new ListedProcessFixture(4321, 4321, 10)]), async t => {
      delays.push(t);
    });
    const failing = new ProcessTree("darwin", (_, signal) => {
      if (signal === 0)
        throw new Error("probe failed");
    }, async () => ProcessTreeTests.posix([new ListedProcessFixture(4321, 4321, 10)]), async () => undefined);

    await holding.endAsync(4321, ProcessTreeTests.LAUNCHED, null);
    const error = await Assert.throwsAsync(() => failing.endAsync(4321, ProcessTreeTests.LAUNCHED, null), Error);

    Assert.areEqual(3, probes);
    Assert.areEqual(JSON.stringify([100, 100]), JSON.stringify(delays));
    Assert.areEqual("probe failed", error.message);
  }

  @TestMethod
  public async stopsWaitingForTheGroupAtItsGrace(): Promise<void> {
    const delays: number[] = [];
    const tree = new ProcessTree("linux", () => undefined, async () => ProcessTreeTests.posix([new ListedProcessFixture(4321, 4321, 10)]), async t => {
      delays.push(t);
    });

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(Resources.processTreeGrace / Resources.processTreeGracePoll, delays.length);
  }

  @TestMethod
  public async endsQuietlyForAGroupAlreadyGoneAndRejectsWithAnyOtherKillFailure(): Promise<void> {
    const failures: Error[] = [ProcessTreeTests.failure("ESRCH"), ProcessTreeTests.failure("EPERM"), new Error("kill failed")];
    const signals: (number | string)[][] = [];
    const answers: string[] = [];

    for (const failure of failures) {
      const tree = new ProcessTree("linux", (processId, signal) => {
        signals.push([processId, signal]);
        throw failure;
      }, async () => ProcessTreeTests.posix([new ListedProcessFixture(4321, 4321, 10)]), async () => undefined);
      answers.push(await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null).then(() => "ended", (t: unknown) => t instanceof Error ? t.message : String(t)));
    }

    Assert.areEqual(JSON.stringify(["ended", "kill EPERM", "kill failed"]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify([[-4321, "SIGKILL"], [-4321, "SIGKILL"], [-4321, "SIGKILL"]]), JSON.stringify(signals));
  }

  @TestMethod
  public async endsARunningCommandsTreeOnWindowsWithTaskkillAndWaitsUntilEachProcessIsGone(): Promise<void> {
    const output = [
      "SUCCESS: The process with PID 4500 (child process of PID 4400) has been terminated.",
      "SUCCESS: The process with PID 4400 (child process of PID 4321) has been terminated.",
      "SUCCESS: The process with PID 4321 (child process of PID 100) has been terminated."
    ].join("\r\n");
    const answers: Readonly<Record<number, readonly string[]>> = { 4321: ["running"], 4400: ["running", "EPERM"] };
    const probes: number[] = [];
    const lists: string[] = [];
    const ends: number[] = [];
    let delays = 0;
    const tree = new ProcessTree("win32", (processId, signal) => {
      Assert.isTrue(signal === 0, String(signal));
      probes.push(processId);
      const code = (answers[processId] ?? []).at(probes.filter(t => t === processId).length - 1) ?? "ESRCH";
      if (code !== "running")
        throw ProcessTreeTests.failure(code);
    }, async (command, commandArguments) => {
      lists.push(JSON.stringify([command, commandArguments]));
      return String.empty;
    }, async () => {
      delays += 1;
    }, processId => {
      ends.push(processId);
      return output;
    });

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(JSON.stringify([4321]), JSON.stringify(ends));
    Assert.areEqual(0, lists.length);
    Assert.areEqual(JSON.stringify([4321, 4321, 4500, 4400, 4321, 4500, 4400, 4321, 4500, 4400, 4321]), JSON.stringify(probes));
    Assert.areEqual(3, delays);
  }

  @TestMethod
  public async endsARunningCommandsTreeOnWindowsBeforeItsEndFirstWaits(): Promise<void> {
    const ends: number[] = [];
    const tree = new ProcessTree("win32", () => {
      throw ProcessTreeTests.failure("ESRCH");
    }, async () => String.empty, async () => undefined, processId => {
      ends.push(processId);
      return String.empty;
    });

    const ending = tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);
    const endedAtOnce = ends.length;
    await ending;

    Assert.areEqual(1, endedAtOnce);
  }

  @TestMethod
  public async endsTheChildrenListedUnderARunningCommandsIdWhenTaskkillFailsAfterEndingIt(): Promise<void> {
    const start = ProcessTreeTests.LAUNCHED;
    const lists: string[] = [];
    const tree = new ProcessTree("win32", () => undefined, async (_, commandArguments) => {
      lists.push(commandArguments.at(-1) ?? String.empty);
      return lists.length === 1
        ? ProcessTreeTests.windows([new ListedProcessFixture(4400, 4321, start + 50), new ListedProcessFixture(4500, 4400, start + 80), new ListedProcessFixture(4401, 4321, start - 10_000), new ListedProcessFixture(700, 1, start - 60_000)])
        : String.empty;
    }, async () => undefined, ProcessTreeTests.refuseTaskkill);

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(JSON.stringify([Resources.processListScript, Resources.formatProcessEndScript([4400, 4500], [start + 50, start + 80])]), JSON.stringify(lists));
  }

  @TestMethod
  public async endsTheChildrenListedUnderTheIdsTaskkillEndedBeforeItFailed(): Promise<void> {
    const start = ProcessTreeTests.LAUNCHED;
    const lists: string[] = [];
    const tree = new ProcessTree("win32", () => undefined, async (_, commandArguments) => {
      lists.push(commandArguments.at(-1) ?? String.empty);
      return lists.length === 1
        ? ProcessTreeTests.windows([new ListedProcessFixture(4500, 4400, start + 80), new ListedProcessFixture(4600, 4500, start + 90), new ListedProcessFixture(4501, 4400, start - 10_000), new ListedProcessFixture(700, 1, start - 60_000)])
        : String.empty;
    }, async () => undefined, () => {
      throw Object.assign(new Error("taskkill failed"), {
        stdout: "SUCCESS: The process with PID 4400 (child process of PID 4321) has been terminated.\r\n" +
          "SUCCESS: The process with PID 4321 (child process of PID 100) has been terminated.\r\n",
      });
    });

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(JSON.stringify([Resources.processListScript, Resources.formatProcessEndScript([4500, 4600], [start + 80, start + 90])]), JSON.stringify(lists));
  }

  @TestMethod
  public async rejectsWhenNeitherTheRealTaskkillNorTheListingSucceeds(): Promise<void> {
    let lists = 0;
    const failure = new Error("powershell failed");
    const tree = new ProcessTree("win32", () => undefined, async () => {
      lists += 1;
      return Promise.reject(failure);
    }, async () => undefined);

    const error = await Assert.throwsAsync(() => tree.endAsync(2_147_483_646, ProcessTreeTests.LAUNCHED, null), Error);

    Assert.areEqual(failure, error);
    Assert.areEqual(1, lists);
  }

  @TestMethod
  public async endsARunningCommandsTreeOnWindowsByStartTimeUntilNoneIsListedWhenTaskkillFails(): Promise<void> {
    const start = ProcessTreeTests.LAUNCHED;
    const listing = ProcessTreeTests.windows([new ListedProcessFixture(4321, 100, start + 5), new ListedProcessFixture(4400, 4321, start + 50), new ListedProcessFixture(4500, 4400, start + 80), new ListedProcessFixture(4600, 4321, start - 10_000), new ListedProcessFixture(700, 1, start - 60_000)]);
    const answers = [listing, ProcessTreeTests.windows([new ListedProcessFixture(4500, 4400, start + 80), new ListedProcessFixture(700, 1, start - 60_000)]), ProcessTreeTests.windows([new ListedProcessFixture(700, 1, start - 60_000)])];
    const lists: string[] = [];
    const signals: number[] = [];
    const tree = new ProcessTree("win32", processId => {
      signals.push(processId);
    }, async (command, commandArguments) => {
      lists.push(JSON.stringify([command, commandArguments]));
      return answers[lists.length - 1] ?? String.empty;
    }, async () => undefined, ProcessTreeTests.refuseTaskkill);

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(JSON.stringify([
      ProcessTreeTests.powershell(Resources.processListScript),
      ProcessTreeTests.powershell(Resources.formatProcessEndScript([4321, 4400, 4500], [start + 5, start + 50, start + 80])),
      ProcessTreeTests.powershell(Resources.formatProcessEndScript([4500], [start + 80])),
    ]), JSON.stringify(lists));
    Assert.areEqual(0, signals.length);
  }

  @TestMethod
  public async leavesTheChildrenOfAnIdReusedAfterItsProcessEndedOnWindows(): Promise<void> {
    const start = ProcessTreeTests.LAUNCHED;
    const answers = [
      ProcessTreeTests.windows([new ListedProcessFixture(4321, 100, start + 5), new ListedProcessFixture(4400, 4321, start + 50)]),
      ProcessTreeTests.windows([new ListedProcessFixture(4400, 900, start + 9_000), new ListedProcessFixture(4700, 4400, start + 9_500)])
    ];
    const lists: string[] = [];
    const tree = new ProcessTree("win32", () => undefined, async (_, commandArguments) => {
      lists.push(commandArguments.at(-1) ?? String.empty);
      return answers[lists.length - 1] ?? String.empty;
    }, async () => undefined, ProcessTreeTests.refuseTaskkill);

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);

    Assert.areEqual(JSON.stringify([Resources.processListScript, Resources.formatProcessEndScript([4321, 4400], [start + 5, start + 50])]), JSON.stringify(lists));
  }

  @TestMethod
  public async endsOnlyTheChildrenAnExitedCommandStartedOnWindows(): Promise<void> {
    const start = ProcessTreeTests.LAUNCHED;
    const lists: string[] = [];
    const tree = new ProcessTree("win32", () => undefined, async (_, commandArguments) => {
      lists.push(commandArguments.at(-1) ?? String.empty);
      return lists.length === 1
        ? ProcessTreeTests.windows([new ListedProcessFixture(4321, 1, start + 5_000), new ListedProcessFixture(4400, 4321, start + 50), new ListedProcessFixture(4500, 4400, start + 80), new ListedProcessFixture(4401, 4321, start + 6_000), new ListedProcessFixture(4402, 4321, start - 10_000)])
        : String.empty;
    }, async () => undefined);

    await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, ProcessTreeTests.EXITED);

    Assert.areEqual(JSON.stringify([Resources.processListScript, Resources.formatProcessEndScript([4400, 4500], [start + 50, start + 80])]), JSON.stringify(lists));
  }

  @TestMethod
  public async endsNothingOnWindowsItCannotTellIsTheCommandsAndStopsAtItsRounds(): Promise<void> {
    const start = ProcessTreeTests.LAUNCHED;
    const cases = new Map<string, number>()
      .set(ProcessTreeTests.windows([new ListedProcessFixture(4321, 1, start - 60_000)]), 1)
      .set(ProcessTreeTests.windows([new ListedProcessFixture(700, 1, start)]), 1)
      .set(ProcessTreeTests.windows([new ListedProcessFixture(4321, 1, start + 5)]), 1 + Resources.processTreeRounds);
    const counts: number[] = [];

    for (const listing of cases.keys()) {
      let count = 0;
      const tree = new ProcessTree("win32", () => undefined, async () => {
        count += 1;
        return listing;
      }, async () => undefined, ProcessTreeTests.refuseTaskkill);
      await tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null);
      counts.push(count);
    }

    Assert.areEqual(JSON.stringify([...cases.values()]), JSON.stringify(counts));
  }

  @TestMethod
  public async rejectsOnWindowsWithTheFailureOfAnEndScript(): Promise<void> {
    let count = 0;
    const failure = new Error("powershell failed");
    const tree = new ProcessTree("win32", () => undefined, async () => {
      count += 1;
      return count === 1 ? ProcessTreeTests.windows([new ListedProcessFixture(4321, 1, ProcessTreeTests.LAUNCHED + 5)]) : Promise.reject(failure);
    }, async () => undefined, ProcessTreeTests.refuseTaskkill);

    const error = await Assert.throwsAsync(() => tree.endAsync(4321, ProcessTreeTests.LAUNCHED, null), Error);

    Assert.areEqual(failure, error);
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

  private static posix(entries: readonly ListedProcessFixture[]): string {
    return entries.map(t => `${String(t.id)} ${String(t.parent)} ${new Date(ProcessTreeTests.LAUNCHED + t.time).toISOString()}\n`).join(String.empty);
  }

  private static windows(entries: readonly ListedProcessFixture[]): string {
    return entries.map(t => `${String(t.id)} ${String(t.parent)} ${String(t.time)}\r\n`).join(String.empty);
  }

  private static powershell(script: string): string {
    return JSON.stringify(["powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]]);
  }

  private static refuseTaskkill(): string {
    throw new Error("taskkill failed");
  }

  private static failure(code: string): Error {
    return Object.assign(new Error(`kill ${code}`), { code });
  }
}

@TestClass
@Category("Packaging")
export class ProcessTreeListingTests {
  private static readonly CHILD_LIFETIME: number = 60_000;

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async endsTheChildAnExitedCommandLeftRunningOnWindowsThroughTheRealListing(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "process-tree-"));
    const file = path.join(folder, "child.pid");
    const child = `setTimeout(() => undefined, ${String(ProcessTreeListingTests.CHILD_LIFETIME)})`;
    const script = `const child = require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(child)}], { detached: true, stdio: "ignore", windowsHide: true }); ` +
      `require("node:fs").writeFileSync(${JSON.stringify(file)}, String(child.pid)); child.unref();`;
    const runner = new ProcessRunner();
    let id = 0;
    try {
      const launched = Date.now();
      const command = spawn(process.execPath, ["-e", script], { stdio: "ignore", windowsHide: true });
      const exited = await new Promise<number>((resolve, reject) => {
        command.once("error", reject);
        command.once("exit", () => resolve(Date.now()));
      });
      id = Number(await readFile(file, "utf8"));
      Assert.isTrue(id > 0 && runner.isRunning(id), "The child did not outlive the command.");

      await new ProcessTree().endAsync(command.pid, launched, exited);

      Assert.isFalse(runner.isRunning(id), "The child the command left still runs.");
    }
    finally {
      if (id > 0 && runner.isRunning(id))
        runner.kill(id);
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}
