/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { StatusBarItemTone } from "../../../src/app/enums/status-bar-item-tone";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";

describe("StatusBarItemState", () => {
  it("keeps its text and options, and is shown in the neutral tone without a command by default", () => {
    const plain = new StatusBarItemState("2 notes");
    const full = new StatusBarItemState("Ticks: 3", {
      icon: "timer", tooltip: "Tick the clock", command: "clock.tick", commandArguments: { by: 1 }, isHidden: true, tone: StatusBarItemTone.Muted
    });

    expect([plain.text, plain.icon, plain.tooltip, plain.command, plain.commandArguments, plain.isHidden, plain.tone, plain.label])
      .toEqual(["2 notes", null, null, null, null, false, StatusBarItemTone.Neutral, "2 notes"]);
    expect([full.icon, full.tooltip, full.command, full.commandArguments, full.isHidden, full.tone, full.label])
      .toEqual(["timer", "Tick the clock", "clock.tick", { by: 1 }, true, StatusBarItemTone.Muted, "Tick the clock"]);
  });

  it("needs no text, icon or tooltip while it is hidden", () => {
    const hidden = new StatusBarItemState(String.empty, { isHidden: true });

    expect([hidden.text, hidden.icon, hidden.tooltip, hidden.isHidden]).toEqual([String.empty, null, null, true]);
    expect(() => new StatusBarItemState(String.empty, { isHidden: false })).toThrowError("A status bar item shows text, an icon or both.");
    expect(() => new StatusBarItemState(String.empty, { isHidden: true, icon: " " })).toThrowError(ArgumentException);
  });

  it("shows only an icon when it has a tooltip to name it", () => {
    const icon = new StatusBarItemState(String.empty, { icon: "notifications", tooltip: "Notifications" });

    expect([icon.text, icon.label]).toEqual([String.empty, "Notifications"]);
  });

  it("refuses to show nothing, an icon without a name, a blank icon or tooltip and an invalid command", () => {
    expect(() => new StatusBarItemState(" ")).toThrowError("A status bar item shows text, an icon or both.");
    expect(() => new StatusBarItemState(String.empty, { icon: "notifications" })).toThrowError(/needs a tooltip/);
    expect(() => new StatusBarItemState("Notes", { icon: " " })).toThrowError(ArgumentException);
    expect(() => new StatusBarItemState("Notes", { tooltip: String.empty })).toThrowError(ArgumentException);
    expect(() => new StatusBarItemState("Notes", { command: "tick" })).toThrowError(ArgumentException);
  });
});
