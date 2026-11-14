/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DockSide } from "../../../src/app/enums/dock-side";
import { Bounds } from "../../../src/app/models/layout/bounds";
import { Layout } from "../../../src/app/models/layout/layout";
import { SideDropTarget } from "../../../src/app/models/layout/side-drop-target";
import { DockGrowthService } from "../../../src/app/services/dock-growth.service";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutMetricsFixture } from "../../fixtures/layout-metrics.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

describe("DockGrowthService", () => {
  const registry = LayoutFixture.createRegistry();
  const terminal = LayoutFixture.terminal;
  let layout: LayoutService;
  let growth: DockGrowthService;

  beforeEach(async () => {
    PreloadBridgeFixture.install();
    vi.useFakeTimers();
    layout = TestBed.inject(LayoutService);
    layout.setMetrics(LayoutMetricsFixture.standard);
    layout.setRegistry(registry);
    growth = TestBed.inject(DockGrowthService);
    await TestBed.inject(LayoutStoreService).writeAsync(Layout.createDefault(registry).openView(terminal, registry).openDocument(LayoutFixture.plan).toJson());
    await layout.loadAsync();
    layout.setViewport(120, 60);
  });

  afterEach(() => {
    if (vi.isFakeTimers())
      vi.runOnlyPendingTimers();
    vi.useRealTimers();
    PreloadBridgeFixture.remove();
  });

  function bottom(): readonly [number | null, number] {
    return [layout.layout().dock(DockSide.Bottom).size, layout.geometry().dock(DockSide.Bottom).height];
  }

  function content(height: number): Bounds {
    return new Bounds(0, 0, 60, height);
  }

  it("grows the tab's dock once by what its content lacks, and puts the dock's earlier size back at the release", () => {
    const [, shown] = bottom();
    const release = growth.grow(terminal, 20);
    const asked = growth.minimumOf(terminal);

    growth.fit(terminal, content(12));
    const grown = bottom();
    growth.fit(terminal, content(4));
    const again = bottom();
    release();

    expect([asked, growth.minimumOf(terminal)]).toEqual([20, null]);
    expect([grown, again]).toEqual([[shown + 8, shown + 8], [shown + 8, shown + 8]]);
    expect(bottom()).toEqual([null, shown]);
  });

  it("forgets an ask released before its tab showed, so the tab grows nothing when it shows", () => {
    const before = bottom();
    const release = growth.grow(terminal, 20);

    release();
    growth.fit(terminal, content(12));

    expect([growth.minimumOf(terminal), ...bottom()]).toEqual([null, ...before]);
  });

  it("puts back the dock it grew at the release after the tab moved to another dock, and leaves the other dock as it is", () => {
    const release = growth.grow(terminal, 20);
    growth.fit(terminal, content(12));
    layout.place(terminal, new SideDropTarget(DockSide.Right));
    const [grown, right] = [layout.layout().dock(DockSide.Bottom).size, layout.layout().dock(DockSide.Right).size];

    release();

    expect(grown).not.toBeNull();
    expect(layout.layout().dock(DockSide.Bottom).size).toBeNull();
    expect(layout.layout().dock(DockSide.Right).size).toBe(right);
  });

  it("grows the dock no further than the window allows", () => {
    growth.grow(terminal, 500);

    growth.fit(terminal, content(12));

    expect(bottom()).toEqual([layout.geometry().maximumSize(DockSide.Bottom), layout.geometry().maximumSize(DockSide.Bottom)]);
  });

  it("grows nothing for a content that already shows long enough, and its release leaves the person's size", () => {
    layout.resizeDock(DockSide.Bottom, 14);
    const release = growth.grow(terminal, 10);

    growth.fit(terminal, content(12));
    const fitted = [growth.minimumOf(terminal), ...bottom()];
    release();

    expect(fitted).toEqual([null, 14, 14]);
    expect(bottom()).toEqual([14, 14]);
  });

  it("leaves a dock the person resized after it grew at the person's size at the release", () => {
    const release = growth.grow(terminal, 30);
    growth.fit(terminal, content(12));

    layout.resizeDock(DockSide.Bottom, 15);
    release();

    expect(bottom()).toEqual([15, 15]);
  });

  it("lets a new ask for the same tab take the old one's place, whose release then does nothing, and does nothing at a second release", () => {
    const [, shown] = bottom();
    const first = growth.grow(terminal, 20);
    const second = growth.grow(terminal, 22);

    first();
    growth.fit(terminal, content(12));
    const grown = bottom();
    first();
    second();
    second();

    expect(grown).toEqual([shown + 10, shown + 10]);
    expect(bottom()).toEqual([null, shown]);
  });

  it("grows nothing for a tab outside a dock or not open, nor for a tab no part asked for, and keeps waiting for the tab to show in a dock", () => {
    const before = bottom();
    growth.grow(LayoutFixture.plan, 20);
    growth.grow(LayoutFixture.secondTerminal, 20);

    growth.fit(LayoutFixture.plan, content(4));
    growth.fit(LayoutFixture.secondTerminal, content(4));
    growth.fit(terminal, content(4));

    expect([growth.minimumOf(LayoutFixture.plan), growth.minimumOf(LayoutFixture.secondTerminal), growth.minimumOf(terminal)]).toEqual([20, 20, null]);
    expect(bottom()).toEqual(before);
  });
});
