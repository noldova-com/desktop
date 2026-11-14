/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { SignalExitReport } from "./fixtures/signal-exit-report.ts";

const quitWithSignalAsync = (mainProcess: MainProcessFixture, signal: NodeJS.Signals = "SIGBUS"): Promise<number> => mainProcess.application.evaluate(({ app }, sent) => {
  app.once("will-quit", () => process.kill(process.pid, sent));
  return process.pid;
}, signal);
const quitReport = (main: number, signal: NodeJS.Signals, rest: string = String.empty): RegExp =>
  new RegExp(`^The main process ${main} ended by ${signal} while it quit; the test did not send that signal\\.\\n${rest}`);

test.describe("the harness's report of a main process that ends by a signal the test did not send", () => {
  test.skip(process.platform !== "linux", "Windows has no signal the main process could end by, and on macOS a SIGBUS raised as the main process quits doesn't end it.");

  const stackPattern = "Its stack, as Chromium printed it:\\nReceived signal 7 [^\\n]*\\n#0 0x[0-9a-f]+ \\(";

  test("a main process that ends by a signal while it quits fails the test with the signal, the step and Chromium's stack, unless the test accepts that end", async ({ mainProcess }, testInfo) => {
    const main = await quitWithSignalAsync(mainProcess);

    await mainProcess.disposeAsync(false);
    const attached = testInfo.attachments.find(t => t.name === "main-process-signal.txt")?.body?.toString() ?? String.empty;
    const reports = mainProcess.acceptFailures(quitReport(main, "SIGBUS", stackPattern));

    expect(reports).toHaveLength(1);
    expect(attached).toBe(reports[0]);
    expect(mainProcess.failures).toEqual([]);
  });

  test("accepting another process's end, or another signal, leaves the report a failure", async ({ mainProcess }) => {
    const main = await quitWithSignalAsync(mainProcess);

    await mainProcess.disposeAsync(false);

    expect(mainProcess.acceptFailures(quitReport(main + 1, "SIGBUS"))).toEqual([]);
    expect(mainProcess.acceptFailures(quitReport(main, "SIGSEGV"))).toEqual([]);
    expect(mainProcess.acceptFailures(quitReport(main, "SIGBUS"))).toHaveLength(1);
  });
});

test.describe("the launch after a main process that ends by a signal", () => {
  test.skip(process.platform !== "darwin", "Only macOS asks whether to reopen the windows of an app that ended by a signal.");

  test("opens its window after two such ends in a row, though macOS would ask whether to reopen the app's windows", async ({ mainProcess }, testInfo) => {
    const first = await quitWithSignalAsync(mainProcess, "SIGSEGV");
    await mainProcess.disposeAsync(false);
    const second = await MainProcessFixture.launchAsync(testInfo);
    const secondMain = await quitWithSignalAsync(second, "SIGSEGV");
    await second.disposeAsync(false);

    const third = await MainProcessFixture.launchAsync(testInfo);
    const isVisible = await third.isVisibleAsync();
    await third.disposeAsync();

    expect(isVisible).toBe(true);
    expect(mainProcess.acceptFailures(quitReport(first, "SIGSEGV"))).toHaveLength(1);
    expect(second.acceptFailures(quitReport(secondMain, "SIGSEGV"))).toHaveLength(1);
    expect([...mainProcess.failures, ...second.failures, ...third.failures]).toEqual([]);
  });
});

test.describe("the harness's report of a stack in the main process's error output", () => {
  test("a stack without a signal end, such as a child process's, is kept as crash output, and the test passes", async ({ mainProcess }, testInfo) => {
    const dump = ["Received signal 11 SEGV_MAPERR 000000000000", "#0 0x55d4c2b9f5b2 (electron+0x93bf5b2)", "#1 0x55d4c2b9e8ac (electron+0x93be8ac)", "[end of stack trace]"];
    await mainProcess.application.evaluate((_, lines) => {
      process.stderr.write(`${lines.join("\n")}\n`);
    }, dump);

    await mainProcess.disposeAsync(false);

    expect(testInfo.annotations.filter(t => t.type === SignalExitReport.CRASH_ANNOTATION).map(t => t.description)).toEqual([dump.join("\n")]);
    expect(testInfo.attachments.find(t => t.name === "main-process-signal.txt")).toBeUndefined();
    expect(mainProcess.failures).toEqual([]);
  });
});
