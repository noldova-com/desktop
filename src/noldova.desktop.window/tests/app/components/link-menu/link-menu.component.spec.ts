/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { LinkMenuComponent } from "../../../../src/app/components/link-menu/link-menu.component";
import { LinkPlace } from "../../../../src/app/enums/link-place";
import { LinkService } from "../../../../src/app/services/link.service";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";

@Component({
  imports: [LinkMenuComponent],
  template: `
    <a class="docs" href="https://example.com/docs" style="position: fixed; top: 100px; left: 100px;">Docs</a>
    <a class="icon" href="https://example.com/icon" style="position: fixed; top: 200px; left: 100px;"><svg width="16" height="16"><path class="glyph" d="M0 0h16v16H0z" /></svg></a>
    <nol-link-menu />
  `
})
class HostComponent {
}

describe("LinkMenuComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let bridge: PreloadBridgeFixture;
  let stop: () => void;

  beforeEach(async () => {
    bridge = PreloadBridgeFixture.install();
    stop = TestBed.inject(LinkService).listen();
    fixture = TestBed.createComponent(HostComponent);
    await settledAsync();
  });

  afterEach(() => {
    stop();
    fixture.destroy();
    AppearanceFixture.reset();
    document.querySelector(".cdk-overlay-container")?.replaceChildren();
    PreloadBridgeFixture.remove();
  });

  function menu(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".cdk-overlay-container nol-menu[data-place=\"desktop.link\"]");
  }

  function rows(): HTMLElement[] {
    return [...menu()?.querySelectorAll<HTMLElement>(".nol-place-menu-item") ?? []];
  }

  async function settledAsync(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function rightClickAsync(x: number, y: number): Promise<void> {
    DomFixture.one(DomFixture.host(fixture), ".docs").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
    await settledAsync();
  }

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      it(`opens the link menu at the pointer with Open in your browser alone while no part is the in-app browser, with the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        await rightClickAsync(110, 104);
        const box = menu()?.getBoundingClientRect();

        expect(rows().map(t => [t.dataset["command"], t.querySelector(".nol-menu-item-label")?.textContent])).toEqual([["desktop.openLinkInBrowser", "Open in your browser"]]);
        AppearanceFixture.expectPixels(box?.left ?? Number.NaN, 110);
        expect(box?.top ?? Number.NaN).toBeGreaterThanOrEqual(104);
        expect(box?.top ?? Number.NaN).toBeLessThan(104 + AppearanceFixture.toPixels(1));
      });

  it("opens the menu for an SVG icon right-clicked inside a link", async () => {
    const link = DomFixture.one(DomFixture.host(fixture), ".icon");
    link.querySelector(".glyph")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 108, clientY: 208, button: 2 }));
    await settledAsync();

    const box = menu()?.getBoundingClientRect();

    expect([TestBed.inject(LinkService).menu()?.url, rows().map(t => t.dataset["command"])]).toEqual(["https://example.com/icon", ["desktop.openLinkInBrowser"]]);
    AppearanceFixture.expectPixels(box?.left ?? Number.NaN, 108);
    expect(box?.top ?? Number.NaN).toBeGreaterThanOrEqual(208);
    expect(box?.top ?? Number.NaN).toBeLessThan(208 + AppearanceFixture.toPixels(1));
  });

  it("opens no menu for a request with no element to give the focus back to", async () => {
    TestBed.inject(LinkService).showMenu("https://example.com/docs", new MouseEvent("contextmenu", { cancelable: true, clientX: 110, clientY: 104 }));
    await settledAsync();

    expect([TestBed.inject(LinkService).menu()?.url, menu()]).toEqual(["https://example.com/docs", null]);
  });

  it("offers Open in the app first while a part is the in-app browser, and opens the link where the person chose", async () => {
    const opened: string[] = [];
    TestBed.inject(LinkService).register({ placeFor: () => LinkPlace.System, openAsync: t => Promise.resolve(void opened.push(t)) }, () => undefined);
    await rightClickAsync(110, 104);
    const labels = rows().map(t => t.querySelector(".nol-menu-item-label")?.textContent);
    rows()[0]?.click();
    await settledAsync();
    await rightClickAsync(110, 104);
    rows()[1]?.click();
    await vi.waitFor(() => expect(bridge.links.length).toBe(1));

    expect([labels, opened, bridge.links, menu()]).toEqual([["Open in Noldova Desktop Sample", "Open in your browser"], ["https://example.com/docs"], ["https://example.com/docs"], null]);
  });
});
