/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, type Signal, computed, inject, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type {} from "@vitest/browser-playwright";

import { AppearanceService, DefaultTheme, ModePreference, ThemeMode, Typography } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { TabGroupComponent } from "../../../../src/app/components/tab-group/tab-group.component";
import { WindowRowComponent } from "../../../../src/app/components/window-row/window-row.component";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { BuildTokens } from "../../../../src/app/models/build-tokens";
import type { GroupFrame } from "../../../../src/app/models/layout/group-frame";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { SearchService } from "../../../../src/app/services/search.service";
import { WindowRowTabsService } from "../../../../src/app/services/window-row-tabs.service";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";

@Component({
  imports: [WindowRowComponent, TabGroupComponent],
  template: `
    <nol-window-row />
    <div class="workspace">
      @for (frame of frames(); track frame.group.id) {
        <nol-tab-group [frame]="frame" />
      }
    </div>
  `,
  styles: ["nol-window-row { width: 1600px; } .workspace { position: relative; width: 1600px; height: 800px; }"]
})
class WindowHostComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  public readonly frames: Signal<readonly GroupFrame[]> = computed(() => this.layout.geometry().frames);
}

describe("The document tabs in the window row", () => {
  const registry = LayoutFixture.createRegistry();
  const prepared = Layout.createDefault(registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo);
  let fixture: ComponentFixture<WindowHostComponent>;
  let layout: LayoutService;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: SearchService, useValue: { placeholder: signal("Search commands and settings") } }] });
  });

  afterEach(() => {
    AppearanceFixture.reset();
    PreloadBridgeFixture.remove();
  });

  function useDocumentTabs(documentTabs: boolean): void {
    TestBed.configureTestingModule({ providers: [{ provide: BuildTokens.titleBar, useValue: { name: null, icon: null, documentTabs } }] });
  }

  async function renderAsync(platform: string, initial: Layout = prepared, mode: ThemeMode = ThemeMode.Light): Promise<void> {
    PreloadBridgeFixture.install(platform);
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const appearance = TestBed.inject(AppearanceService);
    appearance.setTheme(DefaultTheme.theme);
    appearance.setModePreference(mode === ThemeMode.Dark ? ModePreference.Dark : ModePreference.Light);
    appearance.setTypography(new Typography());
    layout = await LayoutServiceFixture.prepareAsync(registry, initial);
    fixture = TestBed.createComponent(WindowHostComponent);
    host = DomFixture.host(fixture);
    await settleAsync();
    await settleAsync();
  }

  async function settleAsync(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function row(): HTMLElement {
    return DomFixture.one(host, "nol-window-row");
  }

  function group(id: number): HTMLElement {
    return DomFixture.one(host, `nol-tab-group[data-group="${id}"]`);
  }

  function keysIn(root: Element): (string | null)[] {
    return [...root.querySelectorAll("nol-tab")].map(t => t.getAttribute("data-tab-key"));
  }

  it("leaves the tabs in their group and the row without a tab row when the app doesn't ask for them", async () => {
    await renderAsync("win32");
    const first = layout.layout().documentGroups[0]?.id ?? -1;

    expect([row().querySelector(".nol-window-row-tabs"), row().classList.contains("nol-window-row-with-tabs"), TestBed.inject(WindowRowTabsService).groupId()]).toEqual([null, false, null]);
    expect(keysIn(group(first))).toEqual([LayoutFixture.plan.key, LayoutFixture.todo.key]);
  });

  for (const platform of ["win32", "darwin", "linux"])
    for (const mode of AppearanceFixture.modes)
      it(`puts the top-start group's tabs in the row after its buttons and the search field after them, on the row's color, on ${platform} in ${mode} mode`, async () => {
        useDocumentTabs(true);
        await renderAsync(platform, prepared, mode);
        const first = layout.layout().documentGroups[0]?.id ?? -1;
        const tabs = DomFixture.one(row(), ".nol-window-row-tabs");
        const strip = DomFixture.one(tabs, ".nol-tab-group-tabs").getBoundingClientRect();
        const start = DomFixture.one(row(), ".nol-window-row-start").getBoundingClientRect();
        const search = DomFixture.one(row(), ".nol-window-row-search").getBoundingClientRect();
        const box = row().getBoundingClientRect();

        expect([keysIn(tabs), keysIn(group(first)), group(first).querySelector(".nol-tab-group-tabs")]).toEqual([[LayoutFixture.plan.key, LayoutFixture.todo.key], [], null]);
        expect(strip.left).toBeGreaterThanOrEqual(start.right - 0.5);
        expect(search.left).toBeGreaterThanOrEqual(strip.right + AppearanceFixture.toPixels(6) - 0.5);
        expect(search.width).toBeGreaterThanOrEqual(AppearanceFixture.toPixels(12) - 0.5);
        expect([strip.top, strip.bottom]).toEqual([box.top, box.bottom]);
        for (const tab of tabs.querySelectorAll("nol-tab"))
          expect(tab.getBoundingClientRect().height).toBeLessThanOrEqual(box.height);
        expect(getComputedStyle(DomFixture.one(tabs, ".nol-tab-group-actions")).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "title-bar"));
      });

  for (const platform of ["win32", "darwin", "linux"])
    it(`narrows the search field to its 12rem before the tabs give up any width, in a row too narrow for both at full width, on ${platform}`, async () => {
      useDocumentTabs(true);
      await renderAsync(platform);
      const tabs = DomFixture.one(row(), ".nol-window-row-tabs");
      const strip = DomFixture.one(tabs, ".nol-tab-group-tabs");
      const actions = DomFixture.one(tabs, ".nol-tab-group-actions");
      const lastTab = (): DOMRect => [...tabs.querySelectorAll("nol-tab")].at(-1)?.getBoundingClientRect() ?? strip.getBoundingClientRect();
      const tabsWidth = lastTab().right - strip.getBoundingClientRect().left + actions.getBoundingClientRect().width;
      const startEnd = DomFixture.one(row(), ".nol-window-row-start").getBoundingClientRect().right - row().getBoundingClientRect().left;
      row().style.width = `${startEnd + tabsWidth + AppearanceFixture.toPixels(6 + 20)}px`;
      await settleAsync();

      const search = DomFixture.one(row(), ".nol-window-row-search").getBoundingClientRect();
      expect(search.width).toBeLessThan(AppearanceFixture.toPixels(27.5) - 0.5);
      expect(search.width).toBeGreaterThanOrEqual(AppearanceFixture.toPixels(12) - 0.5);
      expect(lastTab().right).toBeLessThanOrEqual(actions.getBoundingClientRect().left + 0.5);
      expect(actions.getBoundingClientRect().right).toBeLessThanOrEqual(tabs.getBoundingClientRect().right + 0.5);
      expect(search.left).toBeGreaterThanOrEqual(tabs.getBoundingClientRect().right + AppearanceFixture.toPixels(6) - 0.5);
    });

  it("keeps the row a drag region around the tabs and takes only the tabs and the buttons out of it", async () => {
    useDocumentTabs(true);
    await renderAsync("win32");
    const tabs = DomFixture.one(row(), ".nol-window-row-tabs");
    const controls = [...tabs.querySelectorAll<HTMLElement>("nol-tab, button")];

    expect(getComputedStyle(row()).getPropertyValue("app-region")).toBe("drag");
    expect([tabs, DomFixture.one(tabs, ".nol-tab-group-tabs")].map(t => getComputedStyle(t).getPropertyValue("app-region"))).not.toContain("no-drag");
    expect(controls.length).toBeGreaterThan(2);
    expect(controls.map(t => getComputedStyle(t).getPropertyValue("app-region"))).toEqual(Array<string>(controls.length).fill("no-drag"));
  });

  it("selects a tab clicked in the row and focuses its group", async () => {
    useDocumentTabs(true);
    await renderAsync("win32", prepared.openView(LayoutFixture.search, registry));
    const first = layout.layout().documentGroups[0]?.id ?? -1;
    const plan = DomFixture.one(row(), `nol-tab[data-tab-key="${LayoutFixture.plan.key}"]`);

    plan.click();
    await settleAsync();

    expect([layout.layout().group(first)?.active?.key, layout.currentGroup().id]).toEqual([LayoutFixture.plan.key, first]);
  });

  it("leaves every other document group its own tab row", async () => {
    useDocumentTabs(true);
    await renderAsync("win32", prepared.splitGroup(LayoutFixture.todo, prepared.documents.id, PanelEdge.Right));
    const [first, second] = layout.layout().documentGroups.map(t => t.id);

    expect(keysIn(DomFixture.one(row(), ".nol-window-row-tabs"))).toEqual([LayoutFixture.plan.key]);
    expect(keysIn(group(second ?? -1))).toEqual([LayoutFixture.todo.key]);
    expect(group(first ?? -1).querySelector(".nol-tab-group-tabs")).toBeNull();
  });

  it("moves the row's tabs to the next group in reading order once the top-start group closes, and gives that group's row back", async () => {
    useDocumentTabs(true);
    await renderAsync("win32", prepared.splitGroup(LayoutFixture.todo, prepared.documents.id, PanelEdge.Right));
    const [first, second] = layout.layout().documentGroups.map(t => t.id);

    layout.close(LayoutFixture.plan);
    await settleAsync();

    expect([layout.layout().group(first ?? -1), layout.layout().documentGroups[0]?.id]).toEqual([null, second]);
    expect(keysIn(DomFixture.one(row(), ".nol-window-row-tabs"))).toEqual([LayoutFixture.todo.key]);
    expect(group(second ?? -1).querySelector(".nol-tab-group-tabs")).toBeNull();
  });
});
