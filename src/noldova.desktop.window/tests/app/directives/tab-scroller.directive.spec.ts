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
    <div class="row" style="position: relative; width: 200px;" [attr.dir]="direction()">
      <div #scroller="nolTabScroller" class="scroller" style="display: flex; padding-inline-start: 8px; overflow-x: auto; scrollbar-width: none;"
        [nolTabScroller]="actionBar" [nolTabScrollerThumb]="thumb" [nolTabScrollerFrame]="frame()" [nolTabScrollerRows]="rows()">
        <div class="strip" style="display: flex; flex: 1 0 auto;">
          @for (key of keys(); track key) {
            <span style="flex: none; min-width: 60px; height: 24px; font: 16px monospace; white-space: nowrap;" [attr.data-tab-key]="key" [class.nol-tab-selected]="key === selected()">{{ labels()[key] }}</span>
          }
        </div>
        <div #actionBar class="actions" style="position: sticky; inset-inline-end: 0; flex: none; width: 48px; height: 24px;"></div>
      </div>
      <div #thumb class="thumb" style="position: absolute; bottom: 0; height: 6px;" hidden
        (pointerdown)="scroller.grab($event)" (pointermove)="scroller.drag($event)" (lostpointercapture)="scroller.release()"></div>
    </div>
  `
})
class ScrollerHostComponent {
  public readonly keys = signal(["a", "b", "c", "d", "e"]);
  public readonly selected = signal("d");
  public readonly labels = signal<Readonly<Record<string, string>>>({});
  public readonly direction = signal("ltr");
  public readonly rows = signal(0);
  public readonly frame = signal(new GroupFrame(new TabGroup(1, [LayoutFixture.files], LayoutFixture.files), new Bounds(0, 0, 40, 20), null));
  public readonly scroller = viewChild.required(TabScrollerDirective);
}

describe("TabScrollerDirective", () => {
  let fixture: ComponentFixture<ScrollerHostComponent>;
  let width = 40;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ScrollerHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fixture.destroy();
  });

  function element(selector: string): HTMLElement {
    return DomFixture.one(DomFixture.host(fixture), selector);
  }

  function scroller(): HTMLElement {
    return element(".scroller");
  }

  function thumb(): HTMLElement {
    return element(".thumb");
  }

  function placeOf(key: string): { readonly start: number; readonly end: number } {
    const [row, box] = [scroller().getBoundingClientRect(), element(`[data-tab-key='${key}']`).getBoundingClientRect()];
    return fixture.componentInstance.direction() === "rtl" ? { start: row.right - box.right, end: row.right - box.left } : { start: box.left - row.left, end: box.right - row.left };
  }

  function expectInRoom(key: string): void {
    const place = placeOf(key);
    const end = scroller().clientWidth - element(".actions").getBoundingClientRect().width;
    expect(place.start).toBeGreaterThanOrEqual(8 - 0.5);
    expect(place.end).toBeLessThanOrEqual(end + 0.5);
  }

  async function changeAsync(change: (host: ScrollerHostComponent) => void): Promise<void> {
    const host = fixture.componentInstance;
    change(host);
    width += 1;
    host.frame.set(new GroupFrame(host.frame().group, new Bounds(0, 0, width, 20), null));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function wheel(init: WheelEventInit): WheelEvent {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
    scroller().dispatchEvent(event);
    return event;
  }

  function pointer(type: string, init: PointerEventInit): void {
    thumb().dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, ...init }));
  }

  it("reports that the tabs overflow and keeps the buttons' width", () => {
    expect(fixture.componentInstance.scroller().isOverflowing()).toBe(true);
    expect(scroller().style.getPropertyValue("--nol-tab-group-actions-width")).toBe("48px");
  });

  it("gives every tab's width together with the row's start and the buttons' width as the width the tabs want", async () => {
    expect(scroller().style.getPropertyValue("--nol-tab-group-tabs-width")).toBe("356px");

    await changeAsync(host => {
      host.keys.set(["a", "b"]);
      host.selected.set("a");
    });

    await vi.waitFor(() => expect(scroller().style.getPropertyValue("--nol-tab-group-tabs-width")).toBe("176px"));
    expect(fixture.componentInstance.scroller().isOverflowing()).toBe(false);
  });

  it("scrolls a selected tab in the middle into view, ending where the buttons start", () => {
    expect(scroller().scrollLeft).toBe(96);
    expect(placeOf("d").end).toBeCloseTo(scroller().clientWidth - 48, 1);
  });

  for (const [key, scroll] of [["a", 0], ["c", 36], ["e", 156]] as const)
    it(`scrolls the row from its start to ${scroll} for the ${key === "a" ? "first" : key === "e" ? "last" : "middle"} tab chosen, which lies whole between the row's start and its buttons`, async () => {
      scroller().scrollLeft = 0;
      await changeAsync(host => host.selected.set(key));

      expect(scroller().scrollLeft).toBe(scroll);
      expectInRoom(key);
    });

  it("leaves the row where it is for a tab chosen that already lies whole in the room shown", async () => {
    await changeAsync(host => host.selected.set("c"));

    expect(scroller().scrollLeft).toBe(96);
    expectInRoom("c");
  });

  it("scrolls back toward the start for a tab before the room shown, which then starts at the row's start", async () => {
    await changeAsync(host => host.selected.set("e"));
    await changeAsync(host => host.selected.set("b"));

    expect(scroller().scrollLeft).toBe(60);
    expect(placeOf("b").start).toBeCloseTo(8, 1);
  });

  it("scrolls the selected tab clear again when the buttons grow by themselves", async () => {
    element(".actions").style.width = "96px";

    await vi.waitFor(() => expect(scroller().scrollLeft).toBe(144));
    expectInRoom("d");
  });

  it("keeps the selected tab whole when a tab before it grows, as it lay whole before", async () => {
    element("[data-tab-key='c']").style.width = "100px";

    await vi.waitFor(() => expect(scroller().scrollLeft).toBe(136));
    expectInRoom("d");
  });

  it("keeps the selected tab whole when a render of the same frame grows its label, as it lay whole before", async () => {
    const before = scroller().scrollLeft;

    const host = fixture.componentInstance;
    host.labels.set({ d: "0123456789" });
    host.frame.set(new GroupFrame(host.frame().group, host.frame().bounds, null));
    fixture.detectChanges();
    await fixture.whenStable();

    await vi.waitFor(() => expectInRoom("d"));
    expect(element("[data-tab-key='d']").getBoundingClientRect().width).toBeGreaterThan(60 + 0.5);
    expect(scroller().scrollLeft).toBeGreaterThan(before);
  });

  it("leaves the row where the person scrolled it when a tab grows while the selected tab lay out of view", async () => {
    scroller().scrollLeft = 0;
    await vi.waitFor(() => expect(thumb().style.insetInlineStart).toBe("0px"));

    element("[data-tab-key='c']").style.width = "100px";

    await vi.waitFor(() => expect(scroller().style.getPropertyValue("--nol-tab-group-tabs-width")).toBe("396px"));
    expect(scroller().scrollLeft).toBe(0);
  });

  it("scrolls a tab that takes the focus into view, selected or not, and nothing for anything else that takes it", async () => {
    element(".actions").tabIndex = -1;
    const first = element("[data-tab-key='a']");
    first.tabIndex = -1;

    element(".actions").focus({ preventScroll: true });
    expect(scroller().scrollLeft).toBe(96);
    first.focus({ preventScroll: true });

    expect(scroller().scrollLeft).toBe(0);
    expectInRoom("a");
  });

  it("leaves the row where it is when no tab is selected", async () => {
    await changeAsync(host => host.selected.set("none"));

    expect(scroller().scrollLeft).toBe(96);
  });

  it("scrolls right to left the same way, from the row's start on its right", async () => {
    await changeAsync(host => host.direction.set("rtl"));
    await changeAsync(host => host.selected.set("e"));

    expect(scroller().scrollLeft).toBe(-156);
    expectInRoom("e");
    await vi.waitFor(() => expect(element(".row").getBoundingClientRect().right - thumb().getBoundingClientRect().right).toBeCloseTo(156 * 200 / 356, 1));
    await changeAsync(host => host.selected.set("b"));
    expect(scroller().scrollLeft).toBe(-60);
    expectInRoom("b");
  });

  it("scrolls sideways with a vertical wheel only while the tabs overflow", async () => {
    scroller().scrollLeft = 0;

    expect(wheel({ deltaX: 40, deltaY: 40 }).defaultPrevented).toBe(false);
    expect(wheel({ deltaY: 0 }).defaultPrevented).toBe(false);
    expect(scroller().scrollLeft).toBe(0);
    expect(wheel({ deltaY: 80 }).defaultPrevented).toBe(true);
    expect(scroller().scrollLeft).toBe(80);
    await changeAsync(host => {
      host.keys.set(["a", "b"]);
      host.selected.set("a");
    });
    expect(wheel({ deltaY: 80 }).defaultPrevented).toBe(false);
  });

  it("scrolls right to left toward the row's end with a vertical wheel down, and back toward its start with a wheel up", async () => {
    await changeAsync(host => host.direction.set("rtl"));
    scroller().scrollLeft = 0;

    expect(wheel({ deltaY: 80 }).defaultPrevented).toBe(true);
    expect(scroller().scrollLeft).toBe(-80);
    wheel({ deltaY: -30 });
    expect(scroller().scrollLeft).toBe(-50);
  });

  it("sizes and places the thumb by how much of the row shows and how far it has scrolled, and hides it once the tabs fit", async () => {
    expect(thumb().hidden).toBe(false);
    expect(parseFloat(thumb().style.inlineSize)).toBeCloseTo(200 * 200 / 356, 1);
    expect(parseFloat(thumb().style.insetInlineStart)).toBeCloseTo(96 * 200 / 356, 1);

    scroller().scrollLeft = 0;

    await vi.waitFor(() => expect(thumb().style.insetInlineStart).toBe("0px"));
    await changeAsync(host => {
      host.keys.set(["a", "b"]);
      host.selected.set("a");
    });
    await vi.waitFor(() => expect(thumb().hidden).toBe(true));
  });

  it("scrolls the row as far as the thumb is dragged along it, until the pointer lets go", () => {
    const capture = vi.spyOn(thumb(), "setPointerCapture").mockImplementation(() => undefined);
    scroller().scrollLeft = 0;

    pointer("pointermove", { clientX: 40 });
    expect(scroller().scrollLeft).toBe(0);
    pointer("pointerdown", { button: 2, clientX: 10 });
    pointer("pointermove", { clientX: 40 });
    expect([capture.mock.calls.length, scroller().scrollLeft]).toEqual([0, 0]);
    pointer("pointerdown", { button: 0, clientX: 10 });
    pointer("pointermove", { clientX: 40 });
    expect(capture).toHaveBeenCalledWith(1);
    expect(scroller().scrollLeft).toBeCloseTo(30 * 356 / 200, 0);
    thumb().dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1 }));
    pointer("pointermove", { clientX: 80 });
    expect(scroller().scrollLeft).toBeCloseTo(30 * 356 / 200, 0);
  });

  it("scrolls right to left toward the row's end as the thumb is dragged toward it, the thumb following, and stops at the row's start", async () => {
    await changeAsync(host => host.direction.set("rtl"));
    vi.spyOn(thumb(), "setPointerCapture").mockImplementation(() => undefined);
    scroller().scrollLeft = 0;

    pointer("pointerdown", { button: 0, clientX: 100 });
    pointer("pointermove", { clientX: 70 });
    expect(scroller().scrollLeft).toBeCloseTo(-30 * 356 / 200, 0);
    await vi.waitFor(() => expect(element(".row").getBoundingClientRect().right - thumb().getBoundingClientRect().right).toBeCloseTo(30, 0));
    pointer("pointermove", { clientX: 140 });
    expect(scroller().scrollLeft).toBe(0);
  });

  it("measures the buttons again when they change while the tabs overflow", async () => {
    await changeAsync(host => host.rows.set(2));

    await vi.waitFor(() => expect(fixture.componentInstance.scroller().isOverflowing()).toBe(true));
    expect(scroller().scrollLeft).toBe(96);
  });

  it("stops watching a tab's size once the tab closes, and watches a tab that opens", async () => {
    const unobserved = vi.spyOn(ResizeObserver.prototype, "unobserve");
    const observed = vi.spyOn(ResizeObserver.prototype, "observe");
    const closing = element("[data-tab-key='e']");

    await changeAsync(host => host.keys.set(["a", "b", "c", "d", "f"]));

    expect([unobserved.mock.calls.map(t => t[0]), observed.mock.calls.map(t => t[0])]).toEqual([[closing], [element("[data-tab-key='f']")]]);
  });
});
