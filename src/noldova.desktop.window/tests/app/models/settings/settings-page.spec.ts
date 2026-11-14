/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { SettingType } from "@noldova/desktop.protocol";

import { SettingsPage } from "../../../../src/app/models/settings/settings-page";
import { SettingsPageEntry } from "../../../../src/app/models/settings/settings-page-entry";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { SettingsFixture } from "../../../fixtures/settings.fixture";

describe("SettingsPage", () => {
  const summarize = (pages: readonly SettingsPage[]): readonly string[] =>
    pages.map(t => `${t.title}${t.isShortcuts ? "*" : String.empty}${t.isAbout ? "!" : String.empty}: ${t.groups.map(u => `${u.title}(${u.definitions.map(v => v.name.text).join(",")})`).join(" ")}`);

  it("puts Appearance, Notifications and Keyboard shortcuts first, then each module's pages by name, with their groups in order, and About last", () => {
    expect(summarize(SettingsPage.pagesOf([SettingsFixture.updateChecks, ...[...SettingsFixture.all].reverse()]))).toEqual([
      "Appearance: Text(desktop.panelSize) Theme(desktop.mode)",
      "Notifications: Notifications(desktop.mutedModules,desktop.doNotDisturb)",
      "Keyboard shortcuts*: ",
      "Clock: Ticks(clock.tickStep) Words(clock.greeting)",
      "About!: Updates(desktop.updateChecks)"
    ]);
  });

  it("puts General first once it has settings, a module's among them", () => {
    const pages = SettingsPage.pagesOf([SettingsFixture.timeFormat, SettingsFixture.dateTimeFormat, ...SettingsFixture.all, SettingsFixture.alarmSound]);

    expect(summarize(pages.slice(0, 2))).toEqual([
      "General: Date and time(desktop.timeFormat,desktop.dateTimeFormat) Clock(clock.alarmSound)",
      "Appearance: Theme(desktop.mode) Text(desktop.panelSize)"
    ]);
    expect(pages.map(t => t.isGeneral)).toEqual(pages.map((_, index) => index === 0));
  });

  it("puts the pages it is given before About", () => {
    const pages = SettingsPage.pagesOf(SettingsFixture.all, [SettingsPage.galleryOf("Gallery")]);

    expect(pages.map(t => t.title)).toEqual(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Gallery", "About"]);
  });

  it("puts a module's own pages after the last page its settings name but a leading one, else after the others, before the pages it is given, and keeps them when filtered", () => {
    const entry = (name: string, title: string): SettingsPageEntry => new SettingsPageEntry(name, title, name.split(".")[0] ?? String.empty, null, null, null);
    const own = [entry("notes.sync", "Sync"), entry("clock.alarms", "Alarms"), entry("clock.world", "World clock")];
    const pages = SettingsPage.pagesOf([SettingsFixture.timeFormat, SettingsFixture.alarmSound, ...SettingsFixture.all], [SettingsPage.galleryOf("Gallery")], own);

    expect(pages.map(t => [t.title, t.entry?.name ?? null])).toEqual([
      ["General", null], ["Appearance", null], ["Notifications", null], ["Keyboard shortcuts", null], ["Clock", null],
      ["Alarms", "clock.alarms"], ["World clock", "clock.world"], ["Sync", "notes.sync"], ["Gallery", null], ["About", null]
    ]);
    expect(pages.filter(t => !Object.isNull(t.entry)).map(t => [t.groups, t.filter(() => false).entry])).toEqual(own.slice(1).concat(own.slice(0, 1)).map(t => [[], t]));
    expect(SettingsPage.pagesOf([SettingsFixture.alarmSound], [], own.slice(1, 2)).map(t => t.title)).toEqual(["General", "Appearance", "Notifications", "Keyboard shortcuts", "Alarms", "About"]);
  });

  it("gives a module's own page the groups of the settings that name its title, after no page of that title of its own, and filters them", () => {
    const own = [new SettingsPageEntry("clock.alarms", "Alarms", "clock", null, null, null)];
    const snooze = SettingsFixture.define("tasks.snooze", "Snooze", "How long a task's alarm waits.", SettingType.text(20), "5", "Alarms", "Tasks");
    const pages = SettingsPage.pagesOf([...SettingsFixture.all, snooze, SettingsFixture.greeting], [], own);
    const alarms = pages.filter(t => t.title === "Alarms");

    expect(pages.map(t => t.title)).toEqual(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Alarms", "About"]);
    expect(summarize(alarms)).toEqual(["Alarms: Tasks(tasks.snooze)"]);
    expect(alarms.map(t => [t.entry, summarize([t.filter(u => u.name.text !== "tasks.snooze")])])).toEqual([[own[0], ["Alarms: "]]]);
  });

  it("makes a Gallery page of no settings", () => {
    const gallery = SettingsPage.galleryOf("Gallery");

    expect([gallery.title, gallery.isGallery, gallery.isShortcuts, gallery.groups]).toEqual(["Gallery", true, false, []]);
    expect(SettingsPage.pagesOf(SettingsFixture.all).some(t => t.isGallery)).toBe(false);
  });

  it("keeps the leading pages but General even without settings, and filters a page's groups down to the matching settings", () => {
    const appearance = DomFixture.present(SettingsPage.pagesOf(SettingsFixture.all).at(0));

    expect(summarize(SettingsPage.pagesOf([]))).toEqual(["Appearance: ", "Notifications: ", "Keyboard shortcuts*: ", "About!: "]);
    expect(summarize([appearance.filter(t => t.title.includes("size"))])).toEqual(["Appearance: Text(desktop.panelSize)"]);
  });
});
