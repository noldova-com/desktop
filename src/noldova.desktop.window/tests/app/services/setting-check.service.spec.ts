/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { TestBed } from "@angular/core/testing";

import { SettingEntry, SettingsSnapshot, SettingType } from "@noldova/desktop.protocol";

import { SettingCheckService } from "../../../src/app/services/setting-check.service";
import { SettingsService } from "../../../src/app/services/settings.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { SettingsFixture } from "../../fixtures/settings.fixture";

describe("SettingCheckService", () => {
  const sites = SettingsFixture.define("notes.sites", "Sites", "The sites notes link to.", SettingType.text(200, true), String.empty, "Notes", "Links");
  let service: SettingCheckService;

  beforeEach(async () => {
    const bridge = PreloadBridgeFixture.install();
    bridge.responses.set("desktop.settings", {
      payload: new SettingsSnapshot([sites, SettingsFixture.greeting], [new SettingEntry(sites.name, String.empty, false), new SettingEntry(SettingsFixture.greeting.name, "Noon", false)]).toJson()
    });
    await TestBed.inject(SettingsService).loadAsync();
    service = TestBed.inject(SettingCheckService);
  });

  afterEach(() => PreloadBridgeFixture.remove());

  it("tells a checked text setting from the others", () => {
    expect(["notes.sites", "clock.greeting", "notes.unknown"].map(t => service.isChecked(t))).toEqual([true, false, false]);
  });

  it("reads the check a part supplies until it stops, and a later check replaces it while the earlier stop leaves it", () => {
    const first = (): string | null => "First";
    const second = (): string | null => "Second";

    expect(service.read("notes.sites")).toBeNull();
    const stopFirst = service.provide("notes.sites", first);
    expect(service.read("notes.sites")).toBe(first);
    const stopSecond = service.provide("notes.sites", second);
    stopFirst();
    expect(service.read("notes.sites")).toBe(second);
    stopSecond();
    expect(service.read("notes.sites")).toBeNull();
  });
});
