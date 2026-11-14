/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, Injector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type {} from "@vitest/browser-playwright";

import { ArrayVirtualListSource, VirtualListComponent, VirtualListKind, VirtualRowDirective } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { SearchRequest } from "../../../src/app/models/search-request";
import { SearchPaletteService } from "../../../src/app/services/search-palette.service";
import { WindowRowOverlayService } from "../../../src/app/services/window-row-overlay.service";
import { DomFixture } from "../../fixtures/dom.fixture";
import { MediaFixture } from "../../fixtures/media.fixture";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

@Component({ selector: "nol-module-palette-fixture", template: "<span>Palette</span>" })
class ModulePaletteComponent {
}

@Component({
  imports: [VirtualListComponent, VirtualRowDirective],
  template: `
    <nol-virtual-list label="Messages" [kind]="feed" [source]="source">
      <ng-template [nolVirtualRow]="source" let-item><div class="message">{{ item }}</div></ng-template>
    </nol-virtual-list>
  `,
  styles: "nol-virtual-list { display: grid; width: 200px; height: 300px; } .message { height: 26px; }"
})
class FeedHostComponent {
  public readonly feed: VirtualListKind = VirtualListKind.Feed;
  public readonly source = new ArrayVirtualListSource(Array.from({ length: 50 }, (_, t) => `message ${t}`), t => t, 26);
}

describe("SearchPaletteService", () => {
  let row: HTMLElement;
  let button: HTMLButtonElement;
  let search: SearchPaletteService;

  beforeEach(() => {
    AppearanceFixture.apply();
    PreloadBridgeFixture.install();
    row = document.body.appendChild(document.createElement("nol-window-row"));
    row.setAttribute("data-nol-chrome", "top");
    Object.assign(row.style, { position: "fixed", top: "0", left: "0", right: "0", height: "var(--nol-window-row-height)", display: "block" });
    button = document.body.appendChild(document.createElement("button"));
    search = TestBed.inject(SearchPaletteService);
  });

  afterEach(() => {
    search.close();
    row.remove();
    button.remove();
    PreloadBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  function pane(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".cdk-overlay-container .nol-search-pane");
  }

  function surfaceTop(): number {
    return pane()?.querySelector("nol-quick-input")?.getBoundingClientRect().top ?? Number.NaN;
  }

  it("opens once, in its own pane centred over the window row, its surface's top at the search field's top, with the request it was opened with, and shows it until it closes", async () => {
    const field = row.appendChild(document.createElement("div"));
    field.className = "nol-window-row-search";
    Object.assign(field.style, { position: "absolute", top: "0.25rem", left: "40%", width: "20%", height: "1.75rem" });
    search.open(SearchRequest.commands);
    search.open();
    const fieldTop = field.getBoundingClientRect().top;
    await vi.waitFor(() => expect(Math.abs(surfaceTop() - fieldTop), JSON.stringify([surfaceTop(), fieldTop])).toBeLessThanOrEqual(0.5));
    const box = pane()?.getBoundingClientRect();
    const shown = [search.isShown(), search.request];

    expect([search.isOpen, ...shown]).toEqual([true, true, SearchRequest.commands]);
    expect(document.querySelectorAll(".cdk-overlay-container .nol-search-pane").length).toBe(1);
    expect([fieldTop > row.getBoundingClientRect().top, (box?.top ?? Number.NaN) < fieldTop]).toEqual([true, true]);
    expect(Math.abs((box?.left ?? 0) + (box?.width ?? 0) / 2 - document.documentElement.clientWidth / 2)).toBeLessThan(1);
    search.close();
    await vi.waitFor(() => expect(search.isShown()).toBe(false));
    search.open();
    expect(search.request).toBe(SearchRequest.plain);
  });

  it("replaces a module's open palette, so its key always opens it", async () => {
    const palette = TestBed.inject(WindowRowOverlayService).open(ModulePaletteComponent, TestBed.inject(Injector), "module-palette-pane");
    const seen: boolean[] = [];
    void palette?.closed.then(() => seen.push(palette.isOpen));

    search.open();
    await palette?.closed;
    await vi.waitFor(() => expect(pane()?.querySelector("nol-search-palette")).not.toBeNull());

    expect([seen, search.isOpen, document.querySelector(".module-palette-pane")]).toEqual([[false], true, null]);
  });

  it("places its pane one quick-input margin above the search field as it opens, and keeps it there once its content draws, so it never jumps", async () => {
    const field = row.appendChild(document.createElement("div"));
    field.className = "nol-window-row-search";
    Object.assign(field.style, { position: "absolute", top: "0.25rem", left: "40%", width: "20%", height: "1.75rem" });
    const fieldTop = field.getBoundingClientRect().top;
    const start = fieldTop - AppearanceFixture.measureLook("quick-input-margin");

    search.open();
    const first = pane()?.getBoundingClientRect().top ?? Number.NaN;
    await vi.waitFor(() => expect(Math.abs(surfaceTop() - fieldTop)).toBeLessThanOrEqual(0.5));

    expect(Math.abs(first - start), JSON.stringify([first, start])).toBeLessThanOrEqual(0.5);
    expect(Math.abs((pane()?.getBoundingClientRect().top ?? Number.NaN) - start)).toBeLessThanOrEqual(0.5);
  });

  it("keeps its surface's top at the search field's top and its pane centred with forced colors", async () => {
    const field = row.appendChild(document.createElement("div"));
    field.className = "nol-window-row-search";
    Object.assign(field.style, { position: "absolute", top: "0.25rem", left: "40%", width: "20%", height: "1.75rem" });
    await MediaFixture.forceColorsAsync("active");
    try {
      const fieldTop = field.getBoundingClientRect().top;
      search.open();
      await vi.waitFor(() => expect(Math.abs(surfaceTop() - fieldTop), JSON.stringify([surfaceTop(), fieldTop])).toBeLessThanOrEqual(0.5));
      const box = pane()?.getBoundingClientRect();

      expect(matchMedia("(forced-colors: active)").matches).toBe(true);
      expect(Math.abs((box?.left ?? 0) + (box?.width ?? 0) / 2 - document.documentElement.clientWidth / 2)).toBeLessThan(1);
    }
    finally {
      await MediaFixture.forceColorsAsync("none");
    }
  });

  it("starts its surface at the window row's top when the row has no search field", async () => {
    search.open();

    await vi.waitFor(() => expect(Math.abs(surfaceTop() - row.getBoundingClientRect().top), String(surfaceTop())).toBeLessThanOrEqual(0.5));
  });

  it("opens nothing without a window row", () => {
    row.remove();

    search.open();

    expect([search.isOpen, search.isShown()]).toEqual([false, false]);
  });

  it("returns focus to where it was when it closes, and to nothing that has gone or is not an HTML element", () => {
    const drawing = document.body.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    drawing.setAttribute("tabindex", "0");
    drawing.focus();
    search.open();
    search.close();
    const focusAfterDrawing = document.activeElement;
    drawing.remove();
    button.focus();
    search.open();
    search.close();
    const focusAfterClose = document.activeElement;
    button.focus();
    search.open();
    button.remove();
    search.close();

    expect(focusAfterDrawing).toBe(drawing);
    expect(focusAfterClose).toBe(button);
    expect(search.isOpen).toBe(false);
  });

  it("closes on a click outside and when the window row moves", async () => {
    search.open();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const isOpenAfterClick = search.isOpen;
    search.open();
    row.style.top = "10px";
    row.dispatchEvent(new Event("scroll"));

    expect(isOpenAfterClick).toBe(false);
    expect(search.isOpen).toBe(false);
  });
});

describe("SearchPaletteService over a feed", () => {
  let row: HTMLElement;
  let search: SearchPaletteService;

  beforeEach(() => {
    AppearanceFixture.apply();
    PreloadBridgeFixture.install();
    row = document.body.appendChild(document.createElement("nol-window-row"));
    Object.assign(row.style, { position: "fixed", top: "0", left: "0", right: "0", height: "2rem", display: "block" });
    search = TestBed.inject(SearchPaletteService);
  });

  afterEach(() => {
    search.close();
    row.remove();
    PreloadBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  for (const [name, selector] of [["a focused feed", "[role=feed][tabindex=\"0\"]"], ["a focused message of a feed", "[role=article][tabindex=\"-1\"]"]] as const)
    it(`keeps the focus in its field, through Down, when it opens over ${name}`, async () => {
      const fixture = TestBed.createComponent(FeedHostComponent);
      await fixture.whenStable();
      const target = await vi.waitFor(() => {
        const found = DomFixture.host(fixture).querySelector<HTMLElement>(selector);
        expect(found).not.toBeNull();
        return found;
      });
      target?.focus();
      expect(document.activeElement).toBe(target);
      await fixture.whenStable();

      search.open();
      const field = await vi.waitFor(() => {
        const found = document.querySelector<HTMLInputElement>(".nol-quick-input-field");
        expect(found).not.toBeNull();
        return found;
      });
      await fixture.whenStable();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await fixture.whenStable();
      const focused = document.activeElement;
      focused?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      await fixture.whenStable();
      const focusedAfterDown = document.activeElement;
      fixture.destroy();

      expect([focused === field, focusedAfterDown === field]).toEqual([true, true]);
    });
});
