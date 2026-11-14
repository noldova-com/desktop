/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import { UpdateItemComponent } from "../../../../src/app/components/update-item/update-item.component";
import { UpdateStateKind } from "../../../../src/app/enums/update-state-kind";
import { UpdateState } from "../../../../src/app/models/update-state";
import { UpdateService } from "../../../../src/app/services/update.service";
import type { Theme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("UpdateItemComponent", () => {
  let state: WritableSignal<UpdateState>;
  let calls: string[];

  const of = (kind: UpdateStateKind, fields: Partial<{ version: string; progress: number; mustMove: boolean }> = {}): UpdateState =>
    new UpdateState(kind, fields.version ?? null, fields.progress ?? null, null, null, fields.mustMove ?? false);

  beforeEach(() => {
    state = signal(UpdateState.off);
    calls = [];
    TestBed.configureTestingModule({
      providers: [{
        provide: UpdateService,
        useValue: { state, act: (action: string) => calls.push(action), openAbout: () => calls.push("About") }
      }]
    });
  });

  afterEach(async () => {
    await userEvent.unhover(document.body);
    AppearanceFixture.reset();
  });

  async function renderAsync(kind: UpdateState): Promise<ComponentFixture<UpdateItemComponent>> {
    state.set(kind);
    const fixture = TestBed.createComponent(UpdateItemComponent);
    await fixture.whenStable();
    return fixture;
  }

  function item(fixture: ComponentFixture<UpdateItemComponent>): HTMLButtonElement | null {
    return DomFixture.host(fixture).querySelector("button.nol-update-item");
  }

  it("shows nothing while updates are off, while checking or downloading, and while Noldova Desktop Sample is up to date", async () => {
    const fixture = await renderAsync(of(UpdateStateKind.Off));
    const texts = [DomFixture.host(fixture).textContent];
    for (const next of [of(UpdateStateKind.Checking), of(UpdateStateKind.UpToDate), of(UpdateStateKind.Downloading, { version: "1.3.0", progress: 42 })]) {
      state.set(next);
      await fixture.whenStable();
      texts.push(DomFixture.host(fixture).textContent);
    }

    expect(texts).toEqual([String.empty, String.empty, String.empty, String.empty]);
  });

  it("shows each state that needs the person, with its icon and text, and runs what the state offers", async () => {
    const fixture = await renderAsync(of(UpdateStateKind.Off));
    const shown: string[] = [];
    for (const next of [
      of(UpdateStateKind.Available, { version: "1.3.0", mustMove: true }),
      of(UpdateStateKind.Ready, { version: "1.3.0" }),
      of(UpdateStateKind.Failed),
      of(UpdateStateKind.Failed, { mustMove: true })
    ]) {
      state.set(next);
      await fixture.whenStable();
      const button = item(fixture);
      shown.push([...button?.querySelectorAll("span") ?? []].map(t => t.textContent?.trim()).join(" "));
      button?.click();
    }

    expect(shown).toEqual([
      "deployed_code_update Move to Applications to update",
      "restart_alt Restart to update",
      "error Update failed",
      "error Update failed"
    ]);
    expect(calls).toEqual(["About", "Restart", "About", "About"]);
    expect(item(fixture)?.querySelector(".nol-update-item-error")).not.toBeNull();
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = await renderAsync(of(UpdateStateKind.Failed));
        const away = document.body.appendChild(document.createElement("div"));
        Object.assign(away.style, { position: "fixed", right: "0", bottom: "0", width: "40px", height: "40px" });
        await userEvent.hover(away);
        away.remove();
        const button = DomFixture.present(item(fixture));

        const itemStyle = getComputedStyle(button);
        const icon = getComputedStyle(DomFixture.oneOf(button, ".nol-update-item-icon", Element));
        const resting = itemStyle.backgroundColor;
        await userEvent.hover(button);
        const hovered = itemStyle.backgroundColor;

        expect(resting).toBe("rgba(0, 0, 0, 0)");
        expect(channels(hovered)).toEqual(channels(AppearanceFixture.readColor(theme, mode, "toolbar-hover")));
        expect(alpha(hovered)).toBeCloseTo(hoverAlpha(theme, mode), 2);
        expect(icon.color).toBe(AppearanceFixture.readColor(theme, mode, "error"));
        AppearanceFixture.expectLook(itemStyle.paddingLeft, theme, "pill-padding", "padding-left");
        AppearanceFixture.expectLook(itemStyle.height, theme, "status-bar-item-height", "height");
        AppearanceFixture.expectLook(itemStyle.borderTopLeftRadius, theme, "radius-hover", "border-top-left-radius");
        AppearanceFixture.expectLook(icon.fontSize, theme, "icon", "font-size");
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
