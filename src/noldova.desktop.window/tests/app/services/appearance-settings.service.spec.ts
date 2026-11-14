/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { AppearanceService, FontChoice, ModePreference } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";
import type { SettingDefinition } from "@noldova/desktop.protocol";

import { AppearanceSettingsService } from "../../../src/app/services/appearance-settings.service";
import { SettingsService } from "../../../src/app/services/settings.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { SettingsFixture } from "../../fixtures/settings.fixture";

class FakeSettingsService {
  public readonly definitions: WritableSignal<readonly SettingDefinition[]> = signal([]);
  public readonly values: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map());
}

describe("AppearanceSettingsService", () => {
  let bridge: PreloadBridgeFixture;
  let settings: FakeSettingsService;

  const kept = {
    "desktop.theme": "desktop.default", "desktop.mode": "Dark", "desktop.interfaceFont": "System", "desktop.codeFont": "Noldova",
    "desktop.panelSize": 15, "desktop.messageSize": 14, "desktop.codeSize": 14
  };

  function start(): AppearanceService {
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: settings }] });
    TestBed.inject(AppearanceSettingsService);
    TestBed.tick();
    return TestBed.inject(AppearanceService);
  }

  function load(values: Record<string, JsonValue>): void {
    settings.definitions.set(SettingsFixture.all);
    settings.values.set(new Map(Object.entries(values)));
    TestBed.tick();
  }

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
    settings = new FakeSettingsService();
  });

  afterEach(() => PreloadBridgeFixture.remove());

  it("starts from the device's last appearance before settings load, and keeps nothing while they match", () => {
    bridge.appearance = kept;

    const appearance = start();
    const before = [appearance.modePreference(), appearance.typography().panelSize, appearance.typography().interfaceFont];
    load(kept);

    expect(before).toEqual([ModePreference.Dark, 15, FontChoice.System]);
    expect(bridge.keptAppearances).toEqual([]);
  });

  it("applies each change of the appearance settings and keeps it for the next start", () => {
    const appearance = start();
    const initial = appearance.modePreference();

    load({ ...kept, "desktop.mode": "Light" });
    load({ ...kept, "desktop.mode": "Light", "desktop.codeSize": 18 });
    load({ ...kept, "desktop.mode": "Light", "desktop.codeSize": 18 });

    expect(initial).toBe(ModePreference.System);
    expect([appearance.modePreference(), appearance.typography().codeSize]).toEqual([ModePreference.Light, 18]);
    expect(bridge.keptAppearances.map(t => [t["desktop.mode"], t["desktop.codeSize"]])).toEqual([["Light", 14], ["Light", 18]]);
  });

  it("ignores a last appearance it cannot read, and values that do not form one", () => {
    bridge.appearance = { "desktop.mode": "Sepia" };

    const appearance = start();
    load({ ...kept, "desktop.panelSize": "large" });

    expect(appearance.modePreference()).toBe(ModePreference.System);
    expect(bridge.keptAppearances).toEqual([]);
  });
});
