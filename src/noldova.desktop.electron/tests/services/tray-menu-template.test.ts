/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class TrayMenuTemplateTests {
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
}
