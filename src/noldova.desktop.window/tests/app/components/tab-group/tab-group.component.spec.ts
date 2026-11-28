/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, type Signal, computed, inject } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type {} from "@vitest/browser-playwright";
import { userEvent } from "vitest/browser";

import { TooltipDirective } from "@noldova/ui.components.angular";

import { FieldMenuComponent } from "../../../../src/app/components/field-menu/field-menu.component";
import { TabGroupComponent } from "../../../../src/app/components/tab-group/tab-group.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { DocumentTone } from "../../../../src/app/enums/document-tone";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { DocumentLook } from "../../../../src/app/models/document-look";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import type { GroupFrame } from "../../../../src/app/models/layout/group-frame";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { Tab } from "../../../../src/app/models/layout/tab";
import { TabDropTarget } from "../../../../src/app/models/layout/tab-drop-target";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewType } from "../../../../src/app/models/layout/view-type";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { TabLabelService } from "../../../../src/app/services/tab-label.service";
import { TabRenameService } from "../../../../src/app/services/tab-rename.service";
import { TabDragService } from "../../../../src/app/services/tab-drag.service";
import { TabStripService } from "../../../../src/app/services/tab-strip.service";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { MediaFixture } from "../../../fixtures/media.fixture";
import { TooltipFixture } from "../../../fixtures/tooltip.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

@Component({
  imports: [TabGroupComponent],
  template: `
    <div class="workspace">
      @for (frame of frames(); track frame.group.id) {
        <nol-tab-group [frame]="frame" />
      }
    </div>
  `,
  styles: [".workspace { position: relative; width: 1920px; height: 960px; }"]
})
class TabGroupHostComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  public readonly frames: Signal<readonly GroupFrame[]> = computed(() => this.layout.geometry().frames);
}

describe("TabGroupComponent", () => {
  let bridge: PreloadBridgeFixture;

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
  });

  afterEach(() => {
    PreloadBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  const revealTolerance = 4 / 64;
  const forcedColorsFeature = "forced-colors";
  const playwrightMedia: readonly (readonly [string, string])[] = [["prefers-color-scheme", "light"], ["prefers-reduced-motion", "no-preference"],
    ["prefers-contrast", "no-preference"], [forcedColorsFeature, "none"]];
  const prepared = Layout.createDefault(registry).openView(LayoutFixture.search, registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo);
  let fixture: ComponentFixture<TabGroupHostComponent>;
  let layout: LayoutService;
  let host: HTMLElement;

  async function renderAsync(initial: Layout = prepared, width: number = 120, chosen: ViewRegistry = registry): Promise<void> {
    layout = await LayoutServiceFixture.prepareAsync(chosen, initial, width);
    fixture = TestBed.createComponent(TabGroupHostComponent);
    host = DomFixture.host(fixture);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function group(id: number): HTMLElement {
    const found = host.querySelector<HTMLElement>(`nol-tab-group[data-group="${id}"]`);
    if (Object.isNull(found))
      throw new Error(`No group ${id} is shown.`);
    return found;
  }

  function tabs(id: number): HTMLElement[] {
    return [...group(id).querySelectorAll<HTMLElement>("nol-tab")];
  }

  function tab(id: number, index: number): HTMLElement {
    const found = tabs(id)[index];
    if (Object.isUndefined(found))
      throw new Error(`Group ${id} has no tab ${index}.`);
    return found;
  }

  function update(): void {
    fixture.detectChanges();
  }

  function emulateForcedColorsAsync(forcedColors: string): Promise<void> {
    return emulateMediaAsync(forcedColorsFeature, forcedColors);
  }

  function emulateMediaAsync(feature: string, setting: string): Promise<void> {
    return MediaFixture.emulateAsync(playwrightMedia.map(([name, value]) => [name, name === feature ? setting : value]));
  }

  function isWhole(target: HTMLElement): boolean {
    const scroller = DomFixture.closest(target, ".nol-tab-group-scroller");
    const actions = find(scroller, ":scope > .nol-tab-group-actions").getBoundingClientRect();
    const [box, row] = [target.getBoundingClientRect(), scroller.getBoundingClientRect()];
    const padding = Number.parseFloat(getComputedStyle(scroller).paddingInlineStart);
    const [start, end] = getComputedStyle(scroller).direction === "rtl" ? [actions.right, row.right - padding] : [row.left + padding, actions.left];
    return box.left >= start - 0.5 && box.right <= end + 0.5;
  }

  function surroundingsOf(row: HTMLElement): string {
    const places: string[] = [];
    for (let around = row.parentElement; !Object.isNull(around); around = around.parentElement) {
      const box = around.getBoundingClientRect();
      places.push([around.tagName, around.scrollLeft, around.scrollTop, box.x, box.y, box.width, box.height].join(" "));
    }
    return places.join("\n");
  }

  function find(root: Element, selector: string): HTMLElement {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing in ${root.tagName.toLowerCase()} matches ${selector}.`);
    return found;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelector(".cdk-overlay-container")?.replaceChildren();
    document.documentElement.removeAttribute("dir");
    AppearanceFixture.reset();
  });

  it("shows each group as a card at its frame with its tabs, the selected one and the right surface", async () => {
    await renderAsync();
    const left = layout.geometry().frameOf(1);

    expect(group(1).style.left).toBe(`${left?.bounds.x}rem`);
    expect(group(1).style.width).toBe(`${left?.bounds.width}rem`);
    expect(group(1).dataset["side"]).toBe(DockSide.Left);
    expect(group(1).querySelector("nol-panel-card")?.classList.contains("nol-panel-card-shell")).toBe(true);
    expect(group(0).querySelector("nol-panel-card")?.classList.contains("nol-panel-card-shell")).toBe(false);
    expect(group(0).querySelector<HTMLElement>("nol-panel-card")?.dataset["dropGroup"]).toBe("0");
    expect(tabs(1).map(t => t.textContent?.trim())).toEqual(["files.treeclose", "files.searchclose"].map(t => `web_asset${t}`));
    expect(tabs(1).map(t => t.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    expect(tabs(1).map(t => t.getAttribute("aria-label"))).toEqual(["files.tree", "files.search"]);
    expect(group(1).querySelector(".nol-tab-group-actions")?.classList.contains("nol-tab-group-actions-shell")).toBe(true);
    expect(group(0).querySelector(".nol-tab-group-actions")?.classList.contains("nol-tab-group-actions-shell")).toBe(false);
    expect(tabs(0).map(t => t.dataset["tabKey"])).toEqual([LayoutFixture.plan.key, LayoutFixture.todo.key]);
    const panel = group(1).querySelector<HTMLElement>("[role=tabpanel]");
    expect(tabs(1).map(t => t.id)).toEqual(["nol-tab-1-0", "nol-tab-1-1"]);
    expect([panel?.id, panel?.getAttribute("aria-labelledby")]).toEqual(["nol-tab-panel-1", "nol-tab-1-1"]);
    layout.closeTabs(layout.layout().documents.tabs);
    update();
    expect(group(0).querySelector("[role=tabpanel]")?.hasAttribute("aria-labelledby")).toBe(false);
  });

  function tabOf(key: string): HTMLElement {
    return find(host, `nol-tab[data-tab-key="${key}"]`);
  }

  function rem(): number {
    return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  function colorOf(within: HTMLElement, value: string): string {
    const probe = within.appendChild(document.createElement("span"));
    try {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    }
    finally {
      probe.remove();
    }
  }

  function lengthOf(within: HTMLElement, value: string): number {
    const probe = within.appendChild(document.createElement("span"));
    try {
      probe.style.display = "block";
      probe.style.width = value;
      return probe.getBoundingClientRect().width;
    }
    finally {
      probe.remove();
    }
  }

  function showLooks(): void {
    const labels = TestBed.inject(TabLabelService);
    const older = { image: "data:image/png;base64,iVBORw0KGgo=", imageGlyph: "public", marker: { glyph: "subdirectory_arrow_right", label: "Opened from Todo" }, underline: "A teammate is using this page" };
    labels.setLook(LayoutFixture.plan, DocumentLook.none.updated(older));
    labels.setLook(LayoutFixture.todo, DocumentLook.none.updated({ status: { glyph: "error", description: "Can't reach this page", tone: DocumentTone.Failed } }));
    update();
  }

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      it(`draws a document tab's marker, image and status at the icon size and part gap and names each part, with no underline even from an older module, with the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        try {
          await renderAsync();
          showLooks();
          const plan = tabOf(LayoutFixture.plan.key);
          const todo = tabOf(LayoutFixture.todo.key);
          const marker = find(plan, ".nol-tab-marker").getBoundingClientRect();
          const image = find(plan, ".nol-tab-image").getBoundingClientRect();
          const planLabel = find(plan, ".nol-tab-label").getBoundingClientRect();
          const status = find(todo, ".nol-tab-status");
          const statusBounds = status.getBoundingClientRect();
          const todoLabel = find(todo, ".nol-tab-label").getBoundingClientRect();
          const name = plan.getAttribute("aria-label") ?? String.empty;

          expect([marker.width, marker.height, image.width, image.height, statusBounds.width, statusBounds.height].map(t => t / rem())).toEqual([0.875, 0.875, 0.875, 0.875, 0.875, 0.875]);
          expect([image.left - marker.right, planLabel.left - image.right, todoLabel.left - statusBounds.right].map(t => t / rem())).toEqual([0.375, 0.375, 0.375]);
          expect([image.top + image.height / 2 - (planLabel.top + planLabel.height / 2), statusBounds.top + statusBounds.height / 2 - (todoLabel.top + todoLabel.height / 2)]
            .every(t => Math.abs(t) <= 0.5)).toBe(true);
          expect([getComputedStyle(find(plan, ".nol-tab-pill")).boxShadow, getComputedStyle(find(todo, ".nol-tab-pill")).boxShadow]).toEqual(["none", "none"]);
          expect([(status.textContent ?? String.empty).trim(), status.getAttribute("data-nol-tone"), todo.getAttribute("aria-label")?.includes("Can't reach this page")]).toEqual(["error", "Failed", true]);
          expect([name.indexOf("Opened from Todo") > 0, name.includes("A teammate is using this page")]).toEqual([true, false]);
          expect([getComputedStyle(status).color, getComputedStyle(find(plan, ".nol-tab-marker")).color])
            .toEqual([colorOf(todo, "var(--nol-status-failed)"), colorOf(plan, "var(--nol-accent)")]);
          expect(colorOf(todo, "var(--nol-status-failed)")).not.toBe(getComputedStyle(find(todo, ".nol-tab-label")).color);
          await TooltipFixture.expectTooltipAsync(find(plan, ".nol-tab-marker"), "Opened from Todo");
        }
        finally {
          AppearanceFixture.reset();
        }
      });

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      it(`shows a working document's spinner before its title and keeps its Close, while a working view keeps its spinner at the end, with the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        try {
          await renderAsync();
          showLooks();
          const labels = TestBed.inject(TabLabelService);
          labels.setWorking(LayoutFixture.todo.key, true);
          labels.setWorking(LayoutFixture.search.key, true);
          update();
          const todo = tabOf(LayoutFixture.todo.key);
          const search = tabOf(LayoutFixture.search.key);
          const leading = find(todo, ".nol-tab-leading-spinner");
          const spinner = leading.getBoundingClientRect();
          const label = find(todo, ".nol-tab-label").getBoundingClientRect();
          const size = lengthOf(leading, "var(--nol-spinner)");
          const gap = Number.parseFloat(getComputedStyle(leading).marginInlineEnd);

          expect([spinner.width, spinner.height, label.left - spinner.right]).toEqual([size, size, gap]);
          expect([todo.querySelector(".nol-tab-status"), todo.querySelector(".nol-tab-spinner"), todo.querySelector(".nol-tab-close") instanceof HTMLButtonElement, todo.getAttribute("aria-busy")])
            .toEqual([null, null, true, "true"]);
          expect([search.querySelector(".nol-tab-leading-spinner"), search.querySelector(".nol-tab-action .nol-tab-spinner") instanceof HTMLElement]).toEqual([null, true]);
          await emulateMediaAsync("prefers-reduced-motion", "reduce");
          const ring = find(todo, ".nol-tab-leading-spinner .nol-spinner-ring");
          const still = getComputedStyle(ring);
          const progress = colorOf(ring, "var(--nol-progress)");

          expect([still.animationName, still.borderTopColor, still.borderInlineEndColor, ring.getBoundingClientRect().width / rem()]).toEqual(["none", progress, progress, 0.75]);
          expect(ring.getBoundingClientRect().left - spinner.left).toBe((size - ring.getBoundingClientRect().width) / 2);
        }
        finally {
          await emulateMediaAsync("prefers-reduced-motion", "no-preference");
          AppearanceFixture.reset();
        }
      });

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      it(`draws a document tab's marker and status in its text colour, its image's glyph in the image's place and no underline under forced colors, with the ${theme.id} theme in ${mode} mode`, async () => {
        AppearanceFixture.apply(theme, mode);
        await emulateForcedColorsAsync("active");
        try {
          await renderAsync();
          showLooks();
          const plan = tabOf(LayoutFixture.plan.key);
          const todo = tabOf(LayoutFixture.todo.key);
          const line = getComputedStyle(find(plan, ".nol-tab-pill"), "::after");
          const glyph = find(plan, ".nol-tab-image-glyph");

          expect([getComputedStyle(find(plan, ".nol-tab-marker")).color, getComputedStyle(find(todo, ".nol-tab-status")).color])
            .toEqual([getComputedStyle(find(plan, ".nol-tab-label")).color, getComputedStyle(find(todo, ".nol-tab-label")).color]);
          expect([(glyph.textContent ?? String.empty).trim(), getComputedStyle(glyph).visibility, line.content]).toEqual(["public", "visible", "none"]);
        }
        finally {
          await emulateForcedColorsAsync("none");
          AppearanceFixture.reset();
        }
      });

  for (const theme of AppearanceFixture.themes)
    it(`keeps a group's strip a tab high, its bar as high and its body where it was once its last tab closes, with the ${theme.id} theme`, async () => {
      AppearanceFixture.apply(theme);
      try {
        await renderAsync();
        const bounds = (): readonly number[] => {
          const strip = group(0).querySelector(".nol-tab-group-strip")?.getBoundingClientRect();
          const bar = group(0).querySelector(".nol-tab-group-bar")?.getBoundingClientRect();
          const body = group(0).querySelector(".nol-tab-group-body")?.getBoundingClientRect();
          return [strip?.height ?? Number.NaN, bar?.height ?? Number.NaN, body?.top ?? Number.NaN, body?.height ?? Number.NaN];
        };
        const before = bounds();
        const tabHeight = getComputedStyle(tab(0, 0)).minHeight;

        layout.closeTabs(layout.layout().documents.tabs);
        update();

        expect([tabs(0).length, ...bounds(), getComputedStyle(DomFixture.one(group(0), ".nol-tab-group-strip")).minHeight]).toEqual([0, ...before, tabHeight]);
      }
      finally {
        AppearanceFixture.reset();
      }
    });

  it("sets the first tab 0.25rem from its card's start and ends the last action's glyph where the page's content ends, in both directions, and lines a one-view header's title up with a tab's label", async () => {
    AppearanceFixture.apply();
    await renderAsync();
    const card = (id: number): DOMRect => {
      const element = group(id).querySelector("nol-panel-card");
      const bounds = element?.getBoundingClientRect() ?? new DOMRect();
      const border = element?.clientLeft ?? 0;
      return new DOMRect(bounds.left + border, bounds.top, bounds.width - border * 2, bounds.height);
    };
    const lastAction = (id: number): Element | undefined => [...group(id).querySelectorAll(".nol-tab-group-actions button .nol-icon-button-glyph")].at(-1);
    const insets = (): readonly [number, number] => {
      const isReversed = document.documentElement.dir === "rtl";
      const first = tab(1, 0).getBoundingClientRect();
      const last = lastAction(1)?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const frame = card(1);
      return isReversed ? [frame.right - first.right, last.left - frame.left] : [first.left - frame.left, frame.right - last.right];
    };
    const [firstTab, lastActionEnd] = insets();
    document.documentElement.dir = "rtl";
    const [firstTabReversed, lastActionEndReversed] = insets();
    document.documentElement.removeAttribute("dir");
    const start = (element: Element | null | undefined): number => element?.getBoundingClientRect().left ?? Number.NaN;
    const pill = tab(1, 0).querySelector(".nol-tab-pill");
    const label = start(pill) + Number.parseFloat(pill ? getComputedStyle(pill).paddingLeft : String.empty) - card(1).left;
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.leftDockStyle", value: "Icons", isSet: true });
    update();
    const title = group(1).querySelector<HTMLElement>(".nol-tab-group-title");
    const titleText = start(title) + Number.parseFloat(title ? getComputedStyle(title).paddingLeft : String.empty) - card(1).left;
    const headerActionEnd = card(1).right - (lastAction(1)?.getBoundingClientRect().right ?? Number.NaN);

    const content = AppearanceFixture.measureLook("tab-inset") * 3 + AppearanceFixture.measureLook("pill-padding");

    for (const inset of [firstTab, firstTabReversed])
      AppearanceFixture.expectPixels(inset, AppearanceFixture.toPixels(0.25));
    for (const inset of [lastActionEnd, lastActionEndReversed, headerActionEnd])
      AppearanceFixture.expectPixels(inset, content);
    AppearanceFixture.expectPixels(titleText, label);
  });

  for (const theme of AppearanceFixture.themes)
    for (const direction of ["ltr", "rtl"])
      it(`scrolls an overflowing row sideways to bring the chosen tab, last, first or in the middle, whole between the row's start and its actions, ${direction} with the ${theme.id} theme`, async () => {
        AppearanceFixture.apply(theme);
        document.documentElement.dir = direction;
        const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
        await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
        update();
        await fixture.whenStable();
        update();
        const scroller = find(group(0), ".nol-tab-group-scroller");
        const range = scroller.scrollWidth - scroller.clientWidth;
        const surroundings = surroundingsOf(scroller);
        const chooseAsync = async (index: number): Promise<number> => {
          const chosen = many[index];
          if (Object.isUndefined(chosen))
            throw new Error(`There is no note ${index}.`);
          layout.activate(chosen);
          update();
          await fixture.whenStable();
          update();
          expect(surroundingsOf(scroller)).toBe(surroundings);
          return Math.abs(scroller.scrollLeft);
        };

        expect([range > 0, scroller.offsetHeight - scroller.clientHeight, tab(0, 11).getAttribute("aria-selected")]).toEqual([true, 0, "true"]);
        await vi.waitFor(() => expect(Math.abs(scroller.scrollLeft)).toBeCloseTo(range, 0));
        expect(isWhole(tab(0, 11))).toBe(true);
        expect(await chooseAsync(0)).toBe(0);
        expect(isWhole(tab(0, 0))).toBe(true);
        const middle = await chooseAsync(6);
        expect([middle > 0, middle < range]).toEqual([true, true]);
        expect(isWhole(tab(0, 6))).toBe(true);
      });

  it("ends a header's title too long for its width with an ellipsis", async () => {
    AppearanceFixture.apply();
    await renderAsync();
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.leftDockStyle", value: "Icons", isSet: true });
    update();
    const title = DomFixture.one(group(1), ".nol-tab-group-title");
    title.style.maxWidth = "2.5rem";

    AppearanceFixture.expectTruncates(title);
  });

  it("draws a one-view header's title at the kit's emphasis weight", async () => {
    AppearanceFixture.apply();
    await renderAsync();
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.leftDockStyle", value: "Icons", isSet: true });
    update();
    const title = getComputedStyle(DomFixture.one(group(1), ".nol-tab-group-title"));

    expect(title.fontWeight).toBe(title.getPropertyValue("--nol-weight-emphasis").trim());
  });

  it("shows a tab's title below it only while its label is cut short", async () => {
    await renderAsync();
    const whole = tab(1, 1);
    const target = tab(1, 0);
    target.style.maxWidth = "3rem";
    const decided = vi.spyOn(fixture.debugElement.query(t => t.nativeElement === whole).injector.get(TooltipDirective), "isTruncatedOnly");

    const { fitting, cut } = await TooltipFixture.shieldAsync(async () => {
      whole.dispatchEvent(new PointerEvent("pointerenter"));
      await vi.waitFor(() => expect(decided).toHaveBeenCalledTimes(2));
      const shown = TooltipFixture.find("files.search");
      whole.dispatchEvent(new PointerEvent("pointerleave"));
      target.dispatchEvent(new PointerEvent("pointerenter"));
      await vi.waitFor(() => expect(TooltipFixture.find("files.tree")).toBeDefined());
      return { fitting: shown, cut: TooltipFixture.find("files.tree") };
    });

    expect(fitting).toBeUndefined();
    expect(cut?.getBoundingClientRect().top).toBeGreaterThan(target.getBoundingClientRect().bottom);
  });

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      for (const forcedColors of ["none", "active"])
        it(`ends a tab too wide for its group with an ellipsis, reaching from the row's start to its actions, its whole title on hover, with the ${theme.id} theme in ${mode} mode and forced colors ${forcedColors}`, async () => {
          const title = "Background tasks of every project and window";
          AppearanceFixture.apply(theme, mode);
          await emulateForcedColorsAsync(forcedColors);
          try {
            TestBed.inject(TabLabelService).setTitle(LayoutFixture.files, title);
            await renderAsync(Layout.createDefault(registry).resizeDock(DockSide.Left, 10));
            update();
            const target = tab(1, 0);
            const scroller = find(group(1), ".nol-tab-group-scroller");
            const actions = find(group(1), ".nol-tab-group-actions");

            const shown = await TooltipFixture.shieldAsync(async () => {
              target.dispatchEvent(new PointerEvent("pointerenter"));
              await vi.waitFor(() => expect(TooltipFixture.find(title)).toBeDefined());
              return TooltipFixture.find(title);
            });

            AppearanceFixture.expectTruncates(find(target, ".nol-tab-label"));
            AppearanceFixture.expectPixels(actions.getBoundingClientRect().left - target.getBoundingClientRect().right, 0);
            expect([scroller.scrollWidth - scroller.clientWidth, shown?.textContent?.trim()]).toEqual([0, title]);
          }
          finally {
            await emulateForcedColorsAsync("none");
          }
        });

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      for (const forcedColors of ["none", "active"])
        it(`folds the panel actions into the overflow list of an overflowing row in a 10rem dock, so its selected tab ends its title with an ellipsis after its first letters, clear of the actions, its whole title on hover, with the ${theme.id} theme in ${mode} mode and forced colors ${forcedColors}`, async () => {
          const title = "Background tasks of every project and window";
          AppearanceFixture.apply(theme, mode);
          await emulateForcedColorsAsync(forcedColors);
          try {
            TestBed.inject(TabLabelService).setTitle(LayoutFixture.search, title);
            await renderAsync(prepared.resizeDock(DockSide.Left, 10));
            update();
            await vi.waitFor(() => expect(group(1).querySelector(".nol-tab-group-overflow")).not.toBeNull());
            update();
            await fixture.whenStable();
            const target = tab(1, 1);
            const label = find(target, ".nol-tab-label");
            const actions = find(group(1), ".nol-tab-group-scroller > .nol-tab-group-actions");
            const probe = document.body.appendChild(document.createElement("span"));
            probe.style.font = getComputedStyle(label).font;
            probe.style.whiteSpace = "nowrap";
            probe.textContent = `${title.slice(0, 2)}…`;
            const least = probe.getBoundingClientRect().width;
            probe.remove();

            const shown = await TooltipFixture.shieldAsync(async () => {
              target.dispatchEvent(new PointerEvent("pointerenter"));
              await vi.waitFor(() => expect(TooltipFixture.find(title)).toBeDefined());
              return TooltipFixture.find(title);
            });

            expect([target.getAttribute("aria-selected"), group(1).querySelector(".nol-tab-group-menu"), !Object.isNull(group(1).querySelector(".nol-tab-group-hide")), shown?.textContent?.trim()])
              .toEqual(["true", null, true, title]);
            expect(label.getBoundingClientRect().width).toBeGreaterThanOrEqual(least);
            expect(target.getBoundingClientRect().right - actions.getBoundingClientRect().left).toBeLessThan(revealTolerance);
            AppearanceFixture.expectTruncates(label);
          }
          finally {
            await emulateForcedColorsAsync("none");
          }
        });

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      for (const forcedColors of ["none", "active"])
        it(`lays a thin thumb over an overflowing row's bottom edge, shown while the pointer is over the row and taking none of its height, and none on a row whose tabs fit, with the ${theme.id} theme in ${mode} mode and forced colors ${forcedColors}`, async () => {
          AppearanceFixture.apply(theme, mode);
          await emulateForcedColorsAsync(forcedColors);
          try {
            const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
            await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
            update();
            await fixture.whenStable();
            const fitting = find(group(1), ".nol-tab-group-scroller");
            const overflowing = find(group(0), ".nol-tab-group-scroller");
            const [bar, thumb] = [find(group(0), ".nol-tab-group-tabs"), find(group(0), ".nol-tab-group-thumb")];
            const probe = bar.appendChild(document.createElement("span"));
            probe.style.backgroundColor = forcedColors === "active" ? "CanvasText" : "var(--nol-scrollbar)";
            probe.style.forcedColorAdjust = "none";
            const shownColor = getComputedStyle(probe).backgroundColor;
            probe.remove();
            await userEvent.unhover(document.body);
            const away = getComputedStyle(thumb).backgroundColor;

            overflowing.scrollLeft = 0;
            overflowing.dispatchEvent(new WheelEvent("wheel", { deltaY: 80, bubbles: true, cancelable: true }));
            await userEvent.hover(find(group(0), ".nol-tab-group-scroller > .nol-tab-group-actions"));

            await vi.waitFor(() => expect(getComputedStyle(thumb).backgroundColor).toBe(shownColor));
            const [row, box] = [bar.getBoundingClientRect(), thumb.getBoundingClientRect()];
            expect([fitting.offsetHeight - fitting.clientHeight, overflowing.offsetHeight - overflowing.clientHeight, overflowing.scrollLeft, away, find(group(1), ".nol-tab-group-thumb").hidden])
              .toEqual([0, 0, 80, "rgba(0, 0, 0, 0)", true]);
            AppearanceFixture.expectPixels(row.height, find(group(1), ".nol-tab-group-tabs").getBoundingClientRect().height);
            AppearanceFixture.expectPixels(row.bottom - box.bottom, 0);
            AppearanceFixture.expectPixels(box.height, AppearanceFixture.toPixels(0.375));
            AppearanceFixture.expectPixels(box.width, overflowing.clientWidth * overflowing.clientWidth / overflowing.scrollWidth);
            AppearanceFixture.expectPixels(box.left - overflowing.getBoundingClientRect().left, 80 * overflowing.clientWidth / overflowing.scrollWidth);
          }
          finally {
            await userEvent.unhover(document.body);
            await emulateForcedColorsAsync("none");
          }
        });

  for (const theme of AppearanceFixture.themes)
    it(`scrolls a long selected tab that isn't first in an overflowing row into view whole, from the row's start to its actions, its title ending with an ellipsis, with the ${theme.id} theme`, async () => {
      AppearanceFixture.apply(theme);
      TestBed.inject(TabLabelService).setTitle(LayoutFixture.search, "Search across every file of every open project");
      await renderAsync(prepared.resizeDock(DockSide.Left, 10));
      update();
      const target = tab(1, 1);
      const scroller = find(group(1), ".nol-tab-group-scroller");
      const actions = find(group(1), ".nol-tab-group-actions");
      const start = scroller.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(scroller).paddingInlineStart);

      await vi.waitFor(() => expect(scroller.scrollLeft).toBeGreaterThan(0));
      expect([target.getAttribute("aria-selected"), scroller.scrollWidth > scroller.clientWidth]).toEqual(["true", true]);
      expect(Math.abs(target.getBoundingClientRect().left - start)).toBeLessThan(revealTolerance);
      expect(Math.abs(actions.getBoundingClientRect().left - target.getBoundingClientRect().right)).toBeLessThan(revealTolerance);
      AppearanceFixture.expectTruncates(find(target, ".nol-tab-label"));
    });

  it("shows a preview in italics with its description and keeps it on a double-click", async () => {
    await renderAsync(prepared.openDocument(LayoutFixture.settings, true));
    const preview = tabs(0)[2];

    expect(preview?.classList.contains("nol-tab-preview")).toBe(true);
    expect(preview?.getAttribute("aria-description")).toBe("Preview");
    expect(tab(0, 0).hasAttribute("aria-description")).toBe(false);
    preview?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    update();

    expect(layout.layout().documents.preview).toBeNull();
    expect(preview?.classList.contains("nol-tab-preview")).toBe(false);
  });

  describe("with a part that declares its notes and terminals renamable", () => {
    const renamable = new ViewRegistry([
      new ViewType("files.tree", DockSide.Left, true),
      new ViewType("files.search", DockSide.Left, false),
      new ViewType("git.changes", DockSide.Right, true),
      new ViewType("terminal.shell", DockSide.Bottom, false, true, null, true)
    ], ["notes.note", "desktop.settings"], new Map(), new Set(["notes.note"]));

    function strip(id: number): HTMLElement {
      return find(group(id), ".nol-tab-group-strip");
    }

    function field(target: HTMLElement): HTMLInputElement {
      const found = target.querySelector<HTMLInputElement>("input.nol-tab-field");
      if (Object.isNull(found))
        throw new Error("The tab shows no title field.");
      return found;
    }

    function textStart(element: HTMLElement): number {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft);
    }

    function expectSameBox(box: DOMRect, expected: DOMRect): void {
      AppearanceFixture.expectPixels(box.left, expected.left);
      AppearanceFixture.expectPixels(box.right, expected.right);
      AppearanceFixture.expectPixels(box.top, expected.top);
      AppearanceFixture.expectPixels(box.bottom, expected.bottom);
    }

    for (const theme of AppearanceFixture.themes)
      for (const mode of AppearanceFixture.modes)
        for (const forcedColors of ["none", "active"])
          it(`edits the title in a field on the label's own box, its text where the title's started, the tab keeping its size, with the ${theme.id} theme in ${mode} mode and forced colors ${forcedColors}`, async () => {
            AppearanceFixture.apply(theme, mode);
            await emulateForcedColorsAsync(forcedColors);
            try {
              TestBed.inject(TabLabelService).setTitle(LayoutFixture.plan, "Plan");
              await renderAsync(prepared, 120, renamable);
              update();
              const target = tab(0, 0);
              const label = find(target, ".nol-tab-label");
              const tabBefore = target.getBoundingClientRect();
              const labelBefore = label.getBoundingClientRect();
              const titleStart = textStart(label);
              TestBed.inject(TabRenameService).begin(LayoutFixture.plan);
              update();
              await fixture.whenStable();
              const input = field(target);

              expectSameBox(target.getBoundingClientRect(), tabBefore);
              expectSameBox(input.getBoundingClientRect(), labelBefore);
              AppearanceFixture.expectPixels(textStart(input), titleStart);
              expect([document.activeElement, input.value, input.selectionStart, input.selectionEnd]).toEqual([input, "Plan", 0, 4]);
            }
            finally {
              await emulateForcedColorsAsync("none");
            }
          });

    it("tells the part the title kept with Enter, nothing on Escape, gives the focus back to the tab, and starts no drag from a press in the field", async () => {
      await renderAsync(prepared, 120, renamable);
      const renames = TestBed.inject(TabRenameService);
      const heard: string[] = [];
      renames.onRenamed("notes.note", (instance, title) => heard.push(`${instance} ${title}`));
      const begin = vi.spyOn(TestBed.inject(TabDragService), "begin");
      const target = tab(0, 0);
      renames.begin(LayoutFixture.plan);
      update();
      await fixture.whenStable();
      field(target).dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button: 0, bubbles: true }));
      field(target).value = "  Roadmap ";
      field(target).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      update();
      await fixture.whenStable();
      const kept = [target.querySelector("input.nol-tab-field"), document.activeElement === target];
      renames.begin(LayoutFixture.plan);
      update();
      await fixture.whenStable();
      field(target).value = "Gone";
      field(target).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      update();
      await fixture.whenStable();

      expect([heard, kept, target.querySelector("input.nol-tab-field"), renames.editing(), begin.mock.calls.length]).toEqual([["plan Roadmap"], [null, true], null, null, 0]);
    });

    it("renames a renamable tab on a double-click, and still keeps a preview open", async () => {
      await renderAsync(prepared.openDocument(LayoutFixture.settings, true), 120, renamable);
      const renames = TestBed.inject(TabRenameService);
      tab(0, 0).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      const editing = renames.editing();
      renames.cancel();
      tabs(0)[2]?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      update();

      expect([editing, renames.editing(), layout.layout().documents.preview]).toEqual([LayoutFixture.plan, null, null]);
    });

    it("renames the active tab on F2 only where its part declares it renamable, and leaves F2 alone elsewhere", async () => {
      await renderAsync(prepared, 120, renamable);
      const renames = TestBed.inject(TabRenameService);
      const onNote = new KeyboardEvent("keydown", { key: "F2", bubbles: true, cancelable: true });
      const onView = new KeyboardEvent("keydown", { key: "F2", bubbles: true, cancelable: true });
      strip(0).dispatchEvent(onNote);
      const editing = renames.editing();
      renames.cancel();
      strip(1).dispatchEvent(onView);

      expect([editing, onNote.defaultPrevented, renames.editing(), onView.defaultPrevented]).toEqual([layout.layout().documents.active, true, null, false]);
      expect(editing).not.toBeNull();
    });

    it("ends the rename when its tab closes, tells the part nothing, and shows no field when the tab opens again", async () => {
      await renderAsync(prepared, 120, renamable);
      const renames = TestBed.inject(TabRenameService);
      const heard: string[] = [];
      renames.onRenamed("notes.note", (instance, title) => heard.push(`${instance} ${title}`));
      renames.begin(LayoutFixture.plan);
      update();
      await fixture.whenStable();
      layout.close(LayoutFixture.plan);
      update();
      await fixture.whenStable();
      const closed = renames.editing();
      layout.openDocument(LayoutFixture.plan);
      update();
      await fixture.whenStable();

      expect([closed, renames.editing(), group(0).querySelector("input.nol-tab-field"), heard]).toEqual([null, null, null, []]);
    });

    it("opens the field menu, not a tab menu, from a right-click in the title field, keeps the rename once it closes, and still opens a tab menu from another tab", async () => {
      const menu = (place: string): Element | null => document.querySelector(`.cdk-overlay-container nol-menu[data-place='${place}']`);
      await renderAsync(prepared, 120, renamable);
      const fieldMenu = TestBed.createComponent(FieldMenuComponent);
      document.body.append(host);
      const renames = TestBed.inject(TabRenameService);
      renames.begin(LayoutFixture.plan);
      update();
      await fixture.whenStable();
      const box = field(tab(0, 0)).getBoundingClientRect();
      const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
      const click = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: x, clientY: y });
      const settleAsync = async (): Promise<void> => {
        fieldMenu.detectChanges();
        update();
        await Promise.all([fieldMenu.whenStable(), fixture.whenStable()]);
        await new Promise(resolve => requestAnimationFrame(resolve));
      };
      field(tab(0, 0)).dispatchEvent(click);
      await settleAsync();
      bridge.publishFieldMenu({ x, y, isKeyboard: false, word: String.empty, suggestions: [] });
      await settleAsync();
      const inField = [!Object.isNull(menu("desktop.field")), menu("desktop.tab")];
      await userEvent.keyboard("{Escape}");
      await settleAsync();
      const afterMenu = [menu("desktop.field"), renames.editing(), document.activeElement === tab(0, 0).querySelector("input.nol-tab-field")];
      fieldMenu.destroy();
      tab(0, 1).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 10 }));
      update();
      await fixture.whenStable();
      host.remove();

      expect(inField).toEqual([true, null]);
      expect(afterMenu).toEqual([null, LayoutFixture.plan, true]);
      expect(Object.isNull(menu("desktop.tab"))).toBe(false);
    });
  });

  it("shows a tab marked as working busy with its spinner, before a document's title and at a view's end, and keeps a document's close button", async () => {
    TestBed.inject(TabLabelService).setWorking(LayoutFixture.plan.key, true);
    TestBed.inject(TabLabelService).setWorking(LayoutFixture.search.key, true);
    await renderAsync();
    const [documentTab, viewTab] = [tab(0, 0), tabOf(LayoutFixture.search.key)];

    expect([documentTab.getAttribute("aria-busy"), !Object.isNull(documentTab.querySelector(".nol-tab-leading-spinner")), documentTab.querySelector(".nol-tab-spinner"), !Object.isNull(documentTab.querySelector(".nol-tab-close"))])
      .toEqual(["true", true, null, true]);
    expect([viewTab.getAttribute("aria-busy"), viewTab.classList.contains("nol-tab-working"), !Object.isNull(viewTab.querySelector(".nol-tab-spinner"))]).toEqual(["true", true, true]);
    expect([tab(0, 1).hasAttribute("aria-busy"), tab(0, 1).querySelector(".nol-tab-leading-spinner"), tab(0, 1).querySelector(".nol-tab-spinner")]).toEqual([false, null, null]);
  });

  for (const theme of AppearanceFixture.themes)
    for (const mode of AppearanceFixture.modes)
      for (const forcedColors of ["none", "active"])
        it(`shows a tab marked as waiting, also while working, with a raised hand in a working tab's spinner place and size, Close on hover and focus, and its name saying it waits, with the ${theme.id} theme in ${mode} mode and forced colors ${forcedColors}`, async () => {
          AppearanceFixture.apply(theme, mode);
          await emulateForcedColorsAsync(forcedColors);
          try {
            const labels = TestBed.inject(TabLabelService);
            labels.setWorking(LayoutFixture.search.key, true);
            labels.setWorking(LayoutFixture.todo.key, true);
            labels.setWaiting(LayoutFixture.todo.key, true);
            await renderAsync();
            const working = tabOf(LayoutFixture.search.key);
            const waiting = tab(0, 1);
            const spinner = find(working, ".nol-tab-spinner").getBoundingClientRect();
            const glyph = find(waiting, ".nol-tab-waiting-glyph");
            const hand = glyph.getBoundingClientRect();
            const workingBox = working.getBoundingClientRect();
            const waitingBox = waiting.getBoundingClientRect();
            const shown = [getComputedStyle(glyph).visibility, getComputedStyle(find(waiting, ".nol-tab-close")).visibility];
            const revealed = ["Hover", "Focus"].map(t => {
              waiting.setAttribute("data-nol-state", t);
              const look = [getComputedStyle(glyph).visibility, getComputedStyle(find(waiting, ".nol-tab-close")).visibility];
              waiting.removeAttribute("data-nol-state");
              return look;
            });

            for (const [actual, expected] of [[hand.width, spinner.width], [hand.height, spinner.height], [waitingBox.right - hand.right, workingBox.right - spinner.right],
              [hand.top - waitingBox.top, spinner.top - workingBox.top]] as const)
              AppearanceFixture.expectPixels(actual, expected);
            expect([waiting.classList.contains("nol-tab-waiting"), waiting.hasAttribute("aria-busy"), waiting.querySelector(".nol-tab-spinner"), getComputedStyle(glyph).color])
              .toEqual([true, false, null, getComputedStyle(find(waiting, ".nol-tab-pill")).color]);
            expect(waiting.getAttribute("aria-label")).toBe(`${find(waiting, ".nol-tab-label").textContent?.trim()}, waiting for your answer`);
            expect([shown, revealed]).toEqual([["visible", "hidden"], [["hidden", "visible"], ["hidden", "visible"]]]);
            expect([working.getAttribute("aria-busy"), working.querySelector(".nol-tab-waiting-glyph")]).toEqual(["true", null]);
          }
          finally {
            await emulateForcedColorsAsync("none");
          }
        });

  it("shows a tab whose waiting mark is cleared as it was, working again where it still works", async () => {
    const labels = TestBed.inject(TabLabelService);
    labels.setWorking(LayoutFixture.todo.key, true);
    labels.setWaiting(LayoutFixture.todo.key, true);
    labels.setWaiting(LayoutFixture.plan.key, true);
    await renderAsync();

    labels.setWaiting(LayoutFixture.todo.key, false);
    labels.setWaiting(LayoutFixture.plan.key, false);
    update();
    const [plan, todo] = [tab(0, 0), tab(0, 1)];

    expect([plan.classList.contains("nol-tab-waiting"), plan.querySelector(".nol-tab-waiting-glyph"), plan.hasAttribute("aria-busy"), plan.getAttribute("aria-label")?.includes("waiting")])
      .toEqual([false, null, false, false]);
    expect([todo.classList.contains("nol-tab-waiting"), !Object.isNull(todo.querySelector(".nol-tab-leading-spinner")), todo.getAttribute("aria-busy")]).toEqual([false, true, "true"]);
  });

  it("activates a clicked tab, closes a tab with its close button and starts a drag from a tab", async () => {
    await renderAsync();
    const begin = vi.spyOn(TestBed.inject(TabDragService), "begin");

    tab(1, 0).click();
    update();
    expect(layout.layout().group(1)?.active).toEqual(LayoutFixture.files);

    tab(0, 1).querySelector<HTMLElement>(".nol-tab-close")?.click();
    update();
    expect(layout.layout().documents.tabs).toEqual([LayoutFixture.plan]);

    tab(1, 1).dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button: 0, bubbles: true }));
    expect(begin).toHaveBeenCalledWith(LayoutFixture.search, expect.any(PointerEvent));
  });

  it("moves focus to the tab that becomes active when the focused tab closes, and leaves focus in another group alone", async () => {
    await renderAsync();
    const key = (element: Element | null): string | undefined => element instanceof HTMLElement ? element.dataset["tabKey"] : undefined;
    const focused = tabs(0).find(t => t.getAttribute("aria-selected") === "true");
    focused?.focus();

    focused?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    update();
    await fixture.whenStable();

    expect(key(document.activeElement)).toBe(layout.layout().documents.active?.key);
    tab(1, 1).focus();
    tab(0, 0).querySelector<HTMLElement>(".nol-tab-close")?.click();
    update();
    await fixture.whenStable();
    expect(key(document.activeElement)).toBe(LayoutFixture.search.key);
  });

  it("moves focus to the current group's active tab when the focused tab was the last of its group", async () => {
    await renderAsync(prepared.splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom));
    const alone = [...document.querySelectorAll<HTMLElement>(`nol-tab[data-tab-key="${LayoutFixture.search.key}"]`)][0];
    alone?.focus();

    alone?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    update();
    await fixture.whenStable();

    expect(document.activeElement instanceof HTMLElement ? document.activeElement.dataset["tabKey"] : undefined).toBe(layout.currentGroup().active?.key);
  });

  it("marks where a dragged tab would land and dims the dragged tab", async () => {
    await renderAsync();
    let under: Element | null = null;
    vi.spyOn(document, "elementFromPoint").mockImplementation(() => under);
    tab(1, 0).dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 0, clientY: 0, bubbles: true }));
    under = tab(0, 1);
    const bounds = under.getBoundingClientRect();
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, clientX: bounds.left + 1, clientY: bounds.top + 1 }));
    update();

    expect(tab(0, 1).classList.contains("nol-drop-line-before")).toBe(true);
    expect(tab(1, 0).classList.contains("nol-tab-dragged")).toBe(true);

    under = group(0).querySelector(".nol-tab-group-end");
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, clientX: bounds.right + 40, clientY: bounds.top + 1 }));
    update();
    expect(group(0).querySelector(".nol-tab-group-end")?.classList.contains("nol-drop-line-before")).toBe(true);

    under = group(0).querySelector(".nol-tab-group-menu");
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, clientX: bounds.right + 60, clientY: bounds.top + 1 }));
    update();
    expect([group(0).querySelector(".nol-tab-group-end")?.classList.contains("nol-drop-line-before"), group(0).querySelector(".nol-tab-group-actions")?.classList.contains("nol-drop-line-before")])
      .toEqual([true, false]);
    expect(TestBed.inject(TabDragService).hoveredGroup()).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });

  it("marks the end of overflowing tabs at the start of the actions, which stay in view", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    vi.spyOn(document, "elementFromPoint").mockReturnValue(group(0).querySelector(".nol-tab-group-actions"));
    tab(0, 0).dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 0, clientY: 0, bubbles: true }));
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, clientX: 40, clientY: 40 }));
    update();

    expect([group(0).querySelector(".nol-tab-group-end")?.classList.contains("nol-drop-line-before"), group(0).querySelector(".nol-tab-group-actions")?.classList.contains("nol-drop-line-before")])
      .toEqual([false, true]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });

  it("hides its dock from the top-right group only", async () => {
    await renderAsync(prepared.splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom));
    const groups = layout.layout().dock(DockSide.Left).root?.groups.map(t => t.id) ?? [];
    const corner = layout.layout().dock(DockSide.Left).root?.cornerGroup.id;
    const other = groups.find(t => t !== corner) ?? -1;

    expect(group(other).querySelector(".nol-tab-group-hide")).toBeNull();
    expect(group(0).querySelector(".nol-tab-group-hide")).toBeNull();
    const hide = DomFixture.oneOf(group(corner ?? -1), ".nol-tab-group-hide", HTMLButtonElement);
    expect(hide.getAttribute("aria-label")).toBe("Hide the left dock");
    await TooltipFixture.expectTooltipAsync(hide, "Hide the left dock");
    hide.click();
    update();

    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(true);
  });

  it("shows a header with the active view's title and the group's actions instead of a tab bar, whatever its number of views, on a side set to icons", async () => {
    await renderAsync(prepared.splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom));
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.leftDockStyle", value: "Icons", isSet: true });
    update();
    const begin = vi.spyOn(TestBed.inject(TabDragService), "begin").mockImplementation(() => undefined);
    const corner = layout.layout().dock(DockSide.Left).root?.cornerGroup.id ?? -1;
    const title = group(corner).querySelector<HTMLElement>(".nol-tab-group-title");
    const body = group(corner).querySelector<HTMLElement>(".nol-tab-group-body");

    expect(group(corner).querySelector("[role=tablist]")).toBeNull();
    expect(title?.textContent?.trim()).toBe("files.tree");
    expect([body?.getAttribute("role"), body?.getAttribute("aria-labelledby")]).toEqual(["region", title?.id]);
    expect([group(corner).querySelector(".nol-tab-group-menu"), group(corner).querySelector(".nol-tab-group-hide")].every(t => !Object.isNull(t))).toBe(true);
    expect(group(layout.layout().dock(DockSide.Right).root?.cornerGroup.id ?? -1).querySelector("[role=tablist]")).not.toBeNull();
    title?.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1, button: 0 }));
    expect(begin).not.toHaveBeenCalled();

    layout.place(LayoutFixture.search, new TabDropTarget(corner, 1));
    update();
    const shared = group(corner).querySelector<HTMLElement>(".nol-tab-group-title");
    const sharedBody = group(corner).querySelector<HTMLElement>(".nol-tab-group-body");
    expect(layout.layout().group(corner)?.tabs.length).toBe(2);
    expect([group(corner).querySelector("[role=tablist]"), group(corner).querySelectorAll("nol-tab").length]).toEqual([null, 0]);
    expect(shared?.textContent?.trim()).toBe("files.search");
    expect([sharedBody?.getAttribute("role"), sharedBody?.getAttribute("aria-labelledby")]).toEqual(["region", shared?.id]);
    expect([group(corner).querySelector(".nol-tab-group-menu"), group(corner).querySelector(".nol-tab-group-hide")].every(t => !Object.isNull(t))).toBe(true);

    layout.activate(LayoutFixture.files);
    update();
    expect(group(corner).querySelector(".nol-tab-group-title")?.textContent?.trim()).toBe("files.tree");
  });

  it("takes a tab dropped on a header at the group's end and marks it at the start of the actions", async () => {
    await renderAsync(prepared.splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom));
    bridge.publishEvent("desktop.settingsChanged", { name: "desktop.leftDockStyle", value: "Icons", isSet: true });
    update();
    const drag = TestBed.inject(TabDragService);
    const corner = layout.layout().dock(DockSide.Left).root?.cornerGroup.id ?? -1;
    vi.spyOn(document, "elementFromPoint").mockReturnValue(group(corner).querySelector(".nol-tab-group-title"));
    drag.begin(LayoutFixture.search, new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 0, clientY: 0 }));
    document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, clientX: 40, clientY: 40 }));
    update();

    expect(group(corner).querySelector(".nol-tab-group-header .nol-tab-group-actions")?.classList.contains("nol-drop-line-before")).toBe(true);
    expect(drag.hoveredGroup()).toBeNull();
    document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    expect(layout.layout().group(corner)?.tabs).toEqual([LayoutFixture.files, LayoutFixture.search]);
  });

  it("gives the keyboard focus to a tab dropped in another group and to a tab reordered in its own", async () => {
    await renderAsync();
    const drag = TestBed.inject(TabDragService);
    const dropAsync = async (dragged: Tab, under: HTMLElement): Promise<string | null> => {
      const bounds = under.getBoundingClientRect();
      vi.spyOn(document, "elementFromPoint").mockReturnValue(under);
      drag.begin(dragged, new PointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 0, clientY: 0 }));
      document.dispatchEvent(new PointerEvent("pointermove", { pointerId: 1, buttons: 1, clientX: bounds.right - 1, clientY: bounds.top + 1 }));
      update();
      document.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
      update();
      await fixture.whenStable();
      return document.activeElement?.getAttribute("data-tab-key") ?? null;
    };

    const reordered = await dropAsync(LayoutFixture.plan, tab(0, 1));
    const reorderedTabs = layout.layout().documents.tabs;
    const moved = await dropAsync(LayoutFixture.search, tab(0, 0));

    expect([reordered, reorderedTabs]).toEqual([LayoutFixture.plan.key, [LayoutFixture.todo, LayoutFixture.plan]]);
    expect([moved, layout.layout().groupOf(LayoutFixture.search)?.isDocuments]).toEqual([LayoutFixture.search.key, true]);
  });

  it("opens the active tab's menu from the panel actions and a tab's menu from the keyboard", async () => {
    await renderAsync(prepared, 80);
    const actions = DomFixture.oneOf(group(0), ".nol-tab-group-menu", HTMLButtonElement);
    expect(actions.getAttribute("aria-label")).toBe("Panel actions");
    await TooltipFixture.expectTooltipAsync(actions, "Panel actions");
    actions.click();
    update();
    await fixture.whenStable();
    const menu = document.querySelector<HTMLElement>(".cdk-overlay-container nol-menu[data-place='desktop.tab']");
    expect(menu).not.toBeNull();
    expect(menu?.getBoundingClientRect().right).toBeCloseTo(actions.getBoundingClientRect().right, 0);
    expect(menu?.getBoundingClientRect().top).toBeGreaterThanOrEqual(actions.getBoundingClientRect().bottom);
    actions.click();
    update();
    await fixture.whenStable();
    expect(document.querySelector(".cdk-overlay-container nol-menu[data-place='desktop.tab']")).toBeNull();

    const key = new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true });
    tab(0, 0).dispatchEvent(key);
    update();
    await fixture.whenStable();
    const opened = document.querySelector<HTMLElement>(".cdk-overlay-container nol-menu[data-place='desktop.tab']");

    expect(key.defaultPrevented).toBe(true);
    expect(opened?.getBoundingClientRect().top).toBeGreaterThanOrEqual(tab(0, 0).getBoundingClientRect().bottom);
    expect(opened?.getBoundingClientRect().left).toBeCloseTo(tab(0, 0).getBoundingClientRect().left, 0);
    expect(document.activeElement?.textContent).toContain("Split");
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
    update();
    await fixture.whenStable();
    expect(document.querySelector(".cdk-overlay-container nol-menu[data-place='desktop.tab']")).toBeNull();
    expect(document.activeElement).toBe(tab(0, 0));
  });

  it("moves a view's tab to the documents from its menu's Move to and focuses it there", async () => {
    await renderAsync();
    const search = tabs(1).find(t => t.getAttribute("data-tab-key") === LayoutFixture.search.key);

    search?.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true }));
    update();
    await fixture.whenStable();
    const moveTo = document.querySelector<HTMLButtonElement>(".cdk-overlay-container nol-menu[data-place='desktop.tab'] button[data-submenu='desktop.tabMoveTo']");
    const icon = moveTo?.querySelector(".nol-menu-item-icon")?.textContent;
    moveTo?.click();
    update();
    await fixture.whenStable();
    const destinations = [...document.querySelectorAll<HTMLButtonElement>(".cdk-overlay-container nol-menu[data-place='desktop.tabMoveTo'] button[nol-menu-item]")];
    destinations.at(-1)?.click();
    update();
    await fixture.whenStable();

    expect(icon).toBe("drive_file_move");
    expect(destinations.map(t => t.querySelector(".nol-menu-item-label")?.textContent)).toEqual([LayoutFixture.changes.name, "Documents"]);
    expect(layout.layout().groupOf(LayoutFixture.search)?.isDocuments).toBe(true);
    expect(document.activeElement?.getAttribute("data-tab-key")).toBe(LayoutFixture.search.key);
  });

  it("moves between tabs with the arrow keys, Home and End, and leaves an arrow with Ctrl, Cmd or Option to the commands", async () => {
    await renderAsync(prepared.openDocument(LayoutFixture.settings));
    const press = (key: string, modifiers: KeyboardEventInit = {}): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers });
      tab(0, 0).dispatchEvent(event);
      update();
      return event;
    };

    expect(press("ArrowRight").defaultPrevented).toBe(true);
    expect(layout.layout().documents.active).toEqual(LayoutFixture.plan);
    press("ArrowLeft");
    expect(layout.layout().documents.active).toEqual(LayoutFixture.settings);
    expect(document.activeElement).toBe(tab(0, 2));
    press("Home");
    expect(layout.layout().documents.active).toEqual(LayoutFixture.plan);
    press("End");
    expect(layout.layout().documents.active).toEqual(LayoutFixture.settings);
    expect(press("a").defaultPrevented).toBe(false);
    expect([{ ctrlKey: true }, { metaKey: true, altKey: true }, { altKey: true }].map(t => press("ArrowRight", t).defaultPrevented)).toEqual([false, false, false]);
    expect(layout.layout().documents.active).toEqual(LayoutFixture.settings);
  });

  it("scrolls the active tab into view and offers the overflow list, listing every tab, whose chosen tab scrolls into view whole and takes the focus", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();

    const scroller = find(group(0), ".nol-tab-group-scroller");
    await vi.waitFor(() => expect(scroller.scrollLeft).toBeCloseTo(scroller.scrollWidth - scroller.clientWidth, 0));
    const surroundings = surroundingsOf(scroller);
    expect(group(1).querySelector(".nol-tab-group-overflow")).toBeNull();
    const overflow = DomFixture.oneOf(group(0), ".nol-tab-group-overflow", HTMLButtonElement);
    expect(overflow.getAttribute("aria-label")).toBe("Show all tabs");
    await TooltipFixture.expectTooltipAsync(overflow, "Show all tabs");
    overflow.click();
    update();
    await fixture.whenStable();
    const choices = [...document.querySelectorAll<HTMLButtonElement>(".cdk-overlay-container .nol-tab-group-overflow-tab")];
    const list = document.querySelector<HTMLElement>(".cdk-overlay-container .nol-tab-group-overflow-menu");
    expect(choices.map(t => t.querySelector(".nol-menu-item-label")?.textContent)).toEqual(many.map(t => t.instance));
    expect(choices.map(t => t.getAttribute("aria-current"))).toEqual(many.map((_, index) => index === many.length - 1 ? "true" : null));
    expect([...list?.querySelectorAll(":scope > button, :scope > nol-menu-separator") ?? []].slice(0, 4)
      .map(t => ["nol-tab-group-overflow-actions", "nol-tab-group-overflow-close-all"].find(c => t.classList.contains(c)) ?? t.tagName))
      .toEqual(["nol-tab-group-overflow-actions", "NOL-MENU-SEPARATOR", "nol-tab-group-overflow-close-all", "NOL-MENU-SEPARATOR"]);

    choices[0]?.click();
    update();
    await fixture.whenStable();

    expect(layout.layout().documents.active).toEqual(many[0]);
    await vi.waitFor(() => expect([document.activeElement === tab(0, 0), scroller.scrollLeft, isWhole(tab(0, 0))]).toEqual([true, 0, true]));
    expect(surroundingsOf(scroller)).toBe(surroundings);
  });

  it("moves along every tab with the arrow keys, Home and End, scrolling the tab reached into view whole and focusing it", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    const scroller = find(group(0), ".nol-tab-group-scroller");
    const range = scroller.scrollWidth - scroller.clientWidth;
    const pressAsync = async (key: string): Promise<void> => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      update();
      await fixture.whenStable();
    };

    tab(0, 11).focus();
    expect([range > 0, document.activeElement === tab(0, 11)]).toEqual([true, true]);
    const surroundings = surroundingsOf(scroller);
    for (const [key, index, scroll] of [["ArrowLeft", 10, null], ["ArrowLeft", 9, null], ["Home", 0, 0], ["End", 11, range], ["ArrowRight", 0, 0]] as const) {
      await pressAsync(key);
      expect(layout.layout().documents.active).toEqual(many[index]);
      await vi.waitFor(() => expect([document.activeElement === tab(0, index), isWhole(tab(0, index))]).toEqual([true, true]));
      if (!Object.isNull(scroll))
        expect(scroller.scrollLeft).toBeCloseTo(scroll, 0);
      expect(surroundingsOf(scroller), key).toBe(surroundings);
    }
  });

  it("caps the overflow list at 20 rows, each a menu item and the row gap tall, with the menu's padding and border", async () => {
    const many = Array.from({ length: 30 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    group(0).querySelector<HTMLButtonElement>(".nol-tab-group-overflow")?.click();
    update();
    await fixture.whenStable();
    const list = DomFixture.one(document, ".cdk-overlay-container .nol-tab-group-overflow-menu");
    list.style.setProperty("--nol-menu-item-height", "0.25rem");
    const heightOf = (value: string): number => {
      const probe = document.createElement("div");
      probe.style.height = value;
      list.append(probe);
      const height = probe.getBoundingClientRect().height;
      probe.remove();
      return height;
    };
    const style = getComputedStyle(list);
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const row = heightOf("var(--nol-menu-item-height)") + heightOf("var(--nol-row-gap)");
    const frame = 2 * (Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth));

    expect(heightOf("var(--nol-row-gap)") / rem).toBeCloseTo(0.25, 3);
    expect(20 * row + frame).toBeLessThan(innerHeight * 0.6);
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    expect(Math.abs(list.getBoundingClientRect().height - (20 * row + frame)) / rem).toBeLessThan(0.01);
  });

  it("leaves an overflowing row where the person scrolled it when a background tab closes by its close button, with the focus outside the row or on the active tab", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    const scroller = find(group(0), ".nol-tab-group-scroller");
    const closeFirstAsync = async (): Promise<number> => {
      scroller.scrollLeft = 0;
      tab(0, 0).querySelector<HTMLElement>(".nol-tab-close")?.click();
      update();
      await fixture.whenStable();
      update();
      return scroller.scrollLeft;
    };

    const outside = await closeFirstAsync();
    tabs(0).at(-1)?.focus();
    const inside = await closeFirstAsync();

    expect([outside, inside, tabs(0).length]).toEqual([0, 0, 10]);
    expect(document.activeElement).toBe(tabs(0).at(-1));
  });

  it("pins the actions at the strip's end and gives the tabs their width, so a tab is never wider than the room before them", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    const scroller = group(0).querySelector<HTMLElement>(".nol-tab-group-scroller") ?? host;
    const actions = group(0).querySelector<HTMLElement>(".nol-tab-group-actions") ?? host;

    expect(getComputedStyle(actions).position).toBe("sticky");
    expect(scroller.style.getPropertyValue("--nol-tab-group-actions-width")).toBe(`${actions.getBoundingClientRect().width}px`);
  });

  it("closes every tab of the group from the overflow list's Close all", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    group(0).querySelector<HTMLButtonElement>(".nol-tab-group-overflow")?.click();
    update();
    await fixture.whenStable();
    const closeAll = document.querySelector<HTMLButtonElement>(".cdk-overlay-container .nol-tab-group-overflow-close-all");
    expect(closeAll?.querySelector(".nol-menu-item-label")?.textContent).toBe("Close all");

    closeAll?.click();
    update();
    await fixture.whenStable();

    expect(layout.layout().documents.tabs).toEqual([]);
    expect(document.querySelector(".cdk-overlay-container nol-menu")).toBeNull();
  });

  it("moves focus to the current group's active tab when the overflow list's Close all closes the group", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    const split = prepared.splitGroup(LayoutFixture.todo, prepared.documents.id, PanelEdge.Right);
    await renderAsync(many.reduce((current, t) => current.openDocument(t, false, LayoutFixture.todo), split), 60);
    update();
    await fixture.whenStable();
    update();
    const closing = layout.layout().groupOf(LayoutFixture.todo)?.id ?? -1;
    tab(closing, 0).focus();
    group(closing).querySelector<HTMLButtonElement>(".nol-tab-group-overflow")?.click();
    update();
    await fixture.whenStable();

    document.querySelector<HTMLButtonElement>(".cdk-overlay-container .nol-tab-group-overflow-close-all")?.click();
    update();
    await fixture.whenStable();

    expect(layout.layout().group(closing)).toBeNull();
    expect(document.activeElement?.getAttribute("data-tab-key")).toBe(LayoutFixture.plan.key);
    expect(layout.currentGroup().active?.key).toBe(LayoutFixture.plan.key);
  });

  it("reports that its tabs overflow, opens its overflow list on request with the first row focused, and stops reporting once gone", async () => {
    const strips = TestBed.inject(TabStripService);
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    expect([strips.isOverflowing(0), strips.isOverflowing(1)]).toEqual([true, false]);

    strips.showList(0);
    update();
    await fixture.whenStable();

    expect(document.querySelector(".cdk-overlay-container .nol-tab-group-overflow-menu")).not.toBeNull();
    expect(document.activeElement?.classList.contains("nol-tab-group-overflow-actions")).toBe(true);
    expect(strips.takeListRequest(0)).toBe(false);
    fixture.destroy();
    expect(strips.isOverflowing(0)).toBe(false);
  });

  it("drops the overflow list, the scroll and the thumb once the group is wide enough", async () => {
    const many = Array.from({ length: 6 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    expect(group(0).querySelector(".nol-tab-group-overflow")).not.toBeNull();
    await vi.waitFor(() => expect(find(group(0), ".nol-tab-group-thumb").hidden).toBe(false));

    layout.setViewport(240, 60);
    update();
    await fixture.whenStable();
    update();

    expect(group(0).querySelector(".nol-tab-group-overflow")).toBeNull();
    await vi.waitFor(() => expect(find(group(0), ".nol-tab-group-thumb").hidden).toBe(true));
    const scroller = find(group(0), ".nol-tab-group-scroller");
    expect([tabs(0).length, scroller.scrollWidth <= scroller.clientWidth, scroller.scrollLeft]).toEqual([many.length, true, 0]);
    expect(tabs(0).filter(t => !isWhole(t))).toEqual([]);
  });
});
