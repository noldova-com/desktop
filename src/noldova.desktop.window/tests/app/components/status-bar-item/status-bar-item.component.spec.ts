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

import { type Theme, type ThemeMode, TooltipDirective } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";

import { StatusBarItemComponent } from "../../../../src/app/components/status-bar-item/status-bar-item.component";
import { StatusBarItemTone } from "../../../../src/app/enums/status-bar-item-tone";
import { StatusBarSide } from "../../../../src/app/enums/status-bar-side";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { StatusBarItem } from "../../../../src/app/models/status-bar-item";
import { StatusBarItemContribution } from "../../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../../src/app/models/status-bar-item-state";
import { CommandService } from "../../../../src/app/services/command.service";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("StatusBarItemComponent", () => {
  const LONG = "2 notes, neither pinned nor archived, both last changed today and both waiting for review";

  let errors: unknown[];
  let runs: JsonValue[];

  beforeEach(() => {
    errors = [];
    runs = [];
    PreloadBridgeFixture.install();
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
  });

  afterEach(() => {
    AppearanceFixture.reset();
    PreloadBridgeFixture.remove();
  });

  function register(...names: readonly string[]): void {
    TestBed.inject(CommandService).setCommands(names.map(t => new CommandContribution(t, "Tick", null, null, async u => {
      runs.push(u);
      if (t === "clock.fail")
        throw new Error("The clock stopped.");
      return null;
    })));
  }

  function render(state: StatusBarItemState): [ComponentFixture<StatusBarItemComponent>, StatusBarItem] {
    const item = new StatusBarItem(new StatusBarItemContribution("clock.ticks", StatusBarSide.Right, state), () => undefined);
    const fixture = TestBed.createComponent(StatusBarItemComponent);
    fixture.componentRef.setInput("item", item);
    fixture.detectChanges();
    return [fixture, item];
  }

  it("shows an item without a command as a pill that is not a button, named by its text", () => {
    const [fixture] = render(new StatusBarItemState("2 notes"));
    const host: HTMLElement = DomFixture.host(fixture);
    const pill = host.querySelector(".nol-status-bar-item");

    expect(host.querySelector("button")).toBeNull();
    expect([pill?.getAttribute("role"), pill?.getAttribute("aria-label"), pill?.textContent?.trim()]).toEqual(["status", "2 notes", "2 notes"]);
    expect(host.getAttribute("data-nol-item")).toBe("clock.ticks");
  });

  it("runs its command with its arguments when clicked, while the command is registered", () => {
    register("clock.tick");
    const [fixture] = render(new StatusBarItemState("No ticks", { icon: "timer", tooltip: "Tick the clock", command: "clock.tick", commandArguments: { by: 2 } }));
    const button = DomFixture.host(fixture).querySelector<HTMLButtonElement>("button.nol-status-bar-item");

    button?.click();

    expect(button?.disabled).toBe(false);
    expect(button?.querySelector(".nol-status-bar-item-icon")?.textContent).toBe("timer");
    expect(button?.getAttribute("aria-label")).toBeNull();
    expect(runs).toEqual([{ by: 2 }]);
  });

  it("is disabled while its command is not registered", () => {
    const [fixture] = render(new StatusBarItemState("No ticks", { command: "clock.tick" }));
    const button = DomFixture.host(fixture).querySelector<HTMLButtonElement>("button");

    expect(button?.disabled).toBe(true);

    register("clock.tick");
    fixture.detectChanges();

    expect(button?.disabled).toBe(false);
  });

  it("reports a command that fails", async () => {
    register("clock.fail");
    const [fixture] = render(new StatusBarItemState("No ticks", { command: "clock.fail" }));

    fixture.nativeElement.querySelector("button")?.click();
    await fixture.whenStable();

    expect(errors.map(t => String(t))).toEqual(["Error: The clock stopped."]);
  });

  it("names an icon-only item by its tooltip", () => {
    const [fixture] = render(new StatusBarItemState(String.empty, { icon: "notifications", tooltip: "Notifications" }));
    const pill = fixture.nativeElement.querySelector(".nol-status-bar-item");

    expect(pill?.getAttribute("aria-label")).toBe("Notifications");
    expect(pill?.querySelector(".nol-status-bar-item-text")).toBeNull();
  });

  it("follows its updates and hides while it is hidden", () => {
    AppearanceFixture.apply();
    const [fixture, item] = render(new StatusBarItemState("2 notes"));
    const host: HTMLElement = DomFixture.host(fixture);

    item.update(new StatusBarItemState("3 notes"));
    fixture.detectChanges();
    const shown = host.textContent?.trim();
    item.update(new StatusBarItemState("3 notes", { isHidden: true }));
    fixture.detectChanges();

    expect(shown).toBe("3 notes");
    expect(getComputedStyle(host).display).toBe("none");
  });

  for (const [kind, command] of [["a plain", {}], ["a button", { command: "clock.tick" }]] as const)
    for (const [owning, tooltip] of [["without", {}], ["with", { tooltip: "Tick the clock" }]] as const)
      it(`shows the full text of ${kind} item ${owning} its own tooltip only when cut short, and is named by it`, async () => {
        AppearanceFixture.apply();
        register("clock.tick");
        const shownFor = async (text: string): Promise<string | null> => {
          const [fixture] = render(new StatusBarItemState(text, { ...command, ...tooltip }));
          const host: HTMLElement = DomFixture.host(fixture);
          host.style.width = "6rem";
          const directive = fixture.debugElement.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);
          directive.show();
          await fixture.whenStable();
          const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.textContent?.trim() ?? null;
          directive.hide();
          const pill = host.querySelector(".nol-status-bar-item");
          expect(pill?.getAttribute("aria-label")).toBe("command" in command ? null : text);
          expect(pill?.textContent?.trim()).toBe(text);
          fixture.destroy();
          return shown;
        };

        const long = await shownFor(LONG);
        const short = await shownFor("2 notes");

        expect([long, short]).toEqual("tooltip" in tooltip ? [tooltip.tooltip, tooltip.tooltip] : [LONG, null]);
      });

  it("ends text too long for its width with an ellipsis", () => {
    AppearanceFixture.apply();
    const [fixture] = render(new StatusBarItemState(LONG));
    DomFixture.host(fixture).style.width = "6rem";

    AppearanceFixture.expectTruncates(DomFixture.one(DomFixture.host(fixture), ".nol-status-bar-item-text"));
  });

  for (const theme of AppearanceFixture.themes)
    it(`is a pill with the ${theme.id} theme's status bar item geometry`, () => {
      AppearanceFixture.apply(theme);
      register("clock.tick");

      const [fixture] = render(new StatusBarItemState("No ticks", { command: "clock.tick" }));
      const host = getComputedStyle(fixture.nativeElement);
      const pill = getComputedStyle(fixture.nativeElement.querySelector(".nol-status-bar-item"));

      AppearanceFixture.expectLook(host.height, theme, "status-bar-item-height", "height");
      AppearanceFixture.expectLook(pill.paddingLeft, theme, "pill-padding", "padding-left");
      AppearanceFixture.expectLook(pill.paddingRight, theme, "pill-padding", "padding-right");
      AppearanceFixture.expectLook(pill.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
    });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`draws a muted item's text and icon in the ${theme.id} theme's muted text color in ${mode} mode, and a neutral one in the bar's text color`, () => {
        AppearanceFixture.apply(theme, mode);
        register("clock.tick");
        const colors = (state: StatusBarItemState): readonly string[] => {
          const [fixture] = render(state);
          const pill = DomFixture.one(DomFixture.host(fixture), ".nol-status-bar-item");
          const drawn = [pill, DomFixture.one(pill, ".nol-status-bar-item-icon"), DomFixture.one(pill, ".nol-status-bar-item-text")].map(t => getComputedStyle(t).color);
          fixture.destroy();
          return drawn;
        };
        const muted = AppearanceFixture.readColor(theme, mode, "text-muted");

        const plain = colors(new StatusBarItemState("Synced", { icon: "cloud_done", tone: StatusBarItemTone.Muted }));
        const button = colors(new StatusBarItemState("Synced", { icon: "cloud_done", tone: StatusBarItemTone.Muted, command: "clock.tick" }));
        const neutral = colors(new StatusBarItemState("Synced", { icon: "cloud_done" }));

        expect([...plain, ...button]).toEqual(Array.from({ length: 6 }, () => muted));
        expect(neutral.every(t => t !== muted)).toBe(true);
      });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`fills a button item under the pointer with the ${theme.id} theme's toolbar hover color in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        register("clock.tick");
        const [fixture] = render(new StatusBarItemState("No ticks", { command: "clock.tick" }));
        const pill = DomFixture.oneOf(DomFixture.host(fixture), "button.nol-status-bar-item", HTMLButtonElement);

        await userEvent.hover(pill);
        const hovered = getComputedStyle(pill).backgroundColor;
        await userEvent.unhover(pill);

        expect(channels(hovered)).toEqual(channels(AppearanceFixture.readColor(theme, mode, "toolbar-hover")));
        expect(alpha(hovered)).toBeCloseTo(hoverAlpha(theme, mode), 2);
      });

  function channels(color: string): string[] {
    return (color.match(/[\d.]+/gu) ?? []).slice(0, 3);
  }

  function alpha(color: string): number {
    return Number((color.match(/[\d.]+/gu) ?? [])[3] ?? "1");
  }

  function hoverAlpha(theme: Theme, mode: ThemeMode): number {
    const color = theme.readColor(mode, "toolbar-hover") ?? String.empty;
    return color.length === 9 ? Number.parseInt(color.slice(7, 9), 16) / 255 : 1;
  }
});
