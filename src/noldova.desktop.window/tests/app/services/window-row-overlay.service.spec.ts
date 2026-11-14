/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, ElementRef, InjectionToken, Injector, afterNextRender, inject } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import type { WindowPalette } from "../../../src/app/models/window-palette";
import { WindowRowOverlayService } from "../../../src/app/services/window-row-overlay.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../fixtures/dom.fixture";

const given = new InjectionToken<string>("given");

@Component({ selector: "nol-palette-fixture", template: "<span class=\"palette-text\">Palette</span>" })
class PaletteComponent {
  public readonly given = inject(given);
}

@Component({ selector: "nol-focusing-palette-fixture", template: "<input class=\"palette-field\" aria-label=\"Find\" />" })
class FocusingPaletteComponent {
  public constructor() {
    const host: HTMLElement = DomFixture.host(inject(ElementRef));
    afterNextRender(() => host.querySelector("input")?.focus());
  }
}

describe("WindowRowOverlayService", () => {
  let row: HTMLElement;
  let button: HTMLButtonElement;
  let overlays: WindowRowOverlayService;
  let open: WindowPalette<PaletteComponent>[];

  beforeEach(() => {
    AppearanceFixture.apply();
    PreloadBridgeFixture.install();
    row = document.body.appendChild(document.createElement("nol-window-row"));
    row.setAttribute("data-nol-chrome", "top");
    Object.assign(row.style, { position: "fixed", top: "0", left: "0", right: "0", height: "var(--nol-window-row-height)", display: "block" });
    button = document.body.appendChild(document.createElement("button"));
    overlays = TestBed.inject(WindowRowOverlayService);
    open = [];
  });

  afterEach(() => {
    open.forEach(t => t.close());
    overlays.closeOpen();
    row.remove();
    button.remove();
    PreloadBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  function pane(): HTMLElement | null {
    return document.querySelector<HTMLElement>(".cdk-overlay-container .palette-pane");
  }

  function openPalette(): WindowPalette<PaletteComponent> | null {
    const injector = Injector.create({ providers: [{ provide: given, useValue: "from the caller" }], parent: TestBed.inject(Injector) });
    const palette = overlays.open(PaletteComponent, injector, "palette-pane");
    if (!Object.isNull(palette))
      open.push(palette);
    return palette;
  }

  async function openFocusing(): Promise<WindowPalette<FocusingPaletteComponent> | null> {
    const palette = overlays.open(FocusingPaletteComponent, TestBed.inject(Injector), "palette-pane");
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("palette-field")).toBe(true));
    return palette;
  }

  function press(key: string, isHandled: boolean = false): void {
    const field = DomFixture.present(document.activeElement);
    if (isHandled)
      field.addEventListener("keydown", t => t.preventDefault(), { once: true });
    field.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  }

  function watch<T>(palette: WindowPalette<T> | null): string[] {
    const seen: string[] = [];
    void palette?.closed.then(() => seen.push(`closed, open ${palette.isOpen}`));
    return seen;
  }

  it("opens the component with the injector given, in a pane of the class given, centred under the window row", async () => {
    const palette = openPalette();
    await vi.waitFor(() => expect(pane()?.querySelector(".palette-text")).not.toBeNull());
    const box = pane()?.getBoundingClientRect();

    expect([palette?.componentRef.instance.given, overlays.isOpen]).toEqual(["from the caller", true]);
    expect(box?.top).toBeCloseTo(row.getBoundingClientRect().bottom, 0);
    expect(Math.abs((box?.left ?? 0) + (box?.width ?? 0) / 2 - document.documentElement.clientWidth / 2)).toBeLessThan(1);
  });

  it("opens nothing without a window row, and nothing while a palette is open, which stays open", () => {
    row.remove();
    const withoutRow = openPalette();
    document.body.append(row);
    const first = openPalette();
    const second = openPalette();

    expect([withoutRow, second, Object.isNull(first), overlays.isOpen]).toEqual([null, null, false, true]);
  });

  it("closes on a pointer outside it, says so, does nothing more when asked again, and returns focus to where it was", async () => {
    button.focus();
    const palette = openPalette();
    const seen = watch(palette);
    const wasOpen = palette?.isOpen;
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const focused = document.activeElement;
    palette?.close();
    await palette?.closed;

    expect([wasOpen, seen, overlays.isOpen, pane(), focused === button]).toEqual([true, ["closed, open false"], false, null, true]);
  });

  it("closes when the window row moves away", async () => {
    const palette = openPalette();
    const seen = watch(palette);
    row.style.top = "10px";
    row.dispatchEvent(new Event("scroll"));
    await palette?.closed;

    expect([seen, overlays.isOpen]).toEqual([["closed, open false"], false]);
  });

  it("closes when the window row is hidden", async () => {
    const seen = watch(openPalette());
    row.style.display = "none";

    await vi.waitFor(() => expect(seen).toEqual(["closed, open false"]));
    expect(overlays.isOpen).toBe(false);
  });

  it("closes when asked, gives focus to nothing that has gone, and opens again afterwards", async () => {
    button.focus();
    const palette = openPalette();
    const seen = watch(palette);
    button.remove();
    palette?.close();
    await palette?.closed;
    const again = openPalette();

    expect([seen, document.activeElement === document.body, again?.isOpen, palette?.isOpen]).toEqual([["closed, open false"], true, true, false]);
  });

  it("throws what its component throws, leaves no pane behind, and opens again afterwards", () => {
    const failing = Injector.create({ providers: [{ provide: given, useFactory: () => { throw new Error("no palette"); } }], parent: TestBed.inject(Injector) });
    const panes = (): number => document.querySelectorAll(".cdk-overlay-pane").length;
    const before = panes();

    expect(() => overlays.open(PaletteComponent, failing, "palette-pane")).toThrowError("no palette");
    const afterThrow = [overlays.isOpen, panes() - before];
    const again = openPalette();

    expect([afterThrow, again?.isOpen, panes() - before, pane()?.textContent]).toEqual([[false, 0], true, 1, "Palette"]);
  });

  it("returns focus that the palette took to where it was, when it closes on close() and on Escape", async () => {
    button.focus();
    const asked = await openFocusing();
    asked?.close();
    const afterClose = document.activeElement === button;
    const escaped = await openFocusing();
    press("Escape");
    await escaped?.closed;

    expect([afterClose, document.activeElement === button, overlays.isOpen]).toEqual([true, true, false]);
  });

  it("gives focus to nothing that has gone, when it closes on close() and on Escape", async () => {
    button.focus();
    const asked = await openFocusing();
    button.remove();
    asked?.close();
    const afterClose = document.activeElement === document.body;
    document.body.append(button);
    button.focus();
    const escaped = await openFocusing();
    button.remove();
    press("Escape");
    await escaped?.closed;

    expect([afterClose, document.activeElement === document.body, overlays.isOpen]).toEqual([true, true, false]);
  });

  it("stays open on another key and on an Escape the palette handled itself", async () => {
    const palette = await openFocusing();
    press("Enter");
    press("Escape", true);

    expect([palette?.isOpen, overlays.isOpen]).toEqual([true, true]);
  });

  it("closes the open palette when asked to, returning focus, and does nothing when none is open", async () => {
    overlays.closeOpen();
    button.focus();
    const palette = await openFocusing();
    const seen = watch(palette);
    overlays.closeOpen();
    await palette?.closed;

    expect([seen, overlays.isOpen, document.activeElement === button]).toEqual([["closed, open false"], false, true]);
  });
});
