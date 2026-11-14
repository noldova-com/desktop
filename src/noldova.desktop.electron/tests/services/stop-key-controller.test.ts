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
import { CommandRun, Failure, FailureCode, Response } from "@noldova/desktop.protocol";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class StopKeyControllerTests {
  private static readonly REFUSED_TITLE: string = "The stop key works only in the app";
  private static readonly NOT_READ: string = "The runtime's agent control could not be read, so the stop key waits for its next change: ";

  @TestMethod
  public async takesTheStopKeyWhileAnAgentSessionIsOpenStopsAgentsWhenThePersonPressesItAndResumesFromTheTray(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.agentControl", Response.success("r", { isStopped: false, isActing: true }));
    await fixture.startAsync();
    const taken = [...fixture.electron.shortcuts.steps];

    fixture.electron.shortcuts.press("Control+Shift+.");
    await Condition.waitAsync(() => fixture.connection.calls.includes("desktop.runCommand"));
    fixture.send("agentControl", { isStopped: true, isActing: true });
    const stoppedRows = fixture.rows;
    fixture.click("Resume agents");
    await Condition.waitAsync(() => fixture.connection.calls.filter(t => t === "desktop.runCommand").length === 2);
    fixture.send("agentControl", { isStopped: true, isActing: false });
    fixture.send("agentControl", { isStopped: false, isActing: false });

    Assert.areEqual("take Control+Shift+.", taken.join(","));
    Assert.areEqual("desktop.stopAgentControl,desktop.resumeAgentControl",
      fixture.connection.payloads.filter((_t, index) => fixture.connection.calls[index] === "desktop.runCommand").map(t => CommandRun.fromJson(t).name.text).join(","));
    Assert.isTrue(stoppedRows.includes("Resume agents"), stoppedRows.join(","));
    Assert.areEqual("take Control+Shift+.,release Control+Shift+.", fixture.electron.shortcuts.steps.join(","));
    Assert.isTrue(fixture.rows.includes("Stop agents"), fixture.rows.join(","));
  }

  @TestMethod
  public async followsThePersonsBindingAtOnceAndTakesNoKeyWhenTheyRemoveIt(): Promise<void> {
    const fixture = new TrayFixture("darwin");
    await fixture.startAsync();
    const bind = (value: Readonly<Record<string, string | null>>): void => fixture.send("settingsChanged", { name: "desktop.keyBindings", value: { "notes.newNote": "Mod+Alt+N", ...value }, isSet: true });

    fixture.send("agentControl", { isStopped: false, isActing: true });
    bind({ "desktop.stopAgentControl": "Ctrl+Alt+F12" });
    bind({ "desktop.stopAgentControl": null });
    const removed = fixture.electron.shortcuts.steps.at(-1);
    bind({ "desktop.stopAgentControl": "Mod+C" });
    bind({});
    bind({ "desktop.stopAgentControl": "Mod+Alt+Backquote" });
    fixture.send("settingsChanged", { name: "desktop.keyBindings", value: {}, isSet: false });

    Assert.areEqual(
      ["take Command+Shift+.", "release Command+Shift+.", "take Control+Alt+F12", "release Control+Alt+F12", "take Command+Shift+.", "release Command+Shift+.",
        "take Command+Alt+`", "release Command+Alt+`", "take Command+Shift+."].join(","),
      fixture.electron.shortcuts.steps.join(","));
    Assert.areEqual("release Control+Alt+F12", removed);
  }

  @TestMethod
  public async tellsThePersonOnceWhenTheSystemRefusesTheKeyAndKeepsTheTraysStopWorking(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.electron.shortcuts.refused.add("Control+Shift+.");
    await fixture.startAsync();

    fixture.send("agentControl", { isStopped: false, isActing: true });
    const refusedRows = fixture.rows;
    fixture.send("agentControl", { isStopped: false, isActing: false });
    const freedRows = fixture.rows;
    fixture.send("agentControl", { isStopped: false, isActing: true });
    fixture.click("Stop agents (Ctrl+Shift+. works only in the app)");
    await Condition.waitAsync(() => fixture.connection.calls.includes("desktop.runCommand"));
    const notices = fixture.electron.notifications.created.filter(t => t.title === StopKeyControllerTests.REFUSED_TITLE);
    const window = MainProcessStartFixture.firstWindow(fixture.electron);
    fixture.electron.ipcMain.send("desktop:ready", MainProcessStartFixture.trustedEvent("win32"), MainProcessStartFixture.APPEARANCE);
    await Condition.waitAsync(() => window.isShown);
    const focused = window.calls.filter(t => t === "focus").length;
    notices[0]?.click();

    Assert.isTrue(refusedRows.includes("Stop agents (Ctrl+Shift+. works only in the app)"), refusedRows.join(","));
    Assert.isTrue(freedRows.includes("Stop agents"), freedRows.join(","));
    Assert.areEqual("take Control+Shift+.,take Control+Shift+.", fixture.electron.shortcuts.steps.join(","));
    Assert.areEqual(1, notices.length);
    Assert.areEqual(
      "The system refused Ctrl+Shift+., so it stops agents only while Noldova Desktop Sample is in front. Stop agents in its icon's menu in the notification area works at any time.",
      notices[0]?.options.body);
    Assert.areEqual("desktop.stopAgentControl", CommandRun.fromJson(fixture.connection.payloads[fixture.connection.calls.indexOf("desktop.runCommand")]).name.text);
    Assert.areEqual(focused + 1, window.calls.filter(t => t === "focus").length);
  }

  @TestMethod
  public async takesItsNoticeBackWhenItQuits(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.electron.shortcuts.refused.add("Control+Shift+.");
    await fixture.startAsync();
    fixture.send("agentControl", { isStopped: false, isActing: true });
    const [notice] = fixture.electron.notifications.created.filter(t => t.title === StopKeyControllerTests.REFUSED_TITLE);
    const isClosedBeforeQuitting = notice?.isClosed;

    fixture.click("Quit Noldova Desktop Sample");
    await MainProcessStartFixture.answerSaveAsync(fixture.electron, "win32", MainProcessStartFixture.firstWindow(fixture.electron), 1);
    await Condition.waitAsync(() => fixture.electron.app.calls.includes("quit"));
    fixture.electron.app.emit("will-quit");

    Assert.areEqual(JSON.stringify([true, false, true]), JSON.stringify([notice?.isShown, isClosedBeforeQuitting, notice?.isClosed]));
  }

  @TestMethod
  public async logsAKeyTheSystemCannotTakeANoticeItCannotShowAndAStopTheRuntimeRefuses(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.electron.shortcuts.failure = new Error("The portal is not available.");
    fixture.electron.notifications.refusal = "The notification service is gone.";
    fixture.connection.answers.set("desktop.runCommand", Response.failure("r", new Failure(FailureCode.Unavailable, "The runtime is stopping.")));
    await fixture.startAsync();

    fixture.send("agentControl", { isStopped: false, isActing: true });
    fixture.click("Stop agents (Ctrl+Shift+. works only in the app)");
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(fixture.process, "The command desktop.stopAgentControl could not run").length > 0);

    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, "The stop key Control+Shift+. could not be taken system-wide, so it works only in the app: Error: The portal is not available.").length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, "The operating system did not show the notice that the stop key works only in the app: The notification service is gone.").length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, "The command desktop.stopAgentControl could not run from the stop key or the tray: The runtime is stopping.").length);
  }

  @TestMethod
  public async logsAnAgentControlStateItCannotReadAndTakesNoKeyForIt(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.agentControl", Response.failure("r", new Failure(FailureCode.Unavailable, "The database is busy.")));
    await fixture.startAsync();
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(fixture.process, StopKeyControllerTests.NOT_READ).length > 0);

    fixture.send("agentControl", { isStopped: "no", isActing: true });

    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, `${StopKeyControllerTests.NOT_READ}The database is busy.`).length);
    Assert.areEqual(2, MainProcessStartFixture.readErrors(fixture.process, StopKeyControllerTests.NOT_READ).length);
    Assert.areEqual(String.empty, fixture.electron.shortcuts.steps.join(","));
  }

  @TestMethod
  public async namesTheTrayOutsideWindowsAndShowsNoNoticeWhereNotificationsAreNotSupported(): Promise<void> {
    const shown = new TrayFixture("darwin");
    const hidden = new TrayFixture("darwin");
    for (const fixture of [shown, hidden])
      fixture.electron.shortcuts.refused.add("Command+Shift+.");
    hidden.electron.notifications.isSupportedNow = false;
    await shown.startAsync();
    await hidden.startAsync();

    shown.send("agentControl", { isStopped: false, isActing: true });
    hidden.send("agentControl", { isStopped: false, isActing: true });

    Assert.isTrue(shown.electron.notifications.created.find(t => t.title === StopKeyControllerTests.REFUSED_TITLE)?.options.body?.endsWith(
      "so it stops agents only while Noldova Desktop Sample is in front. Stop agents in its icon's menu in the tray works at any time.") === true);
    Assert.areEqual(0, hidden.electron.notifications.created.filter(t => t.title === StopKeyControllerTests.REFUSED_TITLE).length);
    Assert.isTrue(hidden.rows.some(t => t.startsWith("Stop agents (") && t.endsWith(" works only in the app)")), hidden.rows.join(","));
  }

  @TestMethod
  public async keepsTheDefaultKeyForABindingThatIsNoKey(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    fixture.send("agentControl", { isStopped: false, isActing: true });

    for (const value of [42, "Not a key", "Ctrl+Alt+F12"])
      fixture.send("settingsChanged", { name: "desktop.keyBindings", value: { "desktop.stopAgentControl": value }, isSet: true });

    Assert.areEqual("take Control+Shift+.,release Control+Shift+.,take Control+Alt+F12", fixture.electron.shortcuts.steps.join(","));
  }

  @TestMethod
  public async ignoresAnAnswerOlderThanAChangeAndGivesTheKeyBackWhenTheRuntimeGoesAway(): Promise<void> {
    const fixture = new TrayFixture("win32");
    const late = Promise.withResolvers<Response>();
    fixture.connection.deferred.set("desktop.agentControl", () => late.promise);
    await fixture.startAsync();

    fixture.send("agentControl", { isStopped: false, isActing: true });
    late.resolve(Response.success("r", { isStopped: false, isActing: false }));
    await setImmediate();
    const kept = [...fixture.electron.shortcuts.steps];
    fixture.launcher.listener?.onDisconnected(null);
    const awayRows = fixture.rows;

    Assert.areEqual("take Control+Shift+.", kept.join(","));
    Assert.isTrue(awayRows.includes("Stop agents (disabled)"), awayRows.join(","));
    Assert.areEqual("take Control+Shift+.,release Control+Shift+.", fixture.electron.shortcuts.steps.join(","));
  }

  @TestMethod
  public async givesTheKeyBackWhenTheAppQuits(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.agentControl", Response.success("r", { isStopped: false, isActing: true }));
    await fixture.startAsync();

    fixture.electron.app.emit("will-quit");

    Assert.areEqual("take Control+Shift+.,release Control+Shift+.", fixture.electron.shortcuts.steps.join(","));
  }
}
