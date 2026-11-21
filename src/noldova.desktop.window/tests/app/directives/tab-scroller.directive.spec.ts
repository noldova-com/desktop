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
    <div class="scroller" style="display: flex; width: 200px; overflow: hidden;" [nolTabScroller]="actionBar" [nolTabScrollerFrame]="frame()">
      <div class="strip" style="display: flex; flex: 1 0 auto;">
        @for (key of keys(); track key) {
          <span style="flex: none; width: 60px; height: 24px;" [attr.data-tab-key]="key" [class.nol-tab-selected]="key === selected()"></span>
        }
      </div>
      <div #actionBar class="actions" style="flex: none; width: 48px; height: 24px;"></div>
    </div>
  `
})
class ScrollerHostComponent {
  public readonly keys = signal(["a", "b", "c", "d", "e"]);
  public readonly selected = signal("d");
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
    fixture.destroy();
  });

  function hidden(): readonly string[] {
    return [...fixture.componentInstance.scroller().hidden()].sort();
  }

  async function changeAsync(change: (host: ScrollerHostComponent) => void): Promise<void> {
    const host = fixture.componentInstance;
    change(host);
    host.frame.set(new GroupFrame(host.frame().group, new Bounds(0, 0, 40, 20), null));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it("shows the whole tabs that fit before the actions in order, hides the rest and reports that the tabs overflow", async () => {
    await changeAsync(host => host.selected.set("a"));

    expect([fixture.componentInstance.scroller().isOverflowing(), hidden()]).toEqual([true, ["c", "d", "e"]]);
    expect(DomFixture.one(DomFixture.host(fixture), ".scroller").style.getPropertyValue("--nol-tab-group-actions-width")).toBe("48px");
  });

  it("keeps a selected tab past the room shown, in place of the last tabs before it that fit", () => {
    expect(hidden()).toEqual(["b", "c", "e"]);
  });

  it("keeps the selected tab shown alone when the actions grow and leave room for one tab", async () => {
    DomFixture.one(DomFixture.host(fixture), ".actions").style.width = "96px";

    await vi.waitFor(() => expect(hidden()).toEqual(["a", "b", "c", "e"]));
  });

  it("fits again when the selected tab grows by itself, and reports when every tab fits", async () => {
    DomFixture.one(DomFixture.host(fixture), "[data-tab-key='d']").style.width = "100px";
    await vi.waitFor(() => expect(hidden()).toEqual(["a", "b", "c", "e"]));
    await changeAsync(host => {
      host.keys.set(["a", "b"]);
      host.selected.set("b");
    });

    await vi.waitFor(() => expect([fixture.componentInstance.scroller().isOverflowing(), hidden()]).toEqual([false, []]));
  });
});
