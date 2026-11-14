/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { IPseudoTerminalExit } from "@noldova/desktop.runtime";

import { WatchedPseudoTerminalHandle } from "../../src/models/watched-pseudo-terminal-handle.js";
import { ProcessKillFixture } from "../fixtures/process-kill.fixture.js";
import { ProcessSupervisorFixture } from "../fixtures/process-supervisor.fixture.js";
import { PseudoTerminalHandleFixture } from "../fixtures/pseudo-terminal-handle.fixture.js";

@TestClass
export class WatchedPseudoTerminalHandleTests {
  private static readonly WATCH_MILLISECONDS: number = 20;
  private static readonly REPORT_MILLISECONDS: number = 200;
  private static readonly SLOW_MILLISECONDS: number = 60_000;

  private static create(
    handle: PseudoTerminalHandleFixture,
    watchMilliseconds: number = WatchedPseudoTerminalHandleTests.WATCH_MILLISECONDS,
    readExitCodeAsync: () => Promise<number | undefined> = () => Promise.resolve(undefined)): WatchedPseudoTerminalHandle {
    return new WatchedPseudoTerminalHandle(handle, watchMilliseconds, WatchedPseudoTerminalHandleTests.REPORT_MILLISECONDS, readExitCodeAsync);
  }

  private static collect(watched: WatchedPseudoTerminalHandle): IPseudoTerminalExit[] {
    const exits: IPseudoTerminalExit[] = [];
    watched.onExit(t => exits.push(t));
    return exits;
  }

  private static count(probes: readonly number[], processId: number): number {
    return probes.filter(t => t === processId).length;
  }

  @TestMethod
  public passesTheOutputAndEveryCallToTheLibrary(): void {
    const handle = new PseudoTerminalHandleFixture(4_220);
    const watched = WatchedPseudoTerminalHandleTests.create(handle);
    const output: string[] = [];

    const subscription = watched.onData(t => output.push(t));
    handle.emit("a");
    subscription.dispose();
    handle.emit("b");
    watched.write("text");
    watched.resize(100, 30);
    watched.pause();
    watched.resume();
    watched.kill("SIGHUP");

    Assert.areEqual(4_220, watched.pid);
    Assert.areEqual("a", output.join(","));
    Assert.areEqual("write text,resize 100x30,pause,resume,kill SIGHUP", handle.calls.join(","));
  }

  @TestMethod
  public passesTheLibrarysFirstExitToEachListenerUntilItIsDisposed(): void {
    const handle = new PseudoTerminalHandleFixture();
    const watched = WatchedPseudoTerminalHandleTests.create(handle);
    const exits = WatchedPseudoTerminalHandleTests.collect(watched);
    const disposed: IPseudoTerminalExit[] = [];

    watched.onExit(t => disposed.push(t)).dispose();
    handle.exit({ exitCode: 3 });
    handle.exit({ exitCode: 4 });

    Assert.areEqual(JSON.stringify([{ exitCode: 3 }]), JSON.stringify(exits));
    Assert.areEqual(0, disposed.length);
  }

  @TestMethod
  public async givesAnExitTheLibraryReportsWithoutACodeTheCodeReadAfterItAndDropsALaterExit(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();
    const code = Promise.withResolvers<number | undefined>();
    let reads = 0;
    const watched = WatchedPseudoTerminalHandleTests.create(handle, WatchedPseudoTerminalHandleTests.WATCH_MILLISECONDS, () => {
      reads++;
      return code.promise;
    });
    const exits = WatchedPseudoTerminalHandleTests.collect(watched);

    handle.exit({ exitCode: undefined, signal: 0 });
    handle.exit({ exitCode: 4 });
    const before = exits.length;
    code.resolve(5);
    await ProcessSupervisorFixture.waitForAsync(() => exits.length > 0);

    Assert.areEqual(0, before);
    Assert.areEqual(JSON.stringify([{ exitCode: 5, signal: 0 }]), JSON.stringify(exits));
    Assert.areEqual(1, reads);
  }

  @TestMethod
  public async keepsAnExitWithoutACodeWhenNoneIsReadAndReadsNoneForAnExitWithACode(): Promise<void> {
    const unread = new PseudoTerminalHandleFixture(4_232);
    const coded = new PseudoTerminalHandleFixture(4_233);
    let reads = 0;
    const read = (): Promise<number | undefined> => {
      reads++;
      return Promise.resolve(undefined);
    };
    const exits = [unread, coded].map(t => WatchedPseudoTerminalHandleTests.collect(WatchedPseudoTerminalHandleTests.create(t, WatchedPseudoTerminalHandleTests.WATCH_MILLISECONDS, read)));

    unread.exit({ exitCode: undefined });
    coded.exit({ exitCode: 0 });
    await ProcessSupervisorFixture.waitForAsync(() => exits.every(t => t.length > 0));

    Assert.areEqual(JSON.stringify([[{}], [{ exitCode: 0 }]]), JSON.stringify(exits));
    Assert.areEqual(1, reads);
  }

  @TestMethod
  public async endsAProgramFoundGoneWithoutACodeOnceTheLibraryHasReportedNoExitForTheReportWindowAndClosesTheOutput(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture(4_223);
    let probes = 0;
    using kill = new ProcessKillFixture(processId => processId !== handle.pid || ++probes < 3);
    PseudoTerminalHandleFixture.addSocket(handle, { destroy: () => handle.calls.push("destroy") });
    const watched = WatchedPseudoTerminalHandleTests.create(handle);
    const exits = WatchedPseudoTerminalHandleTests.collect(watched);
    const unreported: string[] = [];

    watched.watch(() => unreported.push(`unreported ${exits.length}`));
    await ProcessSupervisorFixture.waitForAsync(() => exits.length > 0);
    handle.exit({ exitCode: 0 });

    Assert.areEqual(JSON.stringify([{}]), JSON.stringify(exits));
    Assert.areEqual("unreported 0", unreported.join(","));
    Assert.areEqual("destroy", handle.calls.join(","));
    Assert.areEqual(3, probes);
    Assert.areEqual(0, kill.signals.length);
  }

  @TestMethod
  public async keepsAnExitTheLibraryReportsWithinTheReportWindow(): Promise<void> {
    const probes: number[] = [];
    const reported = new PseudoTerminalHandleFixture(4_221);
    const later = new PseudoTerminalHandleFixture(4_222);
    using kill = new ProcessKillFixture((processId, signal) => {
      if (signal === 0)
        probes.push(processId);
      if (processId === reported.pid)
        queueMicrotask(() => reported.exit({ exitCode: 3 }));
      return false;
    });
    PseudoTerminalHandleFixture.addSocket(reported, { destroy: () => reported.calls.push("destroy") });
    PseudoTerminalHandleFixture.addSocket(later, { destroy: () => later.calls.push("destroy") });
    const watched = WatchedPseudoTerminalHandleTests.create(reported);
    const exits = WatchedPseudoTerminalHandleTests.collect(watched);
    const unreported: string[] = [];

    watched.watch(() => unreported.push("reported"));
    await ProcessSupervisorFixture.waitForAsync(() => exits.length > 0);
    const clock = WatchedPseudoTerminalHandleTests.create(later);
    clock.watch(() => unreported.push("later"));
    await ProcessSupervisorFixture.waitForAsync(() => unreported.length > 0);

    Assert.areEqual(JSON.stringify([{ exitCode: 3 }]), JSON.stringify(exits));
    Assert.areEqual("later", unreported.join(","));
    Assert.areEqual(0, reported.calls.length);
    Assert.areEqual(1, WatchedPseudoTerminalHandleTests.count(probes, reported.pid));
    Assert.areEqual(0, kill.signals.length);
  }

  @TestMethod
  public async watchesOftenOnceAskedToButOnlyAProgramItWatches(): Promise<void> {
    const probes: number[] = [];
    const watchedHandle = new PseudoTerminalHandleFixture(4_224);
    const unwatchedHandle = new PseudoTerminalHandleFixture(4_225);
    using kill = new ProcessKillFixture((processId, signal) => {
      if (signal === 0)
        probes.push(processId);
      return false;
    });
    const watched = WatchedPseudoTerminalHandleTests.create(watchedHandle, WatchedPseudoTerminalHandleTests.SLOW_MILLISECONDS);
    const unwatched = WatchedPseudoTerminalHandleTests.create(unwatchedHandle, WatchedPseudoTerminalHandleTests.SLOW_MILLISECONDS);
    const exits = [WatchedPseudoTerminalHandleTests.collect(watched), WatchedPseudoTerminalHandleTests.collect(unwatched)];

    watched.watch(() => undefined);
    watched.watchClosely();
    unwatched.watchClosely();
    await ProcessSupervisorFixture.waitForAsync(() => exits[0]?.length === 1);

    Assert.areEqual(JSON.stringify([[{}], []]), JSON.stringify(exits));
    Assert.areEqual(1, WatchedPseudoTerminalHandleTests.count(probes, watchedHandle.pid));
    Assert.areEqual(0, WatchedPseudoTerminalHandleTests.count(probes, unwatchedHandle.pid));
    Assert.areEqual(0, kill.signals.length);
  }

  @TestMethod
  public async watchesNoMoreOnceTheLibraryReportsAnExitOrTheProgramIsFoundGone(): Promise<void> {
    const probes: number[] = [];
    const exitedHandle = new PseudoTerminalHandleFixture(4_226);
    const goneHandle = new PseudoTerminalHandleFixture(4_227);
    const exited = WatchedPseudoTerminalHandleTests.create(exitedHandle);
    const gone = WatchedPseudoTerminalHandleTests.create(goneHandle);
    using kill = new ProcessKillFixture((processId, signal) => {
      if (signal === 0)
        probes.push(processId);
      if (processId === goneHandle.pid)
        queueMicrotask(() => gone.watchClosely());
      return false;
    });
    const exits = [WatchedPseudoTerminalHandleTests.collect(exited), WatchedPseudoTerminalHandleTests.collect(gone)];

    exitedHandle.exit({ exitCode: 0 });
    exited.watch(() => undefined);
    exited.watchClosely();
    gone.watch(() => undefined);
    await ProcessSupervisorFixture.waitForAsync(() => exits[1]?.length === 1);

    Assert.areEqual(JSON.stringify([[{ exitCode: 0 }], [{}]]), JSON.stringify(exits));
    Assert.areEqual(0, WatchedPseudoTerminalHandleTests.count(probes, exitedHandle.pid));
    Assert.areEqual(1, WatchedPseudoTerminalHandleTests.count(probes, goneHandle.pid));
    Assert.areEqual(0, kill.signals.length);
  }

  @TestMethod
  public async endsTheProgramAndReportsAnOutputThatIsNotAnObjectOrHasNoClose(): Promise<void> {
    using kill = new ProcessKillFixture(() => false);
    const missing = new PseudoTerminalHandleFixture(4_230);
    PseudoTerminalHandleFixture.addSocket(missing, null);
    const closeless = new PseudoTerminalHandleFixture(4_231);
    PseudoTerminalHandleFixture.addSocket(closeless, { destroy: "no" });
    const watched = [WatchedPseudoTerminalHandleTests.create(missing), WatchedPseudoTerminalHandleTests.create(closeless)];
    const exits = watched.map(t => WatchedPseudoTerminalHandleTests.collect(t));
    const reports: string[][] = [[], []];

    watched.forEach((t, u) => t.watch(v => reports[u]?.push(v)));
    await ProcessSupervisorFixture.waitForAsync(() => reports.every(t => t.length > 1));

    Assert.areEqual(JSON.stringify([[{}], [{}]]), JSON.stringify(exits));
    for (const report of reports)
      Assert.areEqual(
        "The program ended, but its pseudo-terminal library didn't report its exit, so it ended without a code.|"
        + "The pseudo-terminal library has no _socket.destroy, so the runtime cannot stop or close its output. Its version may have changed how it keeps it.",
        report.join("|"));
    Assert.areEqual(0, kill.signals.length);
  }
}
