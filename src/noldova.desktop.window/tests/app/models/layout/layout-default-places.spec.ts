/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import type { Bounds } from "../../../../src/app/models/layout/bounds";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutGeometry } from "../../../../src/app/models/layout/layout-geometry";
import { SplitNode } from "../../../../src/app/models/layout/split.node";
import { TabGroup } from "../../../../src/app/models/layout/tab-group";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../../src/app/models/layout/view-type";
import { LayoutMetricsFixture } from "../../../fixtures/layout-metrics.fixture";

describe("Layout's default places", () => {
  const view = (name: string, side: DockSide, group: number = 0, order: number | null = null): ViewType => new ViewType(name, side, true, false, null, false, group, order);
  const teamRun = new ViewRegistry([
    view("teamrun.explorer", DockSide.Left, 0, 10),
    view("teamrun.tasks", DockSide.Right, 0, 10),
    view("teamrun.pages", DockSide.Right, 0, 30),
    view("teamrun.plans", DockSide.Right, 1, 10),
    view("teamrun.agents", DockSide.Right, 1, 20),
    view("teamrun.activity", DockSide.Bottom, 0, 10),
    view("teamrun.changes", DockSide.Bottom, 0, 20),
    view("git.branches", DockSide.Right, 0, 20)
  ], []);
  const names = (group: TabGroup | undefined): readonly string[] => group?.tabs.map(t => t.name) ?? [];
  const shown = (layout: Layout, side: DockSide): readonly (readonly [readonly string[], string | null])[] =>
    (layout.dock(side).root?.groups ?? []).map(t => [names(t), t.active?.name ?? null] as const);
  const frames = (layout: Layout, registry: ViewRegistry, side: DockSide): readonly Bounds[] =>
    new LayoutGeometry(160, 80, layout, registry, LayoutMetricsFixture.standard).frames.filter(t => t.side === side).map(t => t.bounds);

  it("splits a side into the groups its views name, each with its tabs in order, across modules, and its first tab shown", () => {
    const layout = Layout.createDefault(teamRun);

    expect(shown(layout, DockSide.Left)).toEqual([[["teamrun.explorer"], "teamrun.explorer"]]);
    expect(shown(layout, DockSide.Right)).toEqual([
      [["teamrun.tasks", "git.branches", "teamrun.pages"], "teamrun.tasks"],
      [["teamrun.plans", "teamrun.agents"], "teamrun.plans"]
    ]);
    expect(shown(layout, DockSide.Bottom)).toEqual([[["teamrun.activity", "teamrun.changes"], "teamrun.activity"]]);
    expect([DockSide.Right, DockSide.Bottom].map(side => layout.dock(side).root).map(t => t instanceof SplitNode ? t.axis : null)).toEqual([SplitAxis.Vertical, null]);
  });

  it("stacks a side's groups top to bottom in equal parts of its dock, and lays the bottom's out left to right", () => {
    const layout = Layout.createDefault(teamRun);
    const [upper, lower] = frames(layout, teamRun, DockSide.Right);
    const bottom = new ViewRegistry([view("logs.output", DockSide.Bottom, 0), view("logs.problems", DockSide.Bottom, 1)], []);
    const split = Layout.createDefault(bottom);
    const [left, right] = frames(split, bottom, DockSide.Bottom);
    const root = split.dock(DockSide.Bottom).root;

    expect(shown(split, DockSide.Bottom)).toEqual([[["logs.output"], "logs.output"], [["logs.problems"], "logs.problems"]]);
    expect(root instanceof SplitNode ? root.axis : null).toBe(SplitAxis.Horizontal);
    expect([upper?.x, upper?.width, upper?.y]).toEqual([lower?.x, lower?.width, 0]);
    expect((upper?.y ?? 0) + (upper?.height ?? 0)).toBeLessThan(lower?.y ?? 0);
    expect(Math.abs((upper?.height ?? 0) - (lower?.height ?? 1))).toBeLessThan(0.01);
    expect([left?.y, left?.height]).toEqual([right?.y, right?.height]);
    expect((left?.x ?? 0) + (left?.width ?? 0)).toBeLessThan(right?.x ?? 0);
    expect(Math.abs((left?.width ?? 0) - (right?.width ?? 1))).toBeLessThan(0.01);
  });

  it("puts views without an order after the ordered ones, and keeps registry order among those and among ties", () => {
    const layout = Layout.createDefault(new ViewRegistry([
      view("a.first", DockSide.Left),
      view("b.ordered", DockSide.Left, 0, 20),
      view("c.tied", DockSide.Left, 0, 5),
      view("d.second", DockSide.Left),
      view("e.tied", DockSide.Left, 0, 5)
    ], []));

    expect(shown(layout, DockSide.Left)).toEqual([[["c.tied", "e.tied", "b.ordered", "a.first", "d.second"], "c.tied"]]);
  });

  it("leaves no empty group for a group number no view uses", () => {
    const registry = new ViewRegistry([view("a.upper", DockSide.Left, 0), view("b.lower", DockSide.Left, 2), new ViewType("c.hidden", DockSide.Left, false, false, null, false, 1, null)], []);
    const layout = Layout.createDefault(registry);
    const parts = frames(layout, registry, DockSide.Left);

    expect(shown(layout, DockSide.Left)).toEqual([[["a.upper"], "a.upper"], [["b.lower"], "b.lower"]]);
    expect(parts.length).toBe(2);
    expect(Math.abs((parts[0]?.height ?? 0) - (parts[1]?.height ?? 1))).toBeLessThan(0.01);
  });

  it("opens views that name no group or order as one group per side, as before", () => {
    const layout = Layout.createDefault(new ViewRegistry([new ViewType("files.tree", DockSide.Left, true), new ViewType("git.changes", DockSide.Left, true)], []));

    expect(layout.dock(DockSide.Left).root).toEqual(new TabGroup(1, [new ViewTab("files.tree"), new ViewTab("git.changes")], new ViewTab("files.tree")));
  });

  it("lays out a reset layout the same way, keeping no group the person made", () => {
    const changed = Layout.createDefault(teamRun).dockOnSide(new ViewTab("teamrun.agents"), DockSide.Left).close(new ViewTab("teamrun.pages"));

    expect(changed.reset(teamRun).toJson()).toEqual(Layout.createDefault(teamRun).toJson());
  });
});
