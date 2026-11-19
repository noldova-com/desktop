/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants } from "node:os";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ForegroundProcess, PseudoTerminal } from "@noldova/desktop.runtime";

import { PseudoTerminalHandleFixture } from "../fixtures/pseudo-terminal-handle.fixture.js";

@TestClass
export class PseudoTerminalTests {
  private static readonly ENDED_PROCESS_ID: number = 2_147_483_644;
  private static readonly FAILURE: string = "Cannot resize a pty that has already exited";

  private static create(handle: PseudoTerminalHandleFixture, stop: () => Promise<boolean> = async () => true): PseudoTerminal {
    return new PseudoTerminal(handle, "/bin/bash", new Date(0), stop);
  }

  @TestMethod
  public handsTheOutputBeforeItsFirstListenerToThatListenerInOrderAndLaterOutputToEveryListener(): void {
    const handle = new PseudoTerminalHandleFixture();
    const terminal = PseudoTerminalTests.create(handle);
    const first: string[] = [];
    const second: string[] = [];

    handle.emit("a");
    handle.emit("b");
    const registration = terminal.onOutput(t => first.push(t));
    terminal.onOutput(t => second.push(t));
    handle.emit("c");
    registration[Symbol.dispose]();
    handle.emit("d");

    Assert.areEqual("a,b,c", first.join(","));
    Assert.areEqual("c,d", second.join(","));
    Assert.areEqual(`4210 /bin/bash ${new Date(0).toISOString()}`, `${terminal.processId} ${terminal.program} ${terminal.started.toISOString()}`);
  }

  @TestMethod
  public async keepsTheOutputAndTheExitOfAProgramThatPrintsAtOnceAndExitsBeforeAnyoneListens(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();
    const terminal = PseudoTerminalTests.create(handle);
    const output: string[] = [];

    handle.emit("hello\r\n");
    handle.exit({ exitCode: 0, signal: 0 });
    const hasExited = terminal.hasExited;
    terminal.onOutput(t => output.push(t));
    const exit = await terminal.exited;

    Assert.isTrue(hasExited);
    Assert.areEqual("hello\r\n", output.join(String.empty));
    Assert.isTrue(exit.isClean);
  }

  @TestMethod
  public async readsTheLibrarysExitAsASignalACodeOrNeither(): Promise<void> {
    const exits = [
      { exitCode: 0, signal: constants.signals.SIGHUP },
      { exitCode: 3, signal: 0 },
      { exitCode: 7 },
      { exitCode: undefined }
    ];

    const read: string[] = [];
    for (const exit of exits) {
      const handle = new PseudoTerminalHandleFixture();
      const terminal = PseudoTerminalTests.create(handle);
      handle.exit(exit);
      const { code, signal } = await terminal.exited;
      read.push(`${code} ${signal}`);
    }

    Assert.areEqual("null SIGHUP|3 null|7 null|null null", read.join("|"));
  }

  @TestMethod
  public writesAndResizesOnlyUntilTheProgramExitsAndPassesPauseAndResumeOn(): void {
    const handle = new PseudoTerminalHandleFixture();
    const terminal = PseudoTerminalTests.create(handle);

    terminal.write("ls\r");
    terminal.resize(120, 30);
    terminal.pause();
    terminal.resume();
    const refused = Assert.throws(() => terminal.resize(0, 30), ArgumentException);
    handle.exit({ exitCode: 0 });
    terminal.write("late");
    terminal.resize(80, 24);

    Assert.areEqual("write ls\r,resize 120x30,pause,resume", handle.calls.join(","));
    Assert.areEqual("columns", refused.parameterName);
  }

  @TestMethod
  public ignoresAWriteOrResizeThatFailsOnceTheProgramHasEndedBeforeItsExitArrivesButNotOneThatFailsWhileItRuns(): void {
    const ended = new PseudoTerminalHandleFixture(PseudoTerminalTests.ENDED_PROCESS_ID);
    ended.failure = new Error(PseudoTerminalTests.FAILURE);
    const running = new PseudoTerminalHandleFixture(process.pid);
    running.failure = new Error(PseudoTerminalTests.FAILURE);
    const endedTerminal = PseudoTerminalTests.create(ended);
    const runningTerminal = PseudoTerminalTests.create(running);

    endedTerminal.write("ls\r");
    endedTerminal.resize(120, 30);
    const writeFailure = Assert.throws(() => runningTerminal.write("ls\r"), Error);
    const resizeFailure = Assert.throws(() => runningTerminal.resize(120, 30), Error);

    Assert.areEqual("write ls\r,resize 120x30", ended.calls.join(","));
    Assert.areEqual(PseudoTerminalTests.FAILURE, writeFailure.message);
    Assert.areEqual(PseudoTerminalTests.FAILURE, resizeFailure.message);
  }

  @TestMethod
  public async readsTheForegroundGroupOfItsProgramsTerminalAndNullWithoutAReaderOrOnceTheProgramExited(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();
    const asked: string[] = [];
    const terminal = new PseudoTerminal(handle, "/bin/bash", new Date(0), async () => true, async (t, u) => {
      asked.push(`${t} ${u.toISOString()}`);
      return 4_388;
    });
    const unread = PseudoTerminalTests.create(new PseudoTerminalHandleFixture());

    const running = await terminal.readForegroundProcessGroupAsync();
    const withoutReader = await unread.readForegroundProcessGroupAsync();
    handle.exit({ exitCode: 0 });
    const exited = await terminal.readForegroundProcessGroupAsync();

    Assert.areEqual("4388 null null", `${running} ${withoutReader} ${exited}`);
    Assert.areEqual("4210 1970-01-01T00:00:00.000Z", asked.join(","));
  }

  @TestMethod
  public async answersNullForAGroupReadWhileTheProgramExited(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();
    let answer: (group: number | null) => void = () => undefined;
    const terminal = new PseudoTerminal(handle, "/bin/bash", new Date(0), async () => true, () => new Promise<number | null>(resolve => {
      answer = resolve;
    }));

    const reading = terminal.readForegroundProcessGroupAsync();
    handle.exit({ exitCode: 0 });
    answer(4_210);

    Assert.isNull(await reading);
  }

  @TestMethod
  public async readsTheForegroundProcessOfItsProgramsTerminalAndNullWithoutAReaderOrOnceTheProgramExited(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();
    const asked: string[] = [];
    const foreground = new ForegroundProcess(4_388, "/usr/bin/sleep", "/usr/bin/bash");
    const terminal = new PseudoTerminal(handle, "/bin/bash", new Date(0), async () => true, async () => 4_388, async (t, u) => {
      asked.push(`${t} ${u.toISOString()}`);
      return foreground;
    });
    const unread = PseudoTerminalTests.create(new PseudoTerminalHandleFixture());

    const running = await terminal.readForegroundProcessAsync();
    const withoutReader = await unread.readForegroundProcessAsync();
    handle.exit({ exitCode: 0 });
    const exited = await terminal.readForegroundProcessAsync();

    Assert.isTrue(running === foreground);
    Assert.isNull(withoutReader);
    Assert.isNull(exited);
    Assert.areEqual("4210 1970-01-01T00:00:00.000Z", asked.join(","));
  }

  @TestMethod
  public async answersNullForAForegroundProcessReadWhileTheProgramExited(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();
    let answer: (foreground: ForegroundProcess | null) => void = () => undefined;
    const terminal = new PseudoTerminal(handle, "/bin/bash", new Date(0), async () => true, async () => null, () => new Promise<ForegroundProcess | null>(resolve => {
      answer = resolve;
    }));

    const reading = terminal.readForegroundProcessAsync();
    handle.exit({ exitCode: 0 });
    answer(new ForegroundProcess(4_210, "/usr/bin/bash", "/usr/bin/bash"));

    Assert.isNull(await reading);
  }

  @TestMethod
  public async asksToStopOnceAndGivesEveryCallerTheSameAnswer(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();
    let asked = 0;
    let finish: (ended: boolean) => void = () => undefined;
    const terminal = PseudoTerminalTests.create(handle, () => {
      asked++;
      return new Promise<boolean>(resolve => {
        finish = resolve;
      });
    });

    const first = terminal.stopAsync();
    const second = terminal.stopAsync();
    finish(false);

    Assert.areEqual(first, second);
    Assert.isFalse(await second);
    Assert.areEqual(1, asked);
  }
}
