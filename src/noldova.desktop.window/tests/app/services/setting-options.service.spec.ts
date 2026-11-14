/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ErrorHandler, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { JsonObject } from "@noldova/context.json";
import { SettingChange, SettingEntry, SettingKey, SettingOption, SettingsSnapshot, SettingType } from "@noldova/desktop.protocol";

import { WindowPartFailureException } from "../../../src/app/exceptions/window-part-failure.exception";
import { SettingOptionsService } from "../../../src/app/services/setting-options.service";
import { SettingsService } from "../../../src/app/services/settings.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";
import { SettingsFixture } from "../../fixtures/settings.fixture";

describe("SettingOptionsService", () => {
  const account = SettingsFixture.define("notes.account", "Account", "The account notes are sent with.", SettingType.dynamicChoice(), String.empty, "Notes", "Defaults");
  const model = SettingsFixture.define("notes.model", "Model", "The model notes are written with.", SettingType.dynamicChoice(), String.empty, "Notes", "Defaults");
  const models: Readonly<Record<string, readonly SettingOption[]>> = {
    work: [new SettingOption(String.empty, "Provider default"), new SettingOption("large", "Large")],
    home: [new SettingOption("small", "Small")]
  };
  let bridge: PreloadBridgeFixture;
  let service: SettingOptionsService;
  let reported: unknown[];

  beforeEach(async () => {
    bridge = PreloadBridgeFixture.install();
    bridge.responses.set("desktop.settings", {
      payload: new SettingsSnapshot([account, model, SettingsFixture.greeting], [
        new SettingEntry(account.name, "work", true), new SettingEntry(model.name, String.empty, false), new SettingEntry(SettingsFixture.greeting.name, "Noon", false)
      ]).toJson()
    });
    reported = [];
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => reported.push(error) } }] });
    await TestBed.inject(SettingsService).loadAsync();
    service = TestBed.inject(SettingOptionsService);
  });

  afterEach(() => PreloadBridgeFixture.remove());

  function changeAccount(value: string): void {
    bridge.publishEvent("desktop.settingsChanged", new SettingChange(new SettingKey(account.name), value, true).toJson());
  }

  it("tells a dynamic choice setting from the others", () => {
    expect(["notes.model", "notes.account", "clock.greeting", "notes.unknown"].map(t => service.isDynamic(t))).toEqual([true, true, false, false]);
  });

  it("asks the provider with its module's settings, again when one of them changes or the part refreshes, and supplies nothing without one", () => {
    const asked: JsonObject[] = [];
    let refreshed = 0;
    const provider = (values: JsonObject): readonly SettingOption[] => {
      asked.push(values);
      return refreshed > 0 ? [new SettingOption("medium", "Medium")] : models[String(values["notes.account"])] ?? [];
    };

    expect(service.read("notes.model")).toBeNull();
    service.provide("notes.model", provider);
    const first = service.read("notes.model");
    expect(service.read("notes.model")).toBe(first);
    changeAccount("home");
    const second = service.read("notes.model");
    refreshed++;
    service.refresh("notes.model");
    service.refresh("notes.account");

    expect(first?.map(t => t.title)).toEqual(["Provider default", "Large"]);
    expect(second?.map(t => t.value)).toEqual(["small"]);
    expect(service.read("notes.model")?.map(t => t.value)).toEqual(["medium"]);
    expect(asked).toEqual([{ "notes.account": "work", "notes.model": String.empty }, { "notes.account": "home", "notes.model": String.empty }, { "notes.account": "home", "notes.model": String.empty }]);
    expect(service.read("notes.account")).toBeNull();
  });

  it("lets the provider write a signal, and asks it again for neither a signal it reads nor another module's setting", () => {
    const writes = signal(0);
    let asked = 0;
    service.provide("notes.model", () => {
      asked++;
      writes.update(t => t + 1);
      return models["home"] ?? [];
    });

    const first = service.read("notes.model");
    writes.set(10);
    bridge.publishEvent("desktop.settingsChanged", new SettingChange(new SettingKey(SettingsFixture.greeting.name), "Evening", false).toJson());
    const second = service.read("notes.model");

    expect([first?.map(t => t.value), second?.map(t => t.value), asked, writes(), reported]).toEqual([["small"], ["small"], 1, 10, []]);
  });

  it("supplies nothing while the provider says its data is still loading, and its options once it refreshes", () => {
    let isLoaded = false;
    service.provide("notes.model", () => isLoaded ? models["home"] ?? [] : null);

    const loading = service.read("notes.model");
    isLoaded = true;
    service.refresh("notes.model");

    expect(loading).toBeNull();
    expect(service.read("notes.model")?.map(t => t.value)).toEqual(["small"]);
    expect(reported).toEqual([]);
  });

  it("stops supplying when stopped, and a stop from a replaced provider keeps the later one", () => {
    const stopFirst = service.provide("notes.model", () => models["home"] ?? []);
    const stopSecond = service.provide("notes.model", () => models["work"] ?? []);

    stopFirst();
    const kept = service.read("notes.model");
    stopSecond();

    expect(kept?.map(t => t.value)).toEqual([String.empty, "large"]);
    expect(service.read("notes.model")).toBeNull();
  });

  it("supplies nothing and reports it to the module when the provider throws or repeats a value", () => {
    const failure = new Error("catalog unreadable");
    service.provide("notes.model", () => {
      throw failure;
    });
    service.provide("notes.account", () => [new SettingOption("work", "Work"), new SettingOption("work", "Work again")]);

    const options = [service.read("notes.model"), service.read("notes.account")];

    expect(options).toEqual([null, null]);
    expect(reported.map(t => t instanceof WindowPartFailureException ? [t.moduleId, t.message, t.cause] : t)).toEqual([
      ["notes", "Supplying the options of the setting notes.model failed; Settings shows its value alone until they are supplied again.", failure],
      ["notes", "The options supplied for the setting notes.account share a value; Settings shows its value alone until they are supplied again.", undefined]
    ]);
  });
});
