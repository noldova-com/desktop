/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { MenuItem } from "../../../src/app/models/menu-item";

describe("MenuItem", () => {
  it("refuses a choice that is not a qualified name, and is a choice only when made as one", () => {
    expect(() => MenuItem.ofChoice("sorting")).toThrowError(ArgumentException);
    expect([MenuItem.ofChoice("notes.sorting").choice, MenuItem.ofSubmenu("notes.templates").choice, MenuItem.ofCommand("notes.sortBy").choice]).toEqual(["notes.sorting", null, null]);
  });

  it("refuses a command or submenu that is not a qualified name, a blank label and a blank icon, and has no arguments, label or icon unless given them", () => {
    expect(() => MenuItem.ofCommand("sortBy")).toThrowError(ArgumentException);
    expect(() => MenuItem.ofSubmenu("templates")).toThrowError(ArgumentException);
    expect(MenuItem.ofCommand("notes.sortBy").commandArguments).toEqual({});
    expect(() => MenuItem.ofCommand("notes.sortBy", {}, " ")).toThrowError(ArgumentException);
    expect(MenuItem.ofCommand("notes.sortBy").label).toBeNull();
    expect(() => MenuItem.ofCommand("notes.sortBy", {}, null, " ")).toThrowError(ArgumentException);
    expect([MenuItem.ofCommand("notes.sortBy").icon, MenuItem.ofCommand("notes.sortBy", {}, null, "sort").icon, MenuItem.ofSubmenu("notes.templates").icon, MenuItem.ofChoice("notes.sorting").icon])
      .toEqual([null, "sort", null, null]);
  });
});
