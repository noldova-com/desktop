/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mock } from "node:test";
import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonObject } from "@noldova/context.json";
import { type IWindowStateStore, OpenWindow, QuitQuestion, WindowStateNotConnectedException, WindowStateRefusedException } from "@noldova/desktop.electron";
import { Failure, FailureCode, QualifiedName } from "@noldova/desktop.protocol";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeCloseGuard } from "../fixtures/fake-close-guard.fixture.js";
import { FakeMainProcessLog } from "../fixtures/fake-main-process-log.fixture.js";
import { FakeMainProcessWindow } from "../fixtures/fake-main-process-window.fixture.js";
import { FakeDisplayHost } from "../fixtures/fake-display-host.fixture.js";

class RefusingStore implements IWindowStateStore {
  private readonly failure: Error;

  public constructor(failure: Error) {
    this.failure = failure;
  }

  public readAsync(): Promise<JsonObject | null> {
    return Promise.resolve(null);
  }

  public writeAsync(): Promise<void> {
    return Promise.reject(this.failure);
  }
}

@TestClass
export class OpenWindowTests {
  @TestMethod
  public async closesAndRecordsTheLostBoundsWhenTheRuntimeIsUnreachableAtClose(): Promise<void> {
    const failures = [new WindowStateNotConnectedException(),
      new WindowStateRefusedException(new QualifiedName("desktop", "writeWindowBounds"), new Failure(FailureCode.Internal, "The database is busy."))];
    const closed: FakeMainProcessWindow[] = [];
    const log = new FakeMainProcessLog();

    for (const [index, failure] of failures.entries()) {
      const window = new FakeMainProcessWindow({}, index + 1);
      const open = new OpenWindow(window, new FakeDisplayHost(), log, new FakeCloseGuard(), "win32");
      await open.bounds.restoreAsync(new RefusingStore(failure));
      window.close();
      await Condition.waitAsync(() => OpenWindowTests.closeRequests(window).length === 1);
      open.coordinator.answer(OpenWindowTests.closeRequests(window)[0], true);
      await Condition.waitAsync(() => window.isGone);
      closed.push(window);
    }

    Assert.areEqual(JSON.stringify([true, true]), JSON.stringify(closed.map(t => t.isGone)));
    Assert.areEqual(JSON.stringify([
      "The window closed without saving its bounds, because the runtime could not be reached; the last position is lost: Noldova Desktop Sample is not connected to its runtime.",
      "The window's bounds could not be saved: WindowStateRefusedException: The runtime refused desktop.writeWindowBounds: The database is busy."
    ]), JSON.stringify(log.lines));
  }

  @TestMethod
  public tellsItsPageEachTimeTheWindowEntersOrLeavesFullScreen(): void {
    const window = new FakeMainProcessWindow({}, 1);
    new OpenWindow(window, new FakeDisplayHost(), new FakeMainProcessLog(), new FakeCloseGuard(), "darwin");

    window.change("enter-full-screen");
    window.change("leave-full-screen");

    Assert.areEqual(JSON.stringify([["desktop:fullScreen", true], ["desktop:fullScreen", false]]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:fullScreen")));
  }

  @TestMethod
  public tellsItsPageEachTimeTheWindowIsMaximizedOrReturnsToItsNormalSize(): void {
    const window = new FakeMainProcessWindow({}, 1);
    new OpenWindow(window, new FakeDisplayHost(), new FakeMainProcessLog(), new FakeCloseGuard(), "linux");

    window.change("maximize");
    window.change("unmaximize");

    Assert.areEqual(JSON.stringify([["desktop:maximized", true], ["desktop:maximized", false]]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "desktop:maximized")));
  }

  @TestMethod
  public async staysOpenWithoutAskingItsPageToSaveWhileTheGuardKeepsIt(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const guard = new FakeCloseGuard();
    guard.canClose = false;
    const open = new OpenWindow(window, new FakeDisplayHost(), new FakeMainProcessLog(), guard, "win32");

    window.close();
    await Condition.waitAsync(() => guard.prompts.length === 1);
    await setImmediate();
    window.close();
    await Condition.waitAsync(() => guard.prompts.length === 2);
    await setImmediate();

    Assert.isFalse(window.isGone);
    Assert.areEqual<unknown>(open, guard.prompts[0]);
    Assert.areEqual(0, window.webContents.sent.filter(t => t[0] === "desktop:closeRequest").length);
  }

  @TestMethod
  public async savesForAQuitWithoutClosingAndClosesAtOnceWithoutTheGuardWhenTold(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const guard = new FakeCloseGuard();
    const open = new OpenWindow(window, new FakeDisplayHost(), new FakeMainProcessLog(), guard, "win32");

    const refusing = open.saveAsync();
    await Condition.waitAsync(() => OpenWindowTests.closeRequests(window).length === 1);
    open.coordinator.answer(OpenWindowTests.closeRequests(window)[0], false);
    const saving = open.saveAsync();
    await Condition.waitAsync(() => OpenWindowTests.closeRequests(window).length === 2);
    open.coordinator.answer(OpenWindowTests.closeRequests(window)[1], true);
    const results = [await refusing, await saving];
    const isGoneAfterSaving = window.isGone;
    open.closeNow();
    open.closeNow();

    Assert.areEqual("false,true", results.join(","));
    Assert.isFalse(isGoneAfterSaving);
    Assert.isTrue(window.isGone);
    Assert.areEqual(0, guard.prompts.length);
  }

  @TestMethod
  public async reportsWhetherItsPageHasPaintedOrItClosedFirst(): Promise<void> {
    const windows = [new FakeMainProcessWindow({}, 1), new FakeMainProcessWindow({}, 2), new FakeMainProcessWindow({}, 3)];
    const [painted, shown, closed] = windows.map(t => new OpenWindow(t, new FakeDisplayHost(), new FakeMainProcessLog(), new FakeCloseGuard(), "win32"));

    painted?.markPainted();
    shown?.showNow();
    windows[2]?.destroy();

    Assert.areEqual("true,true,false", (await Promise.all([painted, shown, closed].map(t => t?.whenPaintedAsync()))).join(","));
  }

  @TestMethod
  public async reportsItsPageAsPaintedOnlyOnceItPaintsEvenAfterItWasShownUnpainted(): Promise<void> {
    const windows = [new FakeMainProcessWindow({}, 1), new FakeMainProcessWindow({}, 2)];
    const [shown, closed] = windows.map(t => new OpenWindow(t, new FakeDisplayHost(), new FakeMainProcessLog(), new FakeCloseGuard(), "win32"));

    shown?.showNow();
    const beforePaint = await Promise.race([shown?.whenPagePaintedAsync(), Promise.resolve("waiting")]);
    shown?.markPainted();
    windows[1]?.destroy();

    Assert.areEqual("waiting", beforePaint);
    Assert.areEqual("true,false", (await Promise.all([shown, closed].map(t => t?.whenPagePaintedAsync()))).join(","));
  }

  @TestMethod
  public recordsOnceHowLongAfterOpeningAPageShownUnpaintedPaints(): void {
    mock.timers.enable({ apis: ["Date"] });
    try {
      const log = new FakeMainProcessLog();
      const [late, onTime] = [1, 2].map(t => new OpenWindow(new FakeMainProcessWindow({}, t), new FakeDisplayHost(), log, new FakeCloseGuard(), "win32"));

      late?.showNow();
      mock.timers.tick(12_345);
      late?.markPainted();
      late?.markPainted();
      onTime?.markPainted();

      Assert.areEqual(JSON.stringify(["The window's page painted 12.345 s after it opened, after the window was shown unpainted."]), JSON.stringify(log.lines));
    }
    finally {
      mock.timers.reset();
    }
  }

  @TestMethod
  public showsTheQuestionToItsPageUnlessTheWindowIsGoneOrItsPageHasCrashed(): void {
    const window = new FakeMainProcessWindow({}, 1);
    const crashed = new FakeMainProcessWindow({}, 2);
    crashed.webContents.crashed = true;
    const gone = new FakeMainProcessWindow({}, 3);
    gone.destroy();
    const open = new OpenWindow(window, new FakeDisplayHost(), new FakeMainProcessLog(), new FakeCloseGuard(), "win32");

    const shown = open.show(new QuitQuestion(["Indexing the project"], true, false));
    const cleared = open.show(null);
    const onCrashed = new OpenWindow(crashed, new FakeDisplayHost(), new FakeMainProcessLog(), new FakeCloseGuard(), "win32").show(null);
    const onGone = new OpenWindow(gone, new FakeDisplayHost(), new FakeMainProcessLog(), new FakeCloseGuard(), "win32").show(null);

    Assert.isTrue(shown && cleared);
    Assert.isFalse(onCrashed || onGone);
    Assert.areEqual(
      JSON.stringify([["desktop:quitQuestion", { descriptions: ["Indexing the project"], isWaiting: true, isUpdate: false }], ["desktop:quitQuestion", null]]),
      JSON.stringify(window.webContents.sent));
    Assert.areEqual(0, crashed.webContents.sent.length);
  }

  @TestMethod
  public async showsAWindowWhosePageNeverReportsItsPaintAfterTheLimitAndRecordsWhy(): Promise<void> {
    const pages = [{ loading: false, crashed: false }, { loading: true, crashed: false }, { loading: true, crashed: true }];
    const windows = pages.map((t, i) => {
      const window = new FakeMainProcessWindow({}, i + 1);
      window.webContents.loading = t.loading;
      window.webContents.crashed = t.crashed;
      return window;
    });
    const log = new FakeMainProcessLog();

    for (const window of windows)
      new OpenWindow(window, new FakeDisplayHost(), log, new FakeCloseGuard(), "win32").showUnpaintedWithin(20);
    const isShownEarly = windows.some(t => t.isShown);
    await Condition.waitAsync(() => windows.every(t => t.isShown) && log.lines.length === 3);

    Assert.isFalse(isShownEarly);
    Assert.areEqual(JSON.stringify([["show"], ["show"], ["show"]]), JSON.stringify(windows.map(t => t.calls)));
    Assert.areEqual(JSON.stringify([
      "The window was shown before it was painted, 0.02 s after it opened, because its page loaded but did not report its first paint.",
      "The window was shown before it was painted, 0.02 s after it opened, because its page is still loading.",
      "The window was shown before it was painted, 0.02 s after it opened, because its page has crashed."
    ]), JSON.stringify(log.lines));
  }

  @TestMethod
  public async showsAPaintedWindowOnceSettledAndNeverRecordsItAsUnpainted(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const log = new FakeMainProcessLog();
    const open = new OpenWindow(window, new FakeDisplayHost(), log, new FakeCloseGuard(), "win32");
    open.settleWithin(10);
    open.showUnpaintedWithin(30);

    open.markPainted();
    const isShownBeforeSettling = window.isShown;
    const fence = OpenWindowTests.startFence(30);
    await Condition.waitAsync(() => window.isShown && fence.isShown);

    Assert.isFalse(isShownBeforeSettling);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(0, log.lines.length);
  }

  @TestMethod
  public async showsNothingForAWindowClosedBeforeTheLimit(): Promise<void> {
    const window = new FakeMainProcessWindow({}, 1);
    const log = new FakeMainProcessLog();
    const open = new OpenWindow(window, new FakeDisplayHost(), log, new FakeCloseGuard(), "win32");
    open.settleWithin(10);
    open.showUnpaintedWithin(20);

    window.destroy();
    const fence = OpenWindowTests.startFence(20);
    await Condition.waitAsync(() => fence.isShown);

    Assert.areEqual("[]", JSON.stringify(window.calls));
    Assert.areEqual(0, log.lines.length);
  }

  private static closeRequests(window: FakeMainProcessWindow): unknown[] {
    return window.webContents.sent.filter(t => t[0] === "desktop:closeRequest").map(t => t[1]);
  }

  private static startFence(milliseconds: number): FakeMainProcessWindow {
    const fence = new FakeMainProcessWindow({}, 99);
    new OpenWindow(fence, new FakeDisplayHost(), new FakeMainProcessLog(), new FakeCloseGuard(), "win32").showUnpaintedWithin(milliseconds);
    return fence;
  }
}
