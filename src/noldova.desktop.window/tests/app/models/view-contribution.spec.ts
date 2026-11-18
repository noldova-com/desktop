/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, type Type } from "@angular/core";

import { ArgumentException } from "@noldova/context.exceptions";

import { ContentPadding } from "../../../src/app/enums/content-padding";
import { DockSide } from "../../../src/app/enums/dock-side";
import { ViewContribution } from "../../../src/app/models/view-contribution";

@Component({ template: "" })
class FilesViewComponent {
}

describe("ViewContribution", () => {
  const load = (): Promise<Type<unknown>> => Promise.resolve(FilesViewComponent);

  it("keeps its name, title, icon, default place and loader", async () => {
    const view = new ViewContribution("files.tree", "Files", "folder", DockSide.Left, true, load);

    expect([view.name, view.title, view.icon, view.defaultSide, view.isShownByDefault]).toEqual(["files.tree", "Files", "folder", DockSide.Left, true]);
    expect(await view.loadComponent()).toBe(FilesViewComponent);
  });

  it("leaves its padding to its module unless it declares one", () => {
    expect([new ViewContribution("files.tree", "Files", "folder", DockSide.Left, true, load).padding, new ViewContribution("files.tree", "Files", "folder", DockSide.Left, true, load, ContentPadding.None).padding])
      .toEqual([null, ContentPadding.None]);
  });

  it("has no instances and no tab-row place unless its options give them", () => {
    const plain = new ViewContribution("terminal.session", "Terminal", "terminal", DockSide.Bottom, false, load);
    const sessions = new ViewContribution("terminal.session", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true, tabRowPlace: "terminal.tabRow" });

    expect([plain.hasInstances, plain.tabRowPlace, sessions.hasInstances, sessions.tabRowPlace, sessions.padding]).toEqual([false, null, true, "terminal.tabRow", null]);
  });

  it("is renamable only when its options say so, and refuses it for a view without instances", () => {
    const plain = new ViewContribution("terminal.session", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true });
    const renamed = new ViewContribution("terminal.session", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { hasInstances: true, isRenamable: true });

    expect([plain.isRenamable, renamed.isRenamable]).toEqual([false, true]);
    expect(() => new ViewContribution("files.tree", "Files", "folder", DockSide.Left, true, load, undefined, { isRenamable: true }))
      .toThrowError("Only a view with instances can be renamable.");
  });

  it("keeps the default group and order its options give, and group 0 with no order without them", () => {
    const plain = new ViewContribution("files.tree", "Files", "folder", DockSide.Left, true, load);
    const placed = new ViewContribution("git.branches", "Git", "branch", DockSide.Right, true, load, undefined, { defaultGroup: 0, defaultOrder: 20 });
    const lower = new ViewContribution("teamrun.plans", "Plans", "list", DockSide.Right, true, load, undefined, { defaultGroup: 1, defaultOrder: 0 });

    expect([[plain.defaultGroup, plain.defaultOrder], [placed.defaultGroup, placed.defaultOrder], [lower.defaultGroup, lower.defaultOrder]]).toEqual([[0, null], [0, 20], [1, 0]]);
  });

  for (const options of [{ defaultGroup: -1 }, { defaultGroup: 1.5 }, { defaultGroup: Number.NaN }, { defaultOrder: -10 }, { defaultOrder: 2.5 }, { defaultOrder: Number.POSITIVE_INFINITY }])
    it(`refuses the default place ${JSON.stringify(options)}`, () => {
      expect(() => new ViewContribution("git.branches", "Git", "branch", DockSide.Right, true, load, undefined, options))
        .toThrowError("A view's default group and default order are whole numbers of 0 or more.");
    });

  it("refuses a tab-row place that is not <module id>.<name>", () => {
    expect(() => new ViewContribution("terminal.session", "Terminal", "terminal", DockSide.Bottom, false, load, undefined, { tabRowPlace: "tabRow" })).toThrowError(ArgumentException);
  });

  for (const [name, title, icon] of [["tree", "Files", "folder"], ["files.tree", " ", "folder"], ["files.tree", "Files", String.empty]] as const)
    it(`refuses the name "${name}", the title "${title}" and the icon "${icon}"`, () => {
      expect(() => new ViewContribution(name, title, icon, DockSide.Right, false, load)).toThrowError(ArgumentException);
    });
});
