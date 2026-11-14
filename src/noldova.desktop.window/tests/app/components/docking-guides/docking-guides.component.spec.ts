/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DockingGuidesComponent } from "../../../../src/app/components/docking-guides/docking-guides.component";
import { BottomDockSpan } from "../../../../src/app/enums/bottom-dock-span";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { DockingOverlay } from "../../../../src/app/models/layout/docking-overlay";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { TabDropTarget } from "../../../../src/app/models/layout/tab-drop-target";
import type { LayoutService } from "../../../../src/app/services/layout.service";
import { TabDragService } from "../../../../src/app/services/tab-drag.service";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

@Component({
  imports: [DockingGuidesComponent],
  template: `
    <div class="workspace">
      <div class="group" data-drop-group="0"><div class="tabs" data-drop-tabs><span class="tab" data-tab-index="0"></span></div></div>
      <div class="group" data-drop-group="1"></div>
      <div class="group" data-drop-group="2"></div>
      <nol-docking-guides />
    </div>
  `,
  styles: [".workspace { position: relative; width: 1920px; height: 960px; }"]
})
class DockingGuidesHostComponent {
}

describe("DockingGuidesComponent", () => {
  beforeEach(() => {
    PreloadBridgeFixture.install();
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  const prepared = Layout.createDefault(registry).openView(LayoutFixture.search, registry).openDocument(LayoutFixture.plan);
  let fixture: ComponentFixture<DockingGuidesHostComponent>;
  let layout: LayoutService;
  let host: HTMLElement;
  let under: Element | null;

  beforeEach(async () => {
    layout = await LayoutServiceFixture.prepareAsync(registry, prepared);
    fixture = TestBed.createComponent(DockingGuidesHostComponent);
    host = DomFixture.host(fixture);
    under = null;
    vi.spyOn(document, "elementFromPoint").mockImplementation(() => under);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    vi.restoreAllMocks();
  });

  function find(selector: string): HTMLElement | null {
    return host.querySelector<HTMLElement>(selector);
  }

  function start(tab: Tab): void {
    TestBed.inject(TabDragService).begin(tab, new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 0, clientY: 0 }));
  }

  function moveOver(selector: string): void {
    under = find(selector);
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, clientX: 300, clientY: 200 }));
    fixture.detectChanges();
  }

  function expectRem(value: string | undefined, rem: number): void {
    expect(value?.endsWith("rem")).toBe(true);
    expect(Number.parseFloat(value ?? String.empty)).toBeCloseTo(rem, 2);
  }

  function expectBox(element: HTMLElement | null, x: number, y: number): void {
    expectRem(element?.style.left, x);
    expectRem(element?.style.top, y);
  }

  it("shows nothing until a tab is dragged", () => {
    expect(find("nol-docking-guide")).toBeNull();
    expect(find(".nol-drag-label")).toBeNull();
  });

  it("shows the side guides, the label at the pointer and a plate over another group while a view is dragged", () => {
    const overlay = new DockingOverlay(layout.geometry());
    start(LayoutFixture.files);
    moveOver(".group[data-drop-group=\"0\"]");

    const sides = [...host.querySelectorAll<HTMLElement>(".nol-docking-side")];
    expect(sides.map(t => [t.dataset["dropSide"], t.dataset["direction"], t.dataset["dropSpan"]]))
      .toEqual([["Left", "Left", undefined], ["Right", "Right", undefined], ["Bottom", "Bottom", "Between"], ["Bottom", "Bottom", "Full"]]);
    for (const side of Object.values(DockSide))
      expectBox(find(`.nol-docking-side[data-drop-side="${side}"]:not(.nol-docking-outer)`), overlay.guide(side).x, overlay.guide(side).y);
    expectBox(find(".nol-docking-outer"), overlay.outerGuide().x, overlay.outerGuide().y);
    const plate = find("nol-docking-plate");
    expect(plate?.dataset["dropGroup"]).toBe("0");
    expect(plate?.hasAttribute("data-drop-plate")).toBe(true);
    const frame = layout.geometry().frameOf(0);
    if (Object.isNull(frame))
      throw new Error("The documents group has no frame.");
    expectBox(plate, overlay.plate(frame).x, overlay.plate(frame).y);
    expect(find(".nol-docking-preview")).toBeNull();

    const label = find(".nol-drag-label");
    expect(label?.getAttribute("role")).toBe("status");
    expect(label?.textContent).toContain("Moving files.tree");
    expect(label?.style.left).toBe("300px");
    expect(label?.style.top).toBe("200px");
  });

  it("chooses the guide under the pointer and previews where the tab lands", () => {
    start(LayoutFixture.files);
    moveOver(".group[data-drop-group=\"0\"]");
    moveOver(".nol-docking-side[data-drop-side=\"Right\"]");

    expect(find(".nol-docking-side[data-drop-side=\"Right\"]")?.classList.contains("nol-docking-guide-chosen")).toBe(true);
    const preview = layout.geometry().sidePreview(DockSide.Right);
    expectBox(find(".nol-docking-preview"), preview.x, preview.y);
    expectRem(find(".nol-docking-preview")?.style.width, preview.width);

    moveOver(".group[data-drop-group=\"2\"]");
    moveOver("nol-docking-plate [data-direction=\"Top\"]");
    expect(find("nol-docking-plate [data-direction=\"Top\"]")?.classList.contains("nol-docking-guide-chosen")).toBe(true);
    moveOver("nol-docking-plate [data-direction=\"Center\"]");
    expect(find("nol-docking-plate [data-direction=\"Center\"]")?.classList.contains("nol-docking-guide-chosen")).toBe(true);
    const group = layout.geometry().frameOf(2)?.bounds;
    expectBox(find(".nol-docking-preview"), group?.x ?? -1, group?.y ?? -1);
    expectRem(find(".nol-docking-preview")?.style.height, group?.height ?? -1);
    moveOver("nol-docking-plate");
    expect(host.querySelectorAll(".nol-docking-guide-chosen").length).toBe(0);
  });

  it("previews and docks along the whole bottom from the outer guide, and between the side docks from the inner one", () => {
    for (const [selector, span] of [[".nol-docking-outer", BottomDockSpan.Full], [".nol-docking-side[data-drop-span=\"Between\"]", BottomDockSpan.Between]] as const) {
      start(LayoutFixture.files);
      moveOver(".group[data-drop-group=\"0\"]");
      moveOver(selector);
      const preview = layout.geometry().withBottomSpan(span).sidePreview(DockSide.Bottom);

      expect(find(selector)?.classList.contains("nol-docking-guide-chosen")).toBe(true);
      expectBox(find(".nol-docking-preview"), preview.x, preview.y);
      expectRem(find(".nol-docking-preview")?.style.width, preview.width);
      document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, button: 0, clientX: 300, clientY: 200 }));
      fixture.detectChanges();
      expect([layout.layout().sideOf(layout.layout().groupOf(LayoutFixture.files)?.id ?? -1), layout.layout().bottomSpan]).toEqual([DockSide.Bottom, span]);
    }
  });

  it("shows no plate over the dragged view's own group when it is the only tab there", () => {
    start(LayoutFixture.changes);
    moveOver(".group[data-drop-group=\"2\"]");

    expect(find("nol-docking-plate")).toBeNull();
    moveOver(".group[data-drop-group=\"1\"]");
    expect(find("nol-docking-plate")).not.toBeNull();
  });

  it("shows the label and a plate over a document group, but no side guides and no plate over a views group, while a document is dragged", () => {
    layout.openDocument(LayoutFixture.todo);
    start(LayoutFixture.plan);
    moveOver(".group[data-drop-group=\"0\"]");

    expect(find(".nol-docking-side")).toBeNull();
    expect(find("nol-docking-plate")?.dataset["dropGroup"]).toBe("0");
    expect(find(".nol-docking-preview")).toBeNull();
    expect(find(".nol-drag-label")?.textContent).toContain("Moving plan");
    moveOver(".group[data-drop-group=\"1\"]");
    expect(find("nol-docking-plate")).toBeNull();
  });

  it("shows neither a plate nor a preview over a group's tab row, where the tab takes a place in the row", () => {
    layout.openDocument(LayoutFixture.todo);
    start(LayoutFixture.plan);
    moveOver(".group[data-drop-group=\"0\"]");
    expect(find("nol-docking-plate")).not.toBeNull();

    moveOver(".tab");

    expect(TestBed.inject(TabDragService).target()).toBeInstanceOf(TabDropTarget);
    expect([find("nol-docking-plate"), find(".nol-docking-preview")]).toEqual([null, null]);
  });
});
