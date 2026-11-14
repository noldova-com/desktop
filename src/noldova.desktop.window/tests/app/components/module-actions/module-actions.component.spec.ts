/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { ModuleState, ModuleStatus } from "@noldova/desktop.protocol";

import { ModuleActionsComponent } from "../../../../src/app/components/module-actions/module-actions.component";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("ModuleActionsComponent", () => {
  const clock = new ModuleStatus("clock", "0.0.1", "Clock", "Tells the time.", [], new Map(), ModuleState.Failed, "Its runtime part failed to activate.");
  let fixture: ComponentFixture<ModuleActionsComponent>;
  let bridge: PreloadBridgeFixture;
  let errors: unknown[];

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
    errors = [];
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }]
    });
  });

  afterEach(() => {
    if (vi.isFakeTimers())
      vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    PreloadBridgeFixture.remove();
  });

  async function renderAsync(): Promise<void> {
    fixture = TestBed.createComponent(ModuleActionsComponent);
    fixture.componentRef.setInput("module", clock);
    await fixture.whenStable();
  }

  function button(name: string): HTMLButtonElement {
    return DomFixture.oneOf(DomFixture.host(fixture), `.nol-module-actions-${name}`, HTMLButtonElement);
  }

  function notice(): Element | null {
    return DomFixture.host(fixture).querySelector(".nol-module-actions-notice");
  }

  async function settleAsync(): Promise<void> {
    for (let turn = 0; turn < 10; turn++)
      await Promise.resolve();
  }

  it("centers each action's glyph in its button", async () => {
    AppearanceFixture.apply();
    try {
      await renderAsync();
      const middle = (element: Element): number => element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2;

      const offsets = ["copy", "logs"].map(name => Math.abs(middle(DomFixture.oneOf(button(name), "[nolButtonIcon]", Element)) - middle(button(name))));

      expect(Math.max(...offsets)).toBeLessThanOrEqual(1.5);
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it("has the main process copy the details with the platform and the module's id, state and cause, and says Copied for a while", async () => {
    await renderAsync();
    vi.useFakeTimers();

    button("copy").click();
    await settleAsync();
    fixture.detectChanges();
    const copied = button("copy").textContent;
    vi.advanceTimersByTime(1000);
    button("copy").click();
    await settleAsync();
    vi.advanceTimersByTime(1999);
    fixture.detectChanges();
    const stillCopied = button("copy").textContent;
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    expect(bridge.copiedDetails).toEqual([
      "Platform: win32 x64\nclock 0.0.1: Failed: Its runtime part failed to activate.",
      "Platform: win32 x64\nclock 0.0.1: Failed: Its runtime part failed to activate."
    ]);
    expect(bridge.copied).toEqual([]);
    expect(copied).toMatch(/^\s*check\s*Copied\s*$/);
    expect(stillCopied).toMatch(/^\s*check\s*Copied\s*$/);
    expect(button("copy").textContent).toMatch(/^\s*content_copy\s*Copy details\s*$/);
  });

  it("says nothing was copied when the main process refuses, and reports a copy that fails", async () => {
    await renderAsync();
    bridge.isCopyAccepted = false;

    button("copy").click();
    await vi.waitFor(() => expect(bridge.copiedDetails).toEqual([]));
    vi.spyOn(bridge, "copyDetails").mockRejectedValueOnce(new Error("The bridge closed."));
    button("copy").click();
    await vi.waitFor(() => expect(errors.length).toBe(1));
    fixture.detectChanges();

    expect(button("copy").textContent).toContain("Copy details");
  });

  it("opens the log folder and says when it could not", async () => {
    await renderAsync();

    button("logs").click();
    await vi.waitFor(() => expect(bridge.logFolderOpens).toBe(1));
    await fixture.whenStable();
    const noticeAfterOpening = notice();
    bridge.logFolderOpened = Promise.resolve(false);
    button("logs").click();
    await vi.waitFor(() => expect(notice()?.textContent).toBe("The log folder could not be opened."));
    bridge.logFolderOpened = Promise.resolve(true);
    button("logs").click();
    await vi.waitFor(() => expect(notice()).toBeNull());
    bridge.logFolderOpened = Promise.reject(new Error("The bridge closed."));
    button("logs").click();
    await vi.waitFor(() => expect(errors.length).toBe(1));
    await fixture.whenStable();

    expect(noticeAfterOpening).toBeNull();
    expect(notice()?.getAttribute("role")).toBe("status");
  });

  it("stops its Copied timer when destroyed", async () => {
    await renderAsync();
    const clearing = vi.spyOn(globalThis, "clearTimeout");

    button("copy").click();
    await vi.waitFor(() => expect(bridge.copiedDetails.length).toBe(1));
    fixture.destroy();

    expect(clearing).toHaveBeenCalled();
  });
});
