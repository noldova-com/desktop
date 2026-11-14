/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";

import { RuntimeStatusComponent } from "../../../../src/app/components/runtime-status/runtime-status.component";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("RuntimeStatusComponent", () => {
  let bridge: PreloadBridgeFixture;

  beforeEach(() => {
    AppearanceFixture.apply();
    bridge = PreloadBridgeFixture.install();
  });

  afterEach(() => {
    AppearanceFixture.reset();
    PreloadBridgeFixture.remove();
  });

  async function renderAsync(): Promise<ComponentFixture<RuntimeStatusComponent>> {
    const fixture = TestBed.createComponent(RuntimeStatusComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function read(fixture: ComponentFixture<RuntimeStatusComponent>, kind: string, details: readonly string[]): readonly string[] {
    bridge.publishStartup({ kind, details });
    fixture.detectChanges();
    const line = DomFixture.one(DomFixture.host(fixture), "[role=status]");
    return [...line.children].map(t => t.textContent?.trim() ?? String.empty);
  }

  it("says the runtime is connected while it is ready, as a status, and not connected and why, as the startup card says, in every other state", async () => {
    const fixture = await renderAsync();
    const ready = [...DomFixture.host(fixture).querySelectorAll("[role=status] > span")].map(t => t.textContent?.trim());

    const shown = [
      read(fixture, "Connecting", []),
      read(fixture, "PreShellData", ["/home/person/.noldova/desktop"]),
      read(fixture, "WorkInProgress", ["Notes is saving", "Clock is ticking"]),
      read(fixture, "WaitingForWork", ["Notes is saving"]),
      read(fixture, "NewerBuild", ["2.1.0"]),
      read(fixture, "Updating", ["2.1.0"]),
      read(fixture, "Failed", ["The data folder is read-only."]),
      read(fixture, "Failed", []),
      read(fixture, "Ready", [])
    ];

    expect(ready).toEqual(["Connected"]);
    expect(shown).toEqual([
      ["Not connected", "Starting Noldova Desktop Sample…"],
      ["Not connected", "Data from an earlier Noldova Desktop Sample", "/home/person/.noldova/desktop"],
      ["Not connected", "An older Noldova Desktop Sample is still working", "Notes is saving", "Clock is ticking"],
      ["Not connected", "Waiting for the older Noldova Desktop Sample", "Notes is saving"],
      ["Not connected", "A newer Noldova Desktop Sample is running", "Noldova Desktop Sample 2.1.0 is using this data folder. Use that Noldova Desktop Sample instead."],
      ["Not connected", "Installing Noldova Desktop Sample 2.1.0"],
      ["Not connected", "Noldova Desktop Sample could not start", "The data folder is read-only."],
      ["Not connected", "Noldova Desktop Sample could not start"],
      ["Connected"]
    ]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark])
    it(`mutes the reason under the state, both starting inside the row's padding, in ${mode} mode`, async () => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const fixture = await renderAsync();
      const host = DomFixture.host(fixture);
      read(fixture, "Failed", ["The data folder is read-only."]);
      const spans = DomFixture.all(host, "[role=status] > span");
      const [state, reason] = [DomFixture.present(spans[0]), DomFixture.present(spans[1])];
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);

      expect([getComputedStyle(reason).color, getComputedStyle(state).color === getComputedStyle(reason).color])
        .toEqual([AppearanceFixture.readColor(DefaultTheme.theme, mode, "text-muted"), false]);
      expect([state, reason].map(t => (t.getBoundingClientRect().left - host.getBoundingClientRect().left) / rem)).toEqual([0.875, 0.875]);
      expect(reason.getBoundingClientRect().top).toBeGreaterThanOrEqual(state.getBoundingClientRect().bottom);
    });
});
