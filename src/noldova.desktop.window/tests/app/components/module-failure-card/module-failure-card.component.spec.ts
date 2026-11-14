/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ModuleState } from "@noldova/desktop.protocol";

import { ModuleFailureCardComponent } from "../../../../src/app/components/module-failure-card/module-failure-card.component";
import { ModuleFailure } from "../../../../src/app/models/module-failure";
import { ModuleSwitchService } from "../../../../src/app/services/module-switch.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("ModuleFailureCardComponent", () => {
  afterEach(() => AppearanceFixture.reset());

  function render(cause: string | null, isTurnedOff: boolean = false, state: ModuleState = ModuleState.Blocked): HTMLElement {
    const fixture = TestBed.createComponent(ModuleFailureCardComponent);
    fixture.componentRef.setInput("failure", new ModuleFailure("clock", "Clock", state, cause, ["clock.face"], [], null, isTurnedOff));
    fixture.detectChanges();
    return DomFixture.host(fixture);
  }

  function renderOff(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useValue: { definitions: signal([]), values: signal(new Map([["clock.enabled", false]])) } },
        { provide: ModuleSwitchService, useValue: {} }
      ]
    });
    const fixture = TestBed.createComponent(ModuleFailureCardComponent);
    fixture.componentRef.setInput("failure", new ModuleFailure("clock", "Clock", ModuleState.Off, null, ["clock.face"], ["clock.note"], "clock.enabled"));
    fixture.detectChanges();
    return DomFixture.host(fixture);
  }

  function find(card: HTMLElement, selector: string): HTMLElement {
    const found = card.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing in the card matches ${selector}.`);
    return found;
  }

  it("names the module that didn't start and says why, with an error icon, on the kit's card", () => {
    const card = render("It depends on tasks, which is not active.");

    expect(card.querySelector(".nol-module-failure-card")?.tagName).toBe("NOL-CARD");
    expect(card.querySelector("h2")?.textContent).toMatch(/^\s*error\s*Clock didn't start\s*$/);
    expect(card.querySelector(".nol-module-failure-card-icon")?.getAttribute("aria-hidden")).toBe("true");
    expect(card.querySelector(".nol-module-failure-card-cause")?.textContent).toBe("It depends on tasks, which is not active.");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const card = render("Its runtime part failed to activate.");
        const surface = getComputedStyle(DomFixture.oneOf(card, ".nol-module-failure-card", Element));
        const icon = getComputedStyle(DomFixture.oneOf(card, ".nol-module-failure-card-icon", Element));

        expect(surface.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "raised"));
        expect(surface.borderTopColor).toBe(AppearanceFixture.readColor(theme, mode, "card-border"));
        expect(icon.color).toBe(AppearanceFixture.readColor(theme, mode, "error"));
        AppearanceFixture.expectLook(surface.borderTopLeftRadius, theme, "radius-medium", "border-top-left-radius");
        AppearanceFixture.expectLook(surface.borderTopWidth, theme, "border-width", "border-top-width");
        AppearanceFixture.expectLook(surface.paddingTop, theme, "space-3", "padding-top");
        expect(getComputedStyle(card).padding).toBe("0px");
      });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`marks a module blocked by one that was turned off with a muted off icon, and still says why, in the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const card = render("It depends on alarm, which is off.", true);
        const icon = DomFixture.oneOf(card, ".nol-module-failure-card-icon", Element);

        expect(card.querySelector("h2")?.textContent).toMatch(/^\s*toggle_off\s*Clock didn't start\s*$/);
        expect(card.querySelector(".nol-module-failure-card-cause")?.textContent).toBe("It depends on alarm, which is off.");
        expect(getComputedStyle(icon).color).toBe(AppearanceFixture.readColor(theme, mode, "text-muted"));
        expect(card.querySelector("nol-module-switch")).toBeNull();
      });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`marks a module that doesn't run on this platform with a muted block icon laid out as the off icon, and says why, in the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const measure = (card: HTMLElement): readonly number[] => {
          const title = find(card, "h2").getBoundingClientRect();
          const icon = find(card, ".nol-module-failure-card-icon").getBoundingClientRect();
          const label = find(card, "h2 > span:last-child").getBoundingClientRect();
          const cause = find(card, ".nol-module-failure-card-cause").getBoundingClientRect();
          return [icon.left - title.left, icon.width, label.left - icon.right, cause.left - title.left, cause.top - title.bottom].map(t => t / rem);
        };
        const unavailable = render("It doesn't run on Linux.", true, ModuleState.Unavailable);
        const icon = getComputedStyle(find(unavailable, ".nol-module-failure-card-icon"));
        const look = [icon.color, icon.fontSize, getComputedStyle(find(unavailable, "h2")).columnGap];
        const text = [unavailable.querySelector("h2")?.textContent, unavailable.querySelector(".nol-module-failure-card-cause")?.textContent];
        const hasSwitch = !Object.isNull(unavailable.querySelector("nol-module-switch"));
        const unavailableGeometry = measure(unavailable);
        const offGeometry = measure(render("It depends on alarm, which is off.", true));

        expect(text[0]).toMatch(/^\s*block\s*Clock didn't start\s*$/);
        expect(text[1]).toBe("It doesn't run on Linux.");
        expect(look[0]).toBe(AppearanceFixture.readColor(theme, mode, "text-muted"));
        expect(hasSwitch).toBe(false);
        AppearanceFixture.expectLook(look[1] ?? String.empty, theme, "icon", "font-size");
        AppearanceFixture.expectLook(look[2] ?? String.empty, theme, "space-2", "column-gap");
        expect(unavailableGeometry[1]).toBeGreaterThan(0);
        unavailableGeometry.forEach((t, i) => expect(t).toBeCloseTo(offGeometry[i] ?? Number.NaN, 2));
      });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`says an off module is off, with a muted icon and its switch where the cause goes, starting where the title does, in the ${theme.id} theme in ${mode} mode`, () => {
        AppearanceFixture.apply(theme, mode);

        const card = renderOff();
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const icon = DomFixture.oneOf(card, ".nol-module-failure-card-icon", Element);
        const control = DomFixture.oneOf(card, "nol-module-switch .nol-checkbox-control", Element);

        expect(card.querySelector("h2")?.textContent).toMatch(/^\s*toggle_off\s*Clock is off\s*$/);
        expect(card.querySelector(".nol-module-failure-card-cause")).toBeNull();
        expect(DomFixture.oneOf(card, "nol-module-switch input", HTMLInputElement).checked).toBe(false);
        expect(getComputedStyle(icon).color).toBe(AppearanceFixture.readColor(theme, mode, "text-muted"));
        expect((control.getBoundingClientRect().left - icon.getBoundingClientRect().left) / rem).toBe(0);
        expect(control.getBoundingClientRect().top).toBeGreaterThanOrEqual(icon.getBoundingClientRect().bottom);
      });
});
