/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { MenuRowContribution } from "../../../src/app/models/menu-row-contribution";

describe("MenuRowContribution", () => {
  it("names a command with its arguments, an optional label and an optional icon, copying the arguments", () => {
    const commandArguments = { week: 3 };
    const row = new MenuRowContribution("notes.openNote", commandArguments, "Week 3", "calendar_month");
    commandArguments.week = 4;

    expect([row.command, row.commandArguments, row.label, row.icon]).toEqual(["notes.openNote", { week: 3 }, "Week 3", "calendar_month"]);
    const plain = new MenuRowContribution("notes.openNote");
    expect([plain.commandArguments, plain.label, plain.icon]).toEqual([{}, null, null]);
  });

  it("refuses a command that is not a qualified name, a blank label and a blank icon", () => {
    expect(() => new MenuRowContribution("openNote")).toThrowError(ArgumentException);
    expect(() => new MenuRowContribution("notes.openNote", {}, " ")).toThrowError(ArgumentException);
    expect(() => new MenuRowContribution("notes.openNote", {}, null, " ")).toThrowError(ArgumentException);
  });
});
