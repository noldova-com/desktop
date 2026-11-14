/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Response } from "@noldova/desktop.protocol";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class TrayNoticesTests {
  @TestMethod
  public async closesIntoTheTrayWhileItsIconShowsAndSaysSoOnceWithoutQuitting(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.files.state.readFailure = new SyntaxError("Unexpected end of JSON input");
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);

    window.close();
    const hintsBeforeSaving = fixture.electron.notifications.created.length;
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone && fixture.files.state.writes.length === 1);
    const [hint] = fixture.electron.notifications.created;
    hint?.click();
    const reopened = fixture.electron.windows[1];
    reopened?.close();
    if (!Object.isUndefined(reopened))
      await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", reopened, 1);
    await Condition.waitAsync(() => reopened?.isGone === true);

    Assert.areEqual(0, hintsBeforeSaving);
    Assert.areEqual(JSON.stringify(["Noldova Desktop Sample is still running", "Open it again or quit it from its icon in the notification area.", true]),
      JSON.stringify([hint?.title, hint?.options.body, hint?.isShown]));
    Assert.areEqual(1, fixture.electron.notifications.created.length);
    Assert.areEqual(JSON.stringify([{ trayCloseHintShown: true }]), JSON.stringify(fixture.files.state.writes));
    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, "The device's state could not be read, so its hints count as not shown and the tray icon follows its default until the runtime answers: SyntaxError: Unexpected end of JSON input").length);
    Assert.isFalse(fixture.electron.app.calls.some(t => t.startsWith("quit")));
    Assert.isFalse(fixture.connection.calls.includes("desktop.stop"));
  }

  @TestMethod
  public async removesItsTrayHintWhenItQuits(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    window.close();
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone && fixture.electron.notifications.created.length === 1);
    const [hint] = fixture.electron.notifications.created;
    const isClosedBeforeQuitting = hint?.isClosed;

    fixture.click("Quit Noldova Desktop Sample");
    await Condition.waitAsync(() => fixture.electron.app.calls.includes("quit"));
    fixture.electron.app.emit("will-quit");

    Assert.areEqual(JSON.stringify([true, false, true]), JSON.stringify([hint?.isShown, isClosedBeforeQuitting, hint?.isClosed]));
  }

  @TestMethod
  public async closesIntoTheTrayWithoutRecordingTheHintWhereNotificationsCannotShow(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.electron.notifications.isSupportedNow = false;
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    const checksBeforeClosing = fixture.electron.notifications.supportChecks;

    window.close();
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => window.isGone && fixture.electron.notifications.supportChecks > checksBeforeClosing);

    Assert.areEqual(0, fixture.electron.notifications.created.length + fixture.files.state.writes.length);
    Assert.isFalse(fixture.electron.app.calls.some(t => t.startsWith("quit")));
  }

  @TestMethod
  public async logsATrayHintTheSystemRefusesAndRecordsNothingForTheRestOfTheRun(): Promise<void> {
    const fixture = new TrayFixture("linux");
    fixture.electron.notifications.refusal = "Notifications are turned off.";
    await fixture.startAsync();
    await fixture.process.programs.answerAsync("(<true>,)\n");
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    window.close();
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "linux", window, 1);
    await Condition.waitAsync(() => window.isGone && MainProcessStartFixture.readErrors(fixture.process, "The operating system did not show").length === 1);

    fixture.electron.notifications.refusal = null;
    fixture.tray.click();
    const reopened = fixture.electron.windows[1];
    reopened?.close();
    if (!Object.isUndefined(reopened))
      await MainProcessStartFixture.answerSaveAsync(fixture.electron, "linux", reopened, 1);
    await Condition.waitAsync(() => reopened?.isGone === true);

    Assert.areEqual(JSON.stringify(["The operating system did not show the hint that Noldova Desktop Sample is still running, so it counts as not shown: Notifications are turned off."]),
      JSON.stringify(MainProcessStartFixture.readErrors(fixture.process, "The operating system did not show")));
    Assert.areEqual(JSON.stringify([["Open it again or quit it from its icon in the tray.", false]]),
      JSON.stringify(fixture.electron.notifications.created.map(t => [t.options.body, t.isShown])));
    Assert.isFalse(fixture.files.state.writes.some(t => Object.hasOwn(t, "trayCloseHintShown")));
  }

  @TestMethod
  public async showsNoTrayHintForAWindowThatClosesWhileAQuitRuns(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    const stopping = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("desktop.stop", () => stopping.promise);

    fixture.click("Quit Noldova Desktop Sample");
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", window, 1);
    await Condition.waitAsync(() => fixture.connection.calls.includes("desktop.stop"));
    window.destroy();
    await setImmediate();
    const hintsWhileQuitting = fixture.electron.notifications.created.length;
    stopping.resolve(Response.success("r", null));
    await Condition.waitAsync(() => fixture.electron.app.calls.includes("quit"));

    Assert.areEqual(0, hintsWhileQuitting);
    Assert.areEqual(0, fixture.electron.notifications.created.length);
    Assert.isFalse(fixture.files.state.writes.some(t => Object.hasOwn(t, "trayCloseHintShown")));
  }
}
