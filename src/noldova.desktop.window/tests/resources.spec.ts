/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../src/resources";

describe("Resources", () => {
  it("formats the unregistered-view and unsupported-version messages", () => {
    expect(Resources.formatUnregisteredView("files.tree")).toBe("No view named \"files.tree\" is registered.");
    expect(Resources.formatUnsupportedVersion(2)).toBe("Layout format version 2 is not supported; this build reads version 1.");
    expect(Resources.formatDraggedTab("Files")).toBe("Moving Files");
    expect(Resources.formatForeignDocument("notes", "clock.face")).toBe("The module \"notes\" can open only its own documents, not \"clock.face\".");
    expect(Resources.formatUnregisteredDocument("notes.page")).toBe("No document named \"notes.page\" is registered.");
    expect(Resources.formatSrgbColor("oklch(1 0 0)")).toBe("color-mix(in srgb, oklch(1 0 0), oklch(1 0 0))");
  });

  it("formats the modules that didn't start and their details, with or without a cause", () => {
    expect(Resources.formatModulesDidNotStart(1)).toBe("1 module didn't start");
    expect(Resources.formatModulesDidNotStart(3)).toBe("3 modules didn't start");
    expect(Resources.formatModuleDidNotStart("Clock")).toBe("Clock didn't start");
    expect(Resources.formatModuleOff("Clock")).toBe("Clock is off");
    expect(Resources.formatPartSaveFailedStayedOn("Clock")).toBe("Clock couldn't save, so nothing was turned off");
    expect(Resources.formatPartSaveFailedBeforeStop("Clock")).toBe("Clock couldn't save before it stopped");
    expect(Resources.formatPartSaveFailedBeforeReset("Clock")).toBe("Clock couldn't save, so the layout wasn't reset");
    expect(Resources.formatPlatformDetails("win32", "x64")).toBe("Platform: win32 x64");
    expect(Resources.formatModuleDetails("clock", "0.4.0", "Failed", "Its runtime part failed to activate.")).toBe("clock 0.4.0: Failed: Its runtime part failed to activate.");
    expect(Resources.formatModuleDetails("clock", "0.4.0", "Active", null)).toBe("clock 0.4.0: Active");
  });

  it("formats how long a program has run in minutes, hours and days, its start, its process and a module's count of programs", () => {
    expect([0, 3, 59, 60, 90, 1439, 1440, 1500].map(t => Resources.formatRunningFor(t))).toEqual([
      "Less than a minute", "3 min", "59 min", "1 h", "1 h 30 min", "23 h 59 min", "1 d", "1 d 1 h"
    ]);
    expect(Resources.formatProgramDetails("/opt/clock/clock", 4210, "Oct 6, 2026, 8:00 AM")).toBe("/opt/clock/clock · Process 4210, started Oct 6, 2026, 8:00 AM");
    expect([Resources.formatProgramCount(1), Resources.formatProgramCount(2)]).toEqual(["1 program", "2 programs"]);
  });

  it("accepts contribution names of the form <module id>.<name> only", () => {
    const valid = ["files.tree", "desktop.settings", "git-history.log", "a1.b.c_d-e"];
    const invalid = ["files", ".tree", "Files.tree", "files.", "files..tree", "git--log.x", "files.tree view"];

    expect(valid.filter(t => !Resources.contributionNamePattern.test(t))).toEqual([]);
    expect(invalid.filter(t => Resources.contributionNamePattern.test(t))).toEqual([]);
  });

  it("names a single search source alone in the placeholder", () => {
    expect([Resources.formatSearchPlaceholder(["notes"]), Resources.formatSearchPlaceholder(["notes", "tags", "files"])]).toEqual(["Search notes", "Search notes, tags and files"]);
  });

  it("names the product it is given in the messages about it", () => {
    expect([Resources.formatAboutLabel("Example Product"), Resources.formatStartingTitle("Example Product"), Resources.formatOpenLinkInAppTitle("Example Product")])
      .toEqual(["About Example Product", "Starting Example Product…", "Open in Example Product"]);
  });

  it("states the wait for a window part's save in whole seconds of the save timeout", () => {
    expect([Resources.partSaveTimeout, Resources.formatPartSaveUnfinishedText("Example Product"), Resources.formatWindowPartSaveUnfinished("Example Product"),
      Resources.formatWindowPartSaveUnfinishedForUpdate("Example Product")]).toEqual([4000, "Example Product closed after waiting 4 seconds for it.",
      "Its window part did not finish saving within 4 seconds while Example Product was closing; Example Product closed without it.",
      "Its window part did not finish saving within 4 seconds while Example Product was preparing to install an update; the update stopped."]);
  });
});
