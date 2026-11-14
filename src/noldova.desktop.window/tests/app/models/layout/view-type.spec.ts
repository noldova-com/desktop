/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";

import { DockSide } from "../../../../src/app/enums/dock-side";
import { ViewType } from "../../../../src/app/models/layout/view-type";

describe("ViewType", () => {
  it("keeps a valid name, its default side and whether it shows by default", () => {
    const type = new ViewType("files.tree", DockSide.Right, true);

    expect([type.name, type.defaultSide, type.isShownByDefault]).toEqual(["files.tree", DockSide.Right, true]);
    expect(() => new ViewType("tree", DockSide.Left, false)).toThrow(ArgumentException);
  });

  it("has no instances and no tab-row place unless it is given them", () => {
    const type = new ViewType("files.tree", DockSide.Right, true);

    expect([type.hasInstances, type.tabRowPlace, type.isRenamable]).toEqual([false, null, false]);
  });

  it("never shows a view with instances by default, and keeps its tab-row place", () => {
    const type = new ViewType("terminal.session", DockSide.Bottom, true, true, "terminal.tabRow");

    expect([type.isShownByDefault, type.hasInstances, type.tabRowPlace]).toEqual([false, true, "terminal.tabRow"]);
  });

  it("is renamable only when it has instances", () => {
    const renamed = [new ViewType("terminal.session", DockSide.Bottom, false, true, null, true), new ViewType("files.tree", DockSide.Left, true, false, null, true)];

    expect(renamed.map(t => t.isRenamable)).toEqual([true, false]);
  });
});
