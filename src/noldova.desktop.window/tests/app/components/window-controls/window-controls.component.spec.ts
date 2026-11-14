/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ErrorHandler } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { userEvent } from "vitest/browser";

import { TooltipDirective } from "@noldova/ui.components.angular";

import { WindowControlsComponent } from "../../../../src/app/components/window-controls/window-controls.component";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("WindowControlsComponent", () => {
  afterEach(() => PreloadBridgeFixture.remove());

  async function renderAsync(): Promise<ComponentFixture<WindowControlsComponent>> {
    const fixture = TestBed.createComponent(WindowControlsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function buttonsOf(fixture: ComponentFixture<WindowControlsComponent>): HTMLButtonElement[] {
    return [...DomFixture.host(fixture).querySelectorAll("button")];
  }

  function tooltipsOf(fixture: ComponentFixture<WindowControlsComponent>): string[] {
    return fixture.debugElement.queryAll(By.css("button")).map(t => t.injector.get(TooltipDirective).text());
  }

  it("minimizes, maximizes, restores and closes the window from its buttons, each named and tipped for what a click does", async () => {
    const bridge = PreloadBridgeFixture.install("linux");
    const fixture = await renderAsync();
    const [minimize, maximize, close] = buttonsOf(fixture);
    const opened = [buttonsOf(fixture).map(t => t.getAttribute("aria-label")), tooltipsOf(fixture)];

    minimize?.click();
    maximize?.click();
    bridge.changeMaximized(true);
    await fixture.whenStable();
    const maximized = [maximize?.getAttribute("aria-label"), tooltipsOf(fixture)[1], !Object.isNull(maximize?.querySelector(".nol-window-controls-restore-glyph"))];
    maximize?.click();
    bridge.changeMaximized(false);
    await fixture.whenStable();
    close?.click();
    await fixture.whenStable();

    expect(opened).toEqual([["Minimize", "Maximize", "Close"], ["Minimize", "Maximize", "Close"]]);
    expect(maximized).toEqual(["Restore", "Restore", true]);
    expect(maximize?.getAttribute("aria-label")).toBe("Maximize");
    expect(maximize?.querySelector(".nol-window-controls-maximize-glyph")).not.toBeNull();
    expect(bridge.windowActions).toEqual(["Minimize", "ToggleMaximized", "ToggleMaximized", "Close"]);
  });

  it("opens as Restore for a window that is already maximized", async () => {
    const bridge = PreloadBridgeFixture.install("linux");
    bridge.maximized = Promise.resolve(true);
    const fixture = await renderAsync();

    buttonsOf(fixture)[1]?.click();
    await fixture.whenStable();

    expect(buttonsOf(fixture)[1]?.getAttribute("aria-label")).toBe("Restore");
    expect(bridge.windowActions).toEqual(["ToggleMaximized"]);
  });

  it("keeps the state of a change that arrives before its first read answers", async () => {
    const bridge = PreloadBridgeFixture.install("linux");
    let answer: (isMaximized: boolean) => void = () => undefined;
    bridge.maximized = new Promise<boolean>(t => {
      answer = t;
    });
    const fixture = TestBed.createComponent(WindowControlsComponent);
    fixture.detectChanges();

    bridge.changeMaximized(true);
    answer(false);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(buttonsOf(fixture)[1]?.getAttribute("aria-label")).toBe("Restore");
  });

  it("presses a focused control with Enter or Space and moves between them with Tab", async () => {
    const bridge = PreloadBridgeFixture.install("linux");
    const fixture = await renderAsync();
    const [minimize] = buttonsOf(fixture);

    minimize?.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await userEvent.keyboard(" ");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await fixture.whenStable();

    expect(bridge.windowActions).toEqual(["Minimize", "ToggleMaximized", "Close"]);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
  });

  it("reports a failed read of the maximized state and a failed action, and stays usable", async () => {
    const bridge = PreloadBridgeFixture.install("linux");
    bridge.maximized = Promise.reject(new Error("The main process went away."));
    vi.spyOn(bridge, "actOnWindow").mockRejectedValueOnce(new Error("The window is gone."));
    const handled: unknown[] = [];
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => handled.push(error) } }] });
    const fixture = await renderAsync();

    buttonsOf(fixture)[0]?.click();
    await fixture.whenStable();
    buttonsOf(fixture)[1]?.click();
    await fixture.whenStable();

    expect(handled.map(t => String(t))).toEqual(["Error: The main process went away.", "Error: The window is gone."]);
    expect(buttonsOf(fixture)[1]?.getAttribute("aria-label")).toBe("Maximize");
    expect(bridge.windowActions).toEqual(["ToggleMaximized"]);
  });

  it("stops following the maximized state once it is gone", async () => {
    const bridge = PreloadBridgeFixture.install("linux");
    const fixture = await renderAsync();
    const listening = bridge.maximizedListenerCount;

    fixture.destroy();

    expect([listening, bridge.maximizedListenerCount]).toEqual([1, 0]);
  });
});
