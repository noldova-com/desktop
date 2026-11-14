/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeException } from "@noldova/desktop.runtime";

import { PseudoTerminalConsole } from "../../src/models/pseudo-terminal-console.js";
import { PseudoTerminalHandleFixture } from "../fixtures/pseudo-terminal-handle.fixture.js";

@TestClass
export class PseudoTerminalConsoleTests {
  @TestMethod
  public closesTheConsoleOnceHoweverOftenItIsAsked(): void {
    const handle = new PseudoTerminalHandleFixture();
    const terminalConsole = new PseudoTerminalConsole(handle, "linux");

    terminalConsole.close();
    terminalConsole.close();

    Assert.areEqual("kill", handle.calls.join(","));
  }

  @TestMethod
  public async stopsTheLibrarysOutputWorkerWhenThereIsOne(): Promise<void> {
    const withWorker = new PseudoTerminalHandleFixture();
    PseudoTerminalHandleFixture.addWorker(withWorker, () => withWorker.calls.push("terminate"));
    const without = new PseudoTerminalHandleFixture();

    await new PseudoTerminalConsole(withWorker, "win32").stopOutputWorkerAsync();
    await new PseudoTerminalConsole(without, "linux").stopOutputWorkerAsync();

    Assert.areEqual("terminate", withWorker.calls.join(","));
    Assert.areEqual(String.empty, without.calls.join(","));
  }

  @TestMethod
  public async rejectsWithTheWorkersFailure(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();
    const failure = new Error("The worker is gone.");
    PseudoTerminalHandleFixture.addWorker(handle, () => Promise.reject(failure));

    const error = await Assert.throwsAsync(() => new PseudoTerminalConsole(handle, "win32").stopOutputWorkerAsync(), Error);

    Assert.areEqual(failure, error);
  }

  @TestMethod
  public async refusesToSkipAnOutputWorkerTheLibraryNoLongerKeepsOnWindows(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();

    const error = await Assert.throwsAsync(() => new PseudoTerminalConsole(handle, "win32").stopOutputWorkerAsync(), RuntimeException);

    Assert.areEqual(
      "The pseudo-terminal library has no _agent._conoutSocketWorker._worker.terminate, so the runtime cannot stop or close its output. Its version may have changed how it keeps it.",
      error.message);
    Assert.areEqual(String.empty, handle.calls.join(","));
  }

  @TestMethod
  public async refusesAnOutputWorkerPathTheLibraryKeepsOnlyInPart(): Promise<void> {
    const handle = new PseudoTerminalHandleFixture();
    Object.assign(handle, { _agent: {} });

    const error = await Assert.throwsAsync(() => new PseudoTerminalConsole(handle, "linux").stopOutputWorkerAsync(), RuntimeException);

    Assert.isTrue(error.message.includes("_agent._conoutSocketWorker._worker.terminate"), error.message);
  }
}
