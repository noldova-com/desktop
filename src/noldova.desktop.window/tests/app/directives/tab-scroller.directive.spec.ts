/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal, viewChild } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { TabScrollerDirective } from "../../../src/app/directives/tab-scroller.directive";
import { Bounds } from "../../../src/app/models/layout/bounds";
import { GroupFrame } from "../../../src/app/models/layout/group-frame";
import { TabGroup } from "../../../src/app/models/layout/tab-group";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { DomFixture } from "../../fixtures/dom.fixture";

@Component({
  imports: [TabScrollerDirective],
  template: `
    <div class="scroller" style="display: flex; width: 200px; overflow-x: scroll;" [nolTabScroller]="actionBar" [nolTabScrollerFrame]="frame()">
      <div class="strip" style="display: flex; flex: none;" [style.width.px]="stripWidth()">
        <span class="tab" style="flex: none; width: 60px; height: 24px;"></span>
        <span class="tab nol-tab-selected" style="flex: none; width: 60px; height: 24px;" [style.margin-inline-start.px]="offset()"></span>
      </div>
      <div #actionBar class="actions" style="position: sticky; right: 0; flex: none; width: 48px; height: 24px;"></div>
    </div>
  `
})
class ScrollerHostComponent {
  public readonly stripWidth = signal(600);
  public readonly offset = signal(360);
  public readonly frame = signal(new GroupFrame(new TabGroup(1, [LayoutFixture.files], LayoutFixture.files), new Bounds(0, 0, 40, 20), null));
  public readonly scroller = viewChild.required(TabScrollerDirective);
}

describe("TabScrollerDirective", () => {
  let fixture: ComponentFixture<ScrollerHostComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ScrollerHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fixture.destroy();
  });

  function scroller(): HTMLElement {
    return DomFixture.one(DomFixture.host(fixture), ".scroller");
  }

  function element(selector: string): HTMLElement {
    return DomFixture.one(DomFixture.host(fixture), selector);
  }

  function wheel(init: WheelEventInit): WheelEvent {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
    scroller().dispatchEvent(event);
    return event;
  }

  it("keeps the selected tab clear of the action bar, reveals it and reports that the tabs overflow", () => {
    expect(scroller().style.scrollPaddingInlineEnd).toBe("48px");
    expect(scroller().scrollLeft).toBeGreaterThan(0);
    expect(fixture.componentInstance.scroller().isOverflowing()).toBe(true);
  });

  it("measures the action bar again when it resizes by itself, keeping the selected tab clear of it, and leaves the row alone while its size holds", async () => {
    const bar = element(".actions");
    const selected = element(".nol-tab-selected");
    const held = scroller().scrollLeft;
    await new Promise(resolve => requestAnimationFrame(resolve));
    const unmoved = scroller().scrollLeft;

    bar.style.width = "96px";

    await vi.waitFor(() => expect(scroller().style.scrollPaddingInlineEnd).toBe("96px"));
    expect([unmoved, scroller().style.getPropertyValue("--nol-tab-group-actions-width")]).toEqual([held, "96px"]);
    expect(selected.getBoundingClientRect().right).toBeLessThanOrEqual(bar.getBoundingClientRect().left);
  });

  it("measures again for a new frame and reports when the tabs fit", async () => {
    const reveal = vi.spyOn(Element.prototype, "scrollIntoView");
    const host = fixture.componentInstance;
    host.stripWidth.set(120);
    host.offset.set(0);
    host.frame.set(new GroupFrame(host.frame().group, new Bounds(0, 0, 60, 20), null));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(reveal).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    expect(host.scroller().isOverflowing()).toBe(false);
  });

  it("scrolls sideways with a vertical wheel only while the tabs overflow", async () => {
    scroller().scrollLeft = 0;

    expect(wheel({ deltaX: 40, deltaY: 40 }).defaultPrevented).toBe(false);
    expect(wheel({ deltaY: 0 }).defaultPrevented).toBe(false);
    expect(scroller().scrollLeft).toBe(0);
    expect(wheel({ deltaY: 80 }).defaultPrevented).toBe(true);
    expect(scroller().scrollLeft).toBe(80);
    fixture.componentInstance.stripWidth.set(120);
    fixture.componentInstance.offset.set(0);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(wheel({ deltaY: 80 }).defaultPrevented).toBe(false);
  });
});
