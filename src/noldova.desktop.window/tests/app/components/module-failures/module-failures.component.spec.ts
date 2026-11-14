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

import { ModuleState } from "@noldova/desktop.protocol";

import { ModuleFailuresComponent } from "../../../../src/app/components/module-failures/module-failures.component";
import type { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import { ModuleFailure } from "../../../../src/app/models/module-failure";
import { ShellDocuments } from "../../../../src/app/models/shell-documents";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { ModuleSelectionService } from "../../../../src/app/services/module-selection.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import type { Theme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("ModuleFailuresComponent", () => {
  const clock = new ModuleFailure("clock", "Clock", ModuleState.Failed, "Its runtime part failed to activate.", ["clock.face"]);
  const notes = new ModuleFailure("notes", "Notes", ModuleState.Blocked, "It depends on clock, which is not active.", []);
  let failures: WritableSignal<readonly ModuleFailure[]>;
  let opened: DocumentTab[];

  beforeEach(() => {
    failures = signal([clock]);
    opened = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: { failures } },
        { provide: LayoutService, useValue: { openDocument: (tab: DocumentTab) => opened.push(tab) } }
      ]
    });
  });

  afterEach(async () => {
    await userEvent.unhover(document.body);
    AppearanceFixture.reset();
  });

  async function renderAsync(): Promise<ComponentFixture<ModuleFailuresComponent>> {
    const fixture = TestBed.createComponent(ModuleFailuresComponent);
    await fixture.whenStable();
    return fixture;
  }

  function item(fixture: ComponentFixture<ModuleFailuresComponent>): HTMLButtonElement {
    return DomFixture.oneOf(DomFixture.host(fixture), "button.nol-module-failures-item", HTMLButtonElement);
  }

  it("shows nothing while every module started", async () => {
    failures.set([]);

    const fixture = await renderAsync();

    expect(DomFixture.host(fixture).textContent).toBe(String.empty);
  });

  it("counts the modules that didn't start, with an error icon and text", async () => {
    const fixture = await renderAsync();
    const one = item(fixture).textContent;
    failures.set([clock, notes]);
    await fixture.whenStable();

    expect(one).toMatch(/^\s*error\s*1 module didn't start\s*$/);
    expect(item(fixture).textContent).toMatch(/^\s*error\s*2 modules didn't start\s*$/);
    expect(item(fixture).hasAttribute("aria-haspopup")).toBe(false);
  });

  it("opens the Modules document with the first module that didn't start selected", async () => {
    failures.set([notes, clock]);
    const fixture = await renderAsync();

    item(fixture).click();

    expect(opened).toEqual([ShellDocuments.modulesTab]);
    expect(TestBed.inject(ModuleSelectionService).selected()).toBe("notes");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and geometry from the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        const fixture = await renderAsync();
        const away = document.body.appendChild(document.createElement("div"));
        Object.assign(away.style, { position: "fixed", right: "0", bottom: "0", width: "40px", height: "40px" });
        await userEvent.hover(away);
        away.remove();

        const itemStyle = getComputedStyle(item(fixture));
        const icon = getComputedStyle(DomFixture.oneOf(item(fixture), ".nol-module-failures-icon", Element));
        const resting = itemStyle.backgroundColor;
        await userEvent.hover(item(fixture));
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
