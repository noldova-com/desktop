/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { page } from "vitest/browser";

import type { JsonValue } from "@noldova/context.json";
import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/desktop.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { ModuleSwitchComponent } from "../../../../src/app/components/module-switch/module-switch.component";
import { ModuleSwitchService } from "../../../../src/app/services/module-switch.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("ModuleSwitchComponent", () => {
  let fixture: ComponentFixture<ModuleSwitchComponent>;
  let values: WritableSignal<ReadonlyMap<string, JsonValue>>;
  let switched: { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void };
  let calls: string[];
  let errors: unknown[];

  const definition = new SettingDefinition(
    QualifiedName.parse("clock.enabled"), "Clock", "Shows the clock.", SettingType.boolean(), true, SettingLocality.Shared, [], "Clock", "Clock");

  beforeEach(() => {
    values = signal(new Map<string, JsonValue>([["clock.enabled", true]]));
    switched = defer();
    calls = [];
    errors = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useValue: { definitions: signal([definition]), values } },
        {
          provide: ModuleSwitchService, useValue: {
            setAsync: (name: string, value: JsonValue): Promise<void> => {
              calls.push(`${name} ${JSON.stringify(value)}`);
              return switched.promise;
            }
          }
        },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
  });

  function defer(): { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void } {
    let resolve: () => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    const promise = new Promise<void>((done, fail) => {
      resolve = () => done();
      reject = (error: unknown) => fail(error);
    });
    return { promise, resolve, reject };
  }

  afterEach(() => AppearanceFixture.reset());

  function render(setting: string): HTMLInputElement {
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
    fixture = TestBed.createComponent(ModuleSwitchComponent);
    fixture.componentRef.setInput("setting", setting);
    fixture.detectChanges();
    return DomFixture.oneOf(DomFixture.host(fixture), "input", HTMLInputElement);
  }

  async function settleAsync(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function finishAsync(change: { promise: Promise<void>; resolve: () => void }): Promise<void> {
    change.resolve();
    await change.promise.catch(() => undefined).finally(() => undefined);
    fixture.detectChanges();
  }

  it("shows the switch setting as a checkbox labelled by its description, checked unless the setting is false", async () => {
    const box = render("clock.enabled");
    const label = DomFixture.host(fixture).textContent?.trim();
    const isChecked = [box.checked];
    values.set(new Map([["clock.enabled", false]]));
    await settleAsync();
    isChecked.push(box.checked);
    values.set(new Map());
    await settleAsync();
    isChecked.push(box.checked);

    expect(label).toBe("Shows the clock.");
    expect(isChecked).toEqual([true, false, true]);
    expect(page.getByRole("checkbox", { name: "Shows the clock." }).element()).toBe(box);
  });

  it("is labelled by the setting's name when Settings doesn't define it", () => {
    render("alarm.enabled");

    expect(DomFixture.host(fixture).textContent?.trim()).toBe("alarm.enabled");
  });

  it("keeps the box where the person put it while the switch runs, and puts it back when the setting stayed as it was", async () => {
    const box = render("clock.enabled");

    await page.getByRole("checkbox", { name: "Shows the clock." }).click();
    fixture.detectChanges();
    const whileSwitching = box.checked;
    switched.resolve();
    await settleAsync();

    expect(calls).toEqual(["clock.enabled false"]);
    expect([whileSwitching, box.checked]).toEqual([false, true]);
    expect(errors).toEqual([]);
  });

  it("keeps the box where the person last put it while an earlier change finishes, when it is switched off and on again", async () => {
    const box = render("clock.enabled");
    const off = switched;

    await page.getByRole("checkbox", { name: "Shows the clock." }).click();
    switched = defer();
    await page.getByRole("checkbox", { name: "Shows the clock." }).click();
    values.set(new Map([["clock.enabled", false]]));
    await finishAsync(off);
    const afterOff = box.checked;
    values.set(new Map([["clock.enabled", true]]));
    switched.resolve();
    await settleAsync();

    expect(calls).toEqual(["clock.enabled false", "clock.enabled true"]);
    expect([afterOff, box.checked]).toEqual([true, true]);
    expect(errors).toEqual([]);
  });

  it("follows the setting once the switch is done, and reports a switch that fails and puts the box back", async () => {
    const box = render("clock.enabled");
    const failure = new Error("The runtime refused it.");

    await page.getByRole("checkbox", { name: "Shows the clock." }).click();
    values.set(new Map([["clock.enabled", false]]));
    switched.resolve();
    await settleAsync();
    const afterSwitch = box.checked;
    switched = defer();
    await page.getByRole("checkbox", { name: "Shows the clock." }).click();
    switched.reject(failure);
    await settleAsync();

    expect(calls).toEqual(["clock.enabled false", "clock.enabled true"]);
    expect([afterSwitch, box.checked]).toEqual([false, false]);
    expect(errors).toEqual([failure]);
  });
});
