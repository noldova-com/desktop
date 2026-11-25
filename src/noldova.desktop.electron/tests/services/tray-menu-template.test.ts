/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { CommandRun } from "@noldova/desktop.protocol";
import { ProductTrayItem } from "@noldova/desktop.runtime";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class TrayMenuTemplateTests {
  private static readonly LIGHT: string = "data:image/png;base64,TElHSFQ=";
  private static readonly DARK: string = "data:image/png;base64,REFSSw==";
  private static readonly FETCH: string = "data:image/png;base64,RkVUQ0g=";

  @TestMethod
  public async listsFiveWorkRowsWithoutAMoreRowAndLeavesOutTheNotificationsWhenNoneIsUnread(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();

    fixture.send("work", { descriptions: ["One", "Two", "Three", "Four", "Five"], sequence: 1 });
    fixture.send("notifications", { notifications: [TrayFixture.notification(1, "Read", "clock", true)], quietDevices: [], mutedModules: [], sequence: 1 });

    Assert.areEqual(
      JSON.stringify(["One (disabled)", "Two (disabled)", "Three (disabled)", "Four (disabled)", "Five (disabled)", "-", "Stop agents", "Open Noldova Desktop Sample", "Turn on Do not disturb", "-", "Quit Noldova Desktop Sample"]),
      JSON.stringify(fixture.rows));
  }

  @TestMethod
  @TestData("win32")
  @TestData("darwin")
  @TestData("linux")
  public async saysWhatDoNotDisturbsItemDoesEachWayWithNoCheckOrRadioItem(platform: string): Promise<void> {
    const fixture = new TrayFixture(platform);
    await fixture.startAsync();
    if (platform === "linux")
      await fixture.process.programs.answerAsync("(<true>,)\n");

    fixture.send("notifications", { notifications: [], quietDevices: [FakeDeviceIdentity.ID], mutedModules: [], sequence: 1 });
    const on = fixture.menu;
    fixture.send("notifications", { notifications: [], quietDevices: ["desk"], mutedModules: [], sequence: 2 });
    const off = fixture.menu;

    Assert.areEqual(
      "Turn off Do not disturb|Turn on Do not disturb",
      [on, off].map(t => t.find(u => u.label?.endsWith("Do not disturb") === true)?.label).join("|"));
    Assert.areEqual(String.empty, [...on, ...off].filter(t => t.type === "checkbox" || t.type === "radio").map(t => t.label).join(","));
  }

  @TestMethod
  public async putsEachTitleOnOneShortLineAndKeepsItsAmpersands(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    const long = `Summarize ${"the release notes ".repeat(5)}`;

    fixture.send("work", { descriptions: [`Run\n  the   tests`, long], sequence: 1 });
    fixture.send("notifications", { notifications: [TrayFixture.notification(1, "Q&A & more")], quietDevices: [], mutedModules: [], sequence: 1 });

    const rows = fixture.rows;
    Assert.areEqual("Run the tests (disabled)", rows[0]);
    Assert.areEqual(`${long.slice(0, 59).trimEnd()}… (disabled)`, rows[1]);
    Assert.areEqual(60, (rows[1] ?? String.empty).replace(" (disabled)", String.empty).length);
    Assert.areEqual("Q&&A && more", rows[2]);
  }

  @TestMethod
  public async listsTheAppsItemsInItsOrderWithTheirTextsAndCollapsesLeadingDoubledAndTrailingSeparators(): Promise<void> {
    const fixture = new TrayFixture("win32");

    await fixture.startAsync(undefined, TrayMenuTemplateTests.items([
      { separator: true },
      { item: "open", text: "Show Studio" },
      { separator: true },
      { separator: true },
      { text: "Fetch & pull", command: "git.fetch" },
      { item: "notifications" },
      { separator: true },
      { item: "work", text: "Nothing running" },
      { item: "quit", text: "Leave Studio" },
      { separator: true }
    ]));

    Assert.areEqual(JSON.stringify(["Show Studio", "-", "Fetch && pull", "-", "Nothing running (disabled)", "Leave Studio"]), JSON.stringify(fixture.rows));
  }

  @TestMethod
  public async showsTheDarkIconOnADarkMenuAndTheTemplateImageOtherwise(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync(undefined, TrayMenuTemplateTests.items([
      { item: "open", icon: TrayMenuTemplateTests.LIGHT, iconDark: TrayMenuTemplateTests.DARK, isTemplate: true },
      { text: "Fetch", command: "git.fetch", icon: TrayMenuTemplateTests.FETCH },
      { item: "quit" }
    ]));
    const dark = fixture.menu.map(t => String(t.icon));

    fixture.electron.theme.update(false, true);
    await Condition.waitAsync(() => fixture.menu.map(t => String(t.icon)).join() !== dark.join());

    Assert.areEqual(JSON.stringify([TrayMenuTemplateTests.DARK, TrayMenuTemplateTests.FETCH, "undefined"]), JSON.stringify(dark));
    Assert.areEqual(JSON.stringify([`${TrayMenuTemplateTests.LIGHT} (template)`, TrayMenuTemplateTests.FETCH, "undefined"]), JSON.stringify(fixture.menu.map(t => String(t.icon))));
  }

  @TestMethod
  public async keepsTheLightIconOnMacOsWhereTheMenuFollowsTheSystem(): Promise<void> {
    const fixture = new TrayFixture("darwin");

    await fixture.startAsync(undefined, TrayMenuTemplateTests.items([{ item: "open", icon: TrayMenuTemplateTests.LIGHT, iconDark: TrayMenuTemplateTests.DARK, isTemplate: true }]));

    Assert.areEqual(`${TrayMenuTemplateTests.LIGHT} (template)`, String(fixture.menu[0]?.icon));
  }

  @TestMethod
  public async runsAnItemsCommandThroughTheRuntimeAndNamesACommandWithoutText(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync(undefined, TrayMenuTemplateTests.items([{ item: "settings" }, { text: "Broken", command: "not a command" }, { command: "git.fetch" }]));

    fixture.click("git.fetch");
    await Condition.waitAsync(() => fixture.connection.calls.includes("desktop.runCommand"));

    Assert.areEqual(JSON.stringify(["git.fetch"]), JSON.stringify(fixture.rows));
    Assert.areEqual("git.fetch",
      fixture.connection.payloads.filter((_t, index) => fixture.connection.calls[index] === "desktop.runCommand").map(t => CommandRun.fromJson(t).name.text).join());
  }

  @TestMethod
  public async takesTheStopKeyOnlyWhenTheAppListsTheAgentsItem(): Promise<void> {
    const listed = new TrayFixture("win32");
    const unlisted = new TrayFixture("win32");
    await listed.startAsync(undefined, TrayMenuTemplateTests.items([{ item: "agents" }, { item: "quit" }]));
    await unlisted.startAsync(undefined, TrayMenuTemplateTests.items([{ item: "open" }, { item: "quit" }]));

    listed.send("agentControl", { isStopped: false, isActing: true });
    unlisted.send("agentControl", { isStopped: false, isActing: true });

    Assert.areEqual("take Control+Shift+.", listed.electron.shortcuts.steps.join(","));
    Assert.areEqual(String.empty, unlisted.electron.shortcuts.steps.join(","));
    Assert.areEqual(JSON.stringify(["Stop agents", "Quit Noldova Desktop Sample"]), JSON.stringify(listed.rows));
  }

  @TestMethod
  public async showsTheAppsLabelsForEachStateOfStopAgentsAndDoNotDisturbAndKeepsTheRefusedKeysHint(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.electron.shortcuts.refused.add("Control+Shift+.");
    await fixture.startAsync(undefined, TrayMenuTemplateTests.items([
      { item: "agents", text: "Pause agents", toggledText: "Go on" },
      { item: "doNotDisturb", text: "Mute", toggledText: "Unmute" }
    ]));
    const labels: string[] = [];

    fixture.send("agentControl", { isStopped: false, isActing: false });
    fixture.send("notifications", { notifications: [], quietDevices: [], mutedModules: [], sequence: 1 });
    labels.push(fixture.rows.join("|"));
    fixture.send("agentControl", { isStopped: false, isActing: true });
    labels.push(fixture.rows.join("|"));
    fixture.send("agentControl", { isStopped: true, isActing: true });
    fixture.send("notifications", { notifications: [], quietDevices: [FakeDeviceIdentity.ID], mutedModules: [], sequence: 2 });
    labels.push(fixture.rows.join("|"));

    Assert.areEqual(JSON.stringify(["Pause agents|Mute", "Pause agents (Ctrl+Shift+. works only in the app)|Mute", "Go on|Unmute"]), JSON.stringify(labels));
  }

  @TestMethod
  public async replacesOnlyTheLabelTheAppGivesAndKeepsTheOther(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync(undefined, TrayMenuTemplateTests.items([{ item: "agents", toggledText: "Go on" }, { item: "doNotDisturb", text: "Mute" }]));
    const labels: string[] = [];

    fixture.send("agentControl", { isStopped: false, isActing: false });
    fixture.send("notifications", { notifications: [], quietDevices: [], mutedModules: [], sequence: 1 });
    labels.push(fixture.rows.join("|"));
    fixture.send("agentControl", { isStopped: true, isActing: false });
    fixture.send("notifications", { notifications: [], quietDevices: [FakeDeviceIdentity.ID], mutedModules: [], sequence: 2 });
    labels.push(fixture.rows.join("|"));

    Assert.areEqual(JSON.stringify(["Stop agents|Mute", "Go on|Turn off Do not disturb"]), JSON.stringify(labels));
  }

  private static items(entries: readonly object[]): readonly ProductTrayItem[] {
    return entries.map(t => ProductTrayItem.fromJson(t));
  }
}
