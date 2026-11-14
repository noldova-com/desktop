/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import { StatusBarComponent } from "../../../../src/app/components/status-bar/status-bar.component";
import { StatusBarSide } from "../../../../src/app/enums/status-bar-side";
import { StatusBarItem } from "../../../../src/app/models/status-bar-item";
import { StatusBarItemContribution } from "../../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../../src/app/models/status-bar-item-state";
import { BarItemsService } from "../../../../src/app/services/bar-items.service";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { WindowPartHostFixture } from "../../../fixtures/window-part-host.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("StatusBarComponent", () => {
  let bridge: PreloadBridgeFixture;

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [WindowPartHostFixture.provide()] });
  });

  afterEach(() => {
    AppearanceFixture.reset();
    PreloadBridgeFixture.remove();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.detectChanges();
    return DomFixture.host(fixture);
  }

  it("has an empty left side and the notifications bell on its right side", () => {
    const bar = render();

    expect([...bar.children].map(t => t.className)).toEqual(["nol-status-bar-side nol-status-bar-left", "nol-status-bar-side nol-status-bar-right"]);
    expect(bar.children[0]?.textContent).toBe(String.empty);
    expect(bar.querySelector(".nol-status-bar-right button.nol-notifications-item")?.getAttribute("aria-label")).toBe("Notifications");
    expect(bar.getAttribute("data-nol-chrome")).toBe("bottom");
  });

  it("shows the modules' items on their sides in order, with the shell's own items at the right end", () => {
    const item = (name: string, side: StatusBarSide): StatusBarItem =>
      new StatusBarItem(new StatusBarItemContribution(name, side, new StatusBarItemState(name)), () => undefined);
    TestBed.inject(BarItemsService).set(
      [item("notes.count", StatusBarSide.Left), item("clock.ticks", StatusBarSide.Right), item("notes.sync", StatusBarSide.Right), item("clock.zone", StatusBarSide.Left)], []);

    const bar = render();
    const names = (side: Element | undefined): readonly (string | null)[] => [...side?.children ?? []].map(t => t.getAttribute("data-nol-item") ?? t.tagName.toLowerCase());

    expect(names(bar.children[0])).toEqual(["notes.count", "clock.zone"]);
    expect(names(bar.children[1])).toEqual(["clock.ticks", "notes.sync", "nol-notifications", "nol-module-failures"]);
  });

  it("holds the update item before the notifications bell only while the update has something to show", async () => {
    const fixture = TestBed.createComponent(StatusBarComponent);
    fixture.detectChanges();
    const shown: (readonly string[])[] = [];
    for (const [kind, mustMove] of [["Downloading", false], ["Ready", false], ["Failed", false], ["UpToDate", false], ["Available", true], ["Failed", true]] as const) {
      bridge.publishUpdate({ kind, version: "1.3.0", progress: null, checkedAt: null, reason: null, mustMove });
      await fixture.whenStable();
      shown.push([...DomFixture.host(fixture).querySelectorAll(".nol-status-bar-right > *")].map(t => t.tagName.toLowerCase()));
    }

    const withItem = ["nol-update-item", "nol-notifications", "nol-module-failures"];
    const withoutItem = ["nol-notifications", "nol-module-failures"];
    expect(shown).toEqual([withoutItem, withItem, withItem, withoutItem, withItem, withItem]);
  });

  for (const theme of AppearanceFixture.themes)
    it(`leaves no space for a hidden item, even one without text, with the ${theme.id} theme's item gap between its neighbors`, () => {
      AppearanceFixture.apply(theme);
      const item = (name: string, state: StatusBarItemState): StatusBarItem =>
        new StatusBarItem(new StatusBarItemContribution(name, StatusBarSide.Left, state), () => undefined);
      TestBed.inject(BarItemsService).set([
        item("notes.count", new StatusBarItemState("2 notes")),
        item("notes.sync", new StatusBarItemState(String.empty, { isHidden: true })),
        item("clock.zone", new StatusBarItemState("UTC"))
      ], []);

      const bar = render();
      const [count, sync, zone] = ["notes.count", "notes.sync", "clock.zone"].map(t => DomFixture.one(bar, `[data-nol-item="${t}"]`).getBoundingClientRect());
      const gap = getComputedStyle(DomFixture.one(bar, ".nol-status-bar-left")).columnGap;

      expect([sync?.width, sync?.height]).toEqual([0, 0]);
      AppearanceFixture.expectLook(`${Number(zone?.left) - Number(count?.right)}px`, theme, "status-bar-item-gap", "column-gap");
      expect(`${Number(zone?.left) - Number(count?.right)}px`).toBe(gap);
    });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const bar = render();
        const style = getComputedStyle(bar);
        const side = getComputedStyle(bar.children[0] ?? bar);

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "window"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "text"));
        AppearanceFixture.expectLook(style.minHeight, theme, "status-bar-height", "min-height");
        AppearanceFixture.expectLook(style.paddingLeft, theme, "panel-card-margin", "padding-left");
        AppearanceFixture.expectLook(style.paddingRight, theme, "panel-card-margin", "padding-right");
        AppearanceFixture.expectLook(side.columnGap, theme, "status-bar-item-gap", "column-gap");
      });
});
