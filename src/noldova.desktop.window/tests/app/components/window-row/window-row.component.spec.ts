/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Dialog } from "@angular/cdk/dialog";
import { Component, ErrorHandler, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type {} from "@vitest/browser-playwright";
import { userEvent } from "vitest/browser";

import { AppearanceService, DefaultTheme, DialogService, ModePreference, type Theme, ThemeMode, TooltipDirective, Typography } from "@noldova/ui.components.angular";
import { JsonReader, type JsonValue } from "@noldova/context.json";

import { WindowRowComponent } from "../../../../src/app/components/window-row/window-row.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { TopBarSide } from "../../../../src/app/enums/top-bar-side";
import { BuildTokens } from "../../../../src/app/models/build-tokens";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import { DocumentHeading } from "../../../../src/app/models/document-heading";
import { Layout } from "../../../../src/app/models/layout/layout";
import { TabDropTarget } from "../../../../src/app/models/layout/tab-drop-target";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewType } from "../../../../src/app/models/layout/view-type";
import { MenuDeclarations } from "../../../../src/app/models/menu-declarations";
import { ShellDocuments } from "../../../../src/app/models/shell-documents";
import { TopBarAction } from "../../../../src/app/models/top-bar-action";
import { TopBarActionContribution } from "../../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../../src/app/models/top-bar-action-state";
import { ViewPlace } from "../../../../src/app/models/view-place";
import { BarItemsService } from "../../../../src/app/services/bar-items.service";
import { CommandService } from "../../../../src/app/services/command.service";
import { DocumentHistoryService } from "../../../../src/app/services/document-history.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { MenuService } from "../../../../src/app/services/menu.service";
import { SearchPaletteService } from "../../../../src/app/services/search-palette.service";
import { SearchService } from "../../../../src/app/services/search.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { TabLabelService } from "../../../../src/app/services/tab-label.service";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { MediaFixture } from "../../../fixtures/media.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { TooltipFixture } from "../../../fixtures/tooltip.fixture";

@Component({
  template: `<button type="button" class="inside">Keep working</button>`
})
class OpenDialogComponent {
}

describe("WindowRowComponent", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: SearchService, useValue: { placeholder: signal("Search commands and settings") } }] });
  });

  afterEach(() => {
    AppearanceFixture.reset();
    PreloadBridgeFixture.remove();
  });

  function apply(theme: Theme = DefaultTheme.theme, mode: ThemeMode = ThemeMode.Light, panelSize?: number): void {
    AppearanceFixture.apply(theme, mode, panelSize);
    const appearance = TestBed.inject(AppearanceService);
    appearance.setTheme(theme);
    appearance.setModePreference(mode === ThemeMode.Dark ? ModePreference.Dark : ModePreference.Light);
    appearance.setTypography(new Typography(panelSize));
  }

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    return DomFixture.host(fixture);
  }

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`takes its colors and height from the ${theme.id} theme in ${mode} mode`, () => {
        PreloadBridgeFixture.install();
        apply(theme, mode);

        const style = getComputedStyle(render());

        expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "title-bar"));
        expect(style.color).toBe(AppearanceFixture.readColor(theme, mode, "title-bar-text"));
        AppearanceFixture.expectLook(style.height, theme, "window-row-height", "height");
      });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`puts a search field 27.5rem wide in the row's middle, as tall as its buttons and level with them, drawn as an input edged in the menu border color with the placeholder and an unedged Ctrl+K, in the ${theme.id} theme in ${mode} mode`, async () => {
        PreloadBridgeFixture.install("win32");
        apply(theme, mode);
        const fixture = TestBed.createComponent(WindowRowComponent);
        const row: HTMLElement = DomFixture.host(fixture);
        row.style.width = "1600px";
        fixture.detectChanges();
        await settle(fixture);
        const field = DomFixture.oneOf(row, ".nol-window-row-search", HTMLButtonElement);
        const box = field.getBoundingClientRect();
        const settings = DomFixture.one(row, ".nol-window-row-settings").getBoundingClientRect();
        const style = getComputedStyle(field);
        const glyph = DomFixture.one(field, ".nol-window-row-search-glyph");
        const key = DomFixture.one(field, ".nol-window-row-search-key");

        const parts = [".nol-window-row-search-glyph", ".nol-window-row-search-text", ".nol-window-row-search-key"].map(t => String(DomFixture.one(field, t).textContent).trim());
        expect([parts.join(" "), field.getAttribute("aria-keyshortcuts"), String(key.textContent)]).toEqual(["search Search commands and settings Ctrl+K", "Ctrl+K", "Ctrl+K"]);
        expect([glyph.getAttribute("aria-hidden"), style.getPropertyValue("app-region")]).toEqual(["true", "no-drag"]);
        AppearanceFixture.expectPixels(box.width, AppearanceFixture.toPixels(27.5));
        AppearanceFixture.expectPixels(box.height, settings.height);
        AppearanceFixture.expectPixels(box.top, settings.top);
        expect([style.backgroundColor, style.color]).toEqual([resolveColor("--nol-input"), resolveColor("--nol-text-muted")]);
        expect([style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor]).toEqual(Array<string>(4).fill(resolveColor("--nol-menu-border")));
        AppearanceFixture.expectLook(style.borderTopLeftRadius, theme, "radius-medium", "border-radius");
        const probe = row.appendChild(document.createElement("span"));
        probe.style.fontSize = "var(--nol-text-small)";
        const small = getComputedStyle(probe).fontSize;
        probe.remove();
        expect(style.fontSize).toBe(small);
        AppearanceFixture.expectLook(getComputedStyle(glyph).fontSize, theme, "quick-input-glyph", "font-size");
        AppearanceFixture.expectLook(getComputedStyle(key).fontSize, theme, "quick-input-key-text", "font-size");
        const keyStyle = getComputedStyle(key);
        expect([keyStyle.borderTopWidth, keyStyle.borderRightWidth, keyStyle.borderBottomWidth, keyStyle.borderLeftWidth]).toEqual(Array<string>(4).fill("0px"));
      });

  it("keeps the search field's box and place in the row with forced colors, its text and edge in the button text color and its key unedged", async () => {
    PreloadBridgeFixture.install("win32");
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    const row: HTMLElement = DomFixture.host(fixture);
    row.style.width = "1600px";
    fixture.detectChanges();
    await settle(fixture);
    const field = DomFixture.oneOf(row, ".nol-window-row-search", HTMLButtonElement);
    const key = DomFixture.one(field, ".nol-window-row-search-key");
    const before = field.getBoundingClientRect();
    await MediaFixture.forceColorsAsync("active");
    try {
      const box = field.getBoundingClientRect();
      const style = getComputedStyle(field);
      const probe = document.body.appendChild(document.createElement("span"));
      probe.style.color = "ButtonText";
      const buttonText = getComputedStyle(probe).color;
      probe.remove();

      expect(matchMedia("(forced-colors: active)").matches).toBe(true);
      expect([style.color, style.borderTopColor, style.borderRightColor, style.borderBottomColor, style.borderLeftColor]).toEqual(Array<string>(5).fill(buttonText));
      expect(getComputedStyle(key).borderTopWidth).toBe("0px");
      expect(["top", "right", "bottom", "left"].map(t => [style.getPropertyValue(`border-${t}-style`), Number.parseFloat(style.getPropertyValue(`border-${t}-width`))]))
        .toEqual(Array.from({ length: 4 }, () => ["solid", AppearanceFixture.measureLook("border-width")]));
      const pairs: [number, number][] = [[box.left, before.left], [box.top, before.top], [box.width, before.width], [box.height, before.height]];
      for (const [shown, kept] of pairs)
        AppearanceFixture.expectPixels(shown, kept);
    }
    finally {
      await MediaFixture.forceColorsAsync("none");
    }
  });

  it("shows the modules' top bar actions in order as icon buttons that run their commands, outside the drag region", async () => {
    const runs: JsonValue[] = [];
    const errors: unknown[] = [];
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    PreloadBridgeFixture.install("win32");
    apply();
    const action = (name: string, state: TopBarActionState): TopBarAction => new TopBarAction(new TopBarActionContribution(name, state), () => undefined);
    const compose = action("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote", { commandArguments: { title: "Plan" } }));
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("notes.newNote", "New note", null, null, async t => {
        runs.push(t);
        return null;
      }),
      new CommandContribution("notes.fail", "Fail", null, null, () => Promise.reject(new Error("The note was not created.")))
    ]);
    TestBed.inject(BarItemsService).set([], [
      compose,
      action("notes.print", new TopBarActionState("print", "Print", "notes.print")),
      action("notes.share", new TopBarActionState("share", "Share", "notes.newNote", { isHidden: true })),
      action("notes.broken", new TopBarActionState("error", "Broken", "notes.fail"))
    ]);

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    const buttons = [...DomFixture.host(fixture).querySelectorAll<HTMLButtonElement>("button.nol-window-row-action")];
    buttons[0]?.click();
    buttons[1]?.click();
    buttons[2]?.click();
    await fixture.whenStable();

    expect(buttons.map(t => [t.getAttribute("data-nol-item"), t.getAttribute("aria-label"), t.getAttribute("aria-disabled"), t.disabled])).toEqual([
      ["notes.compose", "New note", null, false], ["notes.print", "Print", "true", false], ["notes.broken", "Broken", null, false]
    ]);
    expect(getComputedStyle(buttons[0] ?? fixture.nativeElement).getPropertyValue("app-region")).toBe("no-drag");
    expect(runs).toEqual([{ title: "Plan" }]);
    expect(errors.map(t => String(t))).toEqual(["Error: The note was not created."]);
  });

  for (const mode of AppearanceFixture.modes)
    it(`keeps an unavailable top bar action in the tab order, marked unavailable and named by its reason, shows the reason below it on keyboard focus and runs nothing on a click, Enter or Space, in ${mode} mode`, async () => {
      const runs: JsonValue[] = [];
      const errors: unknown[] = [];
      TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
      PreloadBridgeFixture.install("win32");
      apply(DefaultTheme.theme, mode);
      const reason = "Open a note to print it";
      TestBed.inject(CommandService).setCommands([new CommandContribution("notes.print", "Print", null, null, async t => {
        runs.push(t);
        return null;
      }, () => false)]);
      TestBed.inject(BarItemsService).set([], [new TopBarAction(new TopBarActionContribution("notes.print", new TopBarActionState("print", reason, "notes.print")), () => undefined)]);
      const fixture = TestBed.createComponent(WindowRowComponent);
      fixture.detectChanges();
      const row: HTMLElement = DomFixture.host(fixture);
      const action = DomFixture.oneOf(row, "button.nol-window-row-action", HTMLButtonElement);
      DomFixture.oneOf(row, ".nol-window-row-search", HTMLButtonElement).focus();

      await userEvent.tab();
      await vi.waitFor(() => expect(TooltipFixture.find(reason)).toBeDefined());
      const tooltip = DomFixture.present(TooltipFixture.find(reason)).getBoundingClientRect();
      const box = action.getBoundingClientRect();
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard(" ");
      action.click();
      await fixture.whenStable();

      expect(document.activeElement).toBe(action);
      expect([action.disabled, action.getAttribute("aria-disabled"), action.getAttribute("aria-label"), action.getAttribute("aria-describedby")]).toEqual([false, "true", reason, null]);
      expect(getComputedStyle(action).opacity).toBe("0.5");
      expect(tooltip.top).toBeGreaterThanOrEqual(box.bottom);
      expect([runs, errors]).toEqual([[], []]);
    });

  it("opens search from the field", async () => {
    PreloadBridgeFixture.install("win32");
    apply();
    const run = vi.spyOn(TestBed.inject(CommandService), "runAsync").mockResolvedValue(null);
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    const row: HTMLElement = DomFixture.host(fixture);
    const field = DomFixture.oneOf(row, ".nol-window-row-search", HTMLButtonElement);
    field.click();
    await fixture.whenStable();

    expect(run.mock.calls).toEqual([["desktop.search", null]]);
    expect([row.querySelectorAll(".nol-window-row-actions button").length, getComputedStyle(field).opacity]).toEqual([0, "1"]);
  });

  it("hides the field while the search palette is shown over it, keeping its box and its focusability, so focus can come back to it", () => {
    PreloadBridgeFixture.install("win32");
    TestBed.configureTestingModule({ providers: [{ provide: SearchPaletteService, useValue: { isShown: signal(true) } }] });
    apply();

    const row = render();
    const field = DomFixture.one(row, ".nol-window-row-search");

    field.focus();

    expect([getComputedStyle(field).opacity, field.getBoundingClientRect().width > 0, document.activeElement === field]).toEqual(["0", true, true]);
  });

  it("is a drag region that leaves the native controls' space free on Windows", () => {
    PreloadBridgeFixture.install("win32");
    apply();

    const row = render();
    const style = getComputedStyle(row);

    expect(row.classList.contains("nol-window-row-mac")).toBe(false);
    expect(row.getAttribute("data-nol-chrome")).toBe("top");
    expect(style.getPropertyValue("app-region")).toBe("drag");
    expect(style.paddingLeft).toBe(`${AppearanceFixture.toPixels(0.25)}px`);
    expect(style.paddingRight).toBe("0px");
  });

  for (const platform of ["win32", "darwin"])
    it(`draws no window controls of its own on ${platform}, where the system draws them`, () => {
      PreloadBridgeFixture.install(platform);
      apply();

      const row = render();

      expect([row.querySelector("nol-window-controls"), row.classList.contains("nol-window-row-drawn-controls")]).toEqual([null, false]);
    });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`ends with its own minimize, maximize and close buttons on Linux, the row's full height, 2.8125rem wide and 0.0625rem apart, flush with the window's edge, in the ${theme.id} theme in ${mode} mode`, async () => {
        PreloadBridgeFixture.install("linux");
        apply(theme, mode);
        const fixture = TestBed.createComponent(WindowRowComponent);
        const row: HTMLElement = DomFixture.host(fixture);
        row.style.width = "1000px";
        fixture.detectChanges();
        await settle(fixture);
        const bounds = row.getBoundingClientRect();
        const controls = DomFixture.one(row, "nol-window-controls");
        const buttons = [...controls.querySelectorAll<HTMLButtonElement>("button")];
        const boxes = buttons.map(t => t.getBoundingClientRect());
        const glyphs = buttons.map(t => DomFixture.oneOf(t, "svg", SVGElement).getBoundingClientRect());
        const actions = DomFixture.one(row, ".nol-window-row-actions").getBoundingClientRect();

        expect(buttons.map(t => t.getAttribute("aria-label"))).toEqual(["Minimize", "Maximize", "Close"]);
        expect([controls.getAttribute("role"), controls.getAttribute("aria-label"), getComputedStyle(controls).getPropertyValue("app-region")]).toEqual(["group", "Window controls", "no-drag"]);
        expect(getComputedStyle(row).paddingRight).toBe("0px");
        for (const [index, box] of boxes.entries()) {
          const glyph = DomFixture.present(glyphs[index]);
          AppearanceFixture.expectPixels(box.width, AppearanceFixture.toPixels(2.8125));
          AppearanceFixture.expectPixels(box.top, bounds.top);
          AppearanceFixture.expectPixels(box.height, bounds.height);
          AppearanceFixture.expectPixels(glyph.width, AppearanceFixture.toPixels(0.625));
          AppearanceFixture.expectPixels(glyph.left + glyph.width / 2, box.left + box.width / 2);
          AppearanceFixture.expectPixels(glyph.top + glyph.height / 2, box.top + box.height / 2);
          if (index > 0)
            AppearanceFixture.expectPixels(box.left - DomFixture.present(boxes[index - 1]).right, AppearanceFixture.toPixels(0.0625));
        }
        AppearanceFixture.expectPixels(DomFixture.present(boxes.at(-1)).right, bounds.right);
        AppearanceFixture.expectPixels(DomFixture.present(boxes[0]).left, actions.right);
        expect(buttons.map(t => getComputedStyle(t).color)).toEqual(buttons.map(() => AppearanceFixture.readColor(theme, mode, "title-bar-text")));
      });

  for (const mode of AppearanceFixture.modes)
    it(`fills a hovered window control with the toolbar hover, and Close with the error color under its danger text, in ${mode} mode`, async () => {
      PreloadBridgeFixture.install("linux");
      apply(DefaultTheme.theme, mode);
      const row = render();
      const buttons = DomFixture.allOf(row, "nol-window-controls button", HTMLButtonElement);
      const [minimize, maximize, close] = [DomFixture.present(buttons[0]), DomFixture.present(buttons[1]), DomFixture.present(buttons[2])];
      const read = (button: HTMLButtonElement): readonly string[] => {
        const style = getComputedStyle(button);
        return [style.backgroundColor, style.color];
      };
      const resting = read(minimize);

      await userEvent.hover(minimize);
      const minimizeHovered = read(minimize);
      await userEvent.hover(maximize);
      const maximizeHovered = read(maximize);
      await userEvent.hover(close);
      const closeHovered = read(close);
      await userEvent.unhover(close);

      expect(resting).toEqual(["rgba(0, 0, 0, 0)", AppearanceFixture.readColor(DefaultTheme.theme, mode, "title-bar-text")]);
      expect([minimizeHovered[0], maximizeHovered[0]]).toEqual([resolveColor("--nol-toolbar-hover"), resolveColor("--nol-toolbar-hover")]);
      expect(closeHovered).toEqual([AppearanceFixture.readColor(DefaultTheme.theme, mode, "error"), AppearanceFixture.readColor(DefaultTheme.theme, mode, "button-danger-text")]);
      expect(read(close)).toEqual(resting);
    });

  for (const mode of AppearanceFixture.modes)
    it(`reaches the window controls with Tab after the search field and outlines the focused one inside its edges in the accent color in ${mode} mode`, async () => {
      PreloadBridgeFixture.install("linux");
      apply(DefaultTheme.theme, mode);
      const row = render();
      const buttons = [...row.querySelectorAll<HTMLButtonElement>("nol-window-controls button")];
      DomFixture.one(row, ".nol-window-row-search").focus();
      const reached: (string | null)[] = [];
      const outlines: string[][] = [];

      while (reached.length < buttons.length) {
        await userEvent.tab();
        const focused = DomFixture.present(document.activeElement);
        const style = getComputedStyle(focused);
        reached.push(focused.getAttribute("aria-label"));
        outlines.push([style.outlineStyle, style.outlineColor, style.outlineWidth, style.outlineOffset]);
      }

      const width = AppearanceFixture.toPixels(0.0625);
      expect(reached).toEqual(["Minimize", "Maximize", "Close"]);
      expect(outlines).toEqual(buttons.map(() => ["solid", resolveColor("--nol-accent"), `${width}px`, `-${width}px`]));
    });

  it("mirrors the window controls to the row's left edge in right-to-left, Close first", async () => {
    PreloadBridgeFixture.install("linux");
    apply();
    document.documentElement.dir = "rtl";
    try {
      const fixture = TestBed.createComponent(WindowRowComponent);
      fixture.detectChanges();
      await settle(fixture);
      const row: HTMLElement = DomFixture.host(fixture);
      const buttons = [...row.querySelectorAll<HTMLButtonElement>("nol-window-controls button")];
      const boxes = buttons.map(t => t.getBoundingClientRect());
      const style = getComputedStyle(row);

      AppearanceFixture.expectPixels(DomFixture.present(boxes.at(-1)).left, row.getBoundingClientRect().left);
      expect(buttons.at(-1)?.getAttribute("aria-label")).toBe("Close");
      expect(boxes.slice(1).every((t, index) => t.right <= DomFixture.present(boxes[index]).left)).toBe(true);
      expect([style.paddingLeft, style.paddingRight]).toEqual(["0px", `${AppearanceFixture.toPixels(0.25)}px`]);
    }
    finally {
      document.documentElement.removeAttribute("dir");
    }
  });

  it("hides the window controls in full screen on Linux and ends at the panels' edge there, and shows them again after", async () => {
    const bridge = PreloadBridgeFixture.install("linux");
    bridge.fullScreen = Promise.resolve(true);
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();
    const row = DomFixture.host(fixture);
    const opened = [Object.isNull(row.querySelector("nol-window-controls")), getComputedStyle(row).paddingRight];

    bridge.changeFullScreen(false);
    await fixture.whenStable();

    expect(opened).toEqual([true, `${AppearanceFixture.toPixels(0.25)}px`]);
    expect([Object.isNull(row.querySelector("nol-window-controls")), getComputedStyle(row).paddingRight]).toEqual([false, "0px"]);
  });

  it("reports its painted colors and height once after the first render", async () => {
    const bridge = PreloadBridgeFixture.install();
    apply(DefaultTheme.theme, ThemeMode.Dark);

    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(bridge.appearances).toEqual([{
      background: getComputedStyle(document.body).backgroundColor,
      titleBar: AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Dark, "title-bar"),
      titleBarText: AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Dark, "title-bar-text"),
      titleBarHeight: AppearanceFixture.toPixels(2)
    }]);
  });

  it("reports its colors again whenever the mode or the theme changes, and not before the first report", async () => {
    const bridge = PreloadBridgeFixture.install();
    const appearance = TestBed.inject(AppearanceService);
    appearance.setModePreference(ModePreference.Light);
    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();
    const [light] = bridge.appearances;

    appearance.setModePreference(ModePreference.Dark);
    await fixture.whenStable();
    appearance.setTheme(FixtureTheme.theme);
    await fixture.whenStable();
    appearance.setModePreference(ModePreference.Dark);
    await fixture.whenStable();

    expect(bridge.appearances.length).toBe(1);
    expect(bridge.changes.length).toBe(2);
    expect(bridge.changes[0]?.["titleBar"]).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Dark, "title-bar"));
    expect(bridge.changes[0]?.["titleBar"]).not.toBe(light?.["titleBar"]);
    expect(bridge.changes[1]?.["titleBar"]).toBe(AppearanceFixture.readColor(FixtureTheme.theme, ThemeMode.Dark, "title-bar"));
  });

  for (const [mode, dimmed] of [[ThemeMode.Light, ["rgb(124, 124, 124)", "rgb(15, 15, 15)"]], [ThemeMode.Dark, ["rgb(12, 12, 12)", "rgb(102, 102, 102)"]]] as const)
    it(`gives the system's window controls the title bar's colors under an open dialog's backdrop once the overlay shows it, and their own back once it closes, in ${mode} mode`, async () => {
      const bridge = PreloadBridgeFixture.install("win32");
      apply(DefaultTheme.theme, mode);
      const fixture = TestBed.createComponent(WindowRowComponent);
      fixture.detectChanges();
      await settle(fixture);
      const [ready] = bridge.appearances;
      const dialog = TestBed.inject(DialogService).open(OpenDialogComponent, ".inside");
      const backdrop = DomFixture.one(document, ".nol-dialog-backdrop");
      fixture.detectChanges();
      const opening = [bridge.changes.at(-1) ?? ready, backdrop.classList.contains("cdk-overlay-backdrop-showing")] as const;
      await vi.waitFor(() => expect(backdrop.classList.contains("cdk-overlay-backdrop-showing")).toBe(true));
      await fadeAsync(backdrop);
      await settle(fixture);
      const open = [bridge.changes.at(-1), backdrop.classList.contains("cdk-overlay-backdrop-showing")] as const;
      dialog.close();
      await fadeAsync(backdrop);
      await settle(fixture);
      const closed = bridge.changes.at(-1);
      const colors = (appearance: Readonly<Record<string, unknown>> | undefined): readonly unknown[] => [appearance?.["titleBar"], appearance?.["titleBarText"]];

      expect(colors(ready)).toEqual([AppearanceFixture.readColor(DefaultTheme.theme, mode, "title-bar"), AppearanceFixture.readColor(DefaultTheme.theme, mode, "title-bar-text")]);
      expect([colors(opening[0]), opening[1], colors(open[0]), open[1]]).toEqual([colors(ready), false, dimmed, true]);
      expect([colors(closed), closed?.["background"], backdrop.isConnected]).toEqual([colors(ready), ready?.["background"], false]);
    });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark])
    it(`gives the system's window controls their own colors back once a closing dialog's backdrop leaves the page by the overlay's limit, before its fade ends, in ${mode} mode`, async () => {
      const bridge = PreloadBridgeFixture.install("win32");
      apply(DefaultTheme.theme, mode);
      const fixture = TestBed.createComponent(WindowRowComponent);
      fixture.detectChanges();
      await settle(fixture);
      const [ready] = bridge.appearances;
      const dialog = TestBed.inject(DialogService).open(OpenDialogComponent, ".inside");
      const backdrop = DomFixture.one(document, ".nol-dialog-backdrop");
      await vi.waitFor(() => expect(backdrop.classList.contains("cdk-overlay-backdrop-showing")).toBe(true));
      await fadeAsync(backdrop);
      await settle(fixture);
      const open = bridge.changes.at(-1);
      backdrop.style.transitionDuration = "60s";
      dialog.close();
      await vi.waitFor(() => expect(backdrop.isConnected).toBe(false), { timeout: 10_000 });
      await settle(fixture);
      const closed = bridge.changes.at(-1);
      const colors = (appearance: Readonly<Record<string, unknown>> | undefined): readonly unknown[] => [appearance?.["titleBar"], appearance?.["titleBarText"]];

      expect(colors(open)).not.toEqual(colors(ready));
      expect(colors(closed)).toEqual(colors(ready));
    }, 20_000);

  it("reads its colors again only when the opacity of an open or closing dialog's backdrop ends a transition", async () => {
    const bridge = PreloadBridgeFixture.install("win32");
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const dialog = TestBed.inject(DialogService).open(OpenDialogComponent, ".inside");
    const backdrop = DomFixture.one(document, ".nol-dialog-backdrop");
    await vi.waitFor(() => expect(backdrop.classList.contains("cdk-overlay-backdrop-showing")).toBe(true), { timeout: 10_000 });
    await fadeAsync(backdrop);
    await settle(fixture);
    const shown = [backdrop.classList.contains("cdk-overlay-backdrop-showing"), backdrop.getAnimations().length];
    const before = bridge.changes.length;
    const other = document.createElement("div");
    document.body.append(other);
    const end = (target: HTMLElement, propertyName: string): boolean => target.dispatchEvent(new TransitionEvent("transitionend", { propertyName, bubbles: true }));

    end(other, "opacity");
    end(backdrop, "background-color");
    await settle(fixture);
    const unrelated = bridge.changes.length;
    end(backdrop, "opacity");
    await settle(fixture);
    other.remove();
    dialog.close();

    expect(shown).toEqual([true, 0]);
    expect([unrelated, bridge.changes.length]).toEqual([before, before + 1]);
  }, 20_000);

  it("leaves the system's window controls their own colors under a dialog without a backdrop", async () => {
    const bridge = PreloadBridgeFixture.install("win32");
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const [ready] = bridge.appearances;
    const dialog = TestBed.inject(Dialog).open(OpenDialogComponent, { hasBackdrop: false });
    await settle(fixture);
    const open = bridge.changes.at(-1);
    dialog.close();
    await settle(fixture);

    expect([open?.["titleBar"], open?.["titleBarText"]]).toEqual([ready?.["titleBar"], ready?.["titleBarText"]]);
  });

  it("leaves its own window controls on Linux under an open dialog's backdrop, so they dim with the window", async () => {
    PreloadBridgeFixture.install("linux");
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    const row: HTMLElement = DomFixture.host(fixture);
    row.style.width = "600px";
    fixture.detectChanges();
    await settle(fixture);
    const centers = [...row.querySelectorAll<HTMLButtonElement>("nol-window-controls button")].map(t => {
      const box = t.getBoundingClientRect();
      return [box.left + box.width / 2, box.top + box.height / 2] as const;
    });
    const dialog = TestBed.inject(DialogService).open(OpenDialogComponent, ".inside");
    await settle(fixture);
    const above = centers.map(([x, y]) => document.elementFromPoint(x, y)?.classList.contains("nol-dialog-backdrop"));
    dialog.close();
    await settle(fixture);

    expect(above).toEqual([true, true, true]);
  });

  it("leaves the traffic lights' space free on macOS and ends at the panels' edge on the right", () => {
    PreloadBridgeFixture.install("darwin");
    apply();

    const row = render();
    const style = getComputedStyle(row);

    expect(row.classList.contains("nol-window-row-mac")).toBe(true);
    expect([style.paddingLeft, style.paddingRight]).toEqual(["78px", `${AppearanceFixture.toPixels(0.25)}px`]);
  });

  it("starts at the panels' edge in full screen on macOS, where the traffic lights hide, and leaves their space free again after", async () => {
    const bridge = PreloadBridgeFixture.install("darwin");
    bridge.fullScreen = Promise.resolve(true);
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();
    const row = DomFixture.host(fixture);
    const opened = getComputedStyle(row).paddingLeft;

    bridge.changeFullScreen(false);
    await fixture.whenStable();
    const left = getComputedStyle(row).paddingLeft;
    bridge.changeFullScreen(true);
    await fixture.whenStable();

    expect([opened, left, getComputedStyle(row).paddingLeft]).toEqual([`${AppearanceFixture.toPixels(0.25)}px`, "78px", `${AppearanceFixture.toPixels(0.25)}px`]);
  });

  it("reports a failed read of the full-screen state and keeps the traffic lights' space", async () => {
    const bridge = PreloadBridgeFixture.install("darwin");
    bridge.fullScreen = Promise.reject(new Error("The main process went away."));
    const handled: unknown[] = [];
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => handled.push(error) } }] });
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();

    expect([getComputedStyle(DomFixture.host(fixture)).paddingLeft, handled.map(t => String(t))]).toEqual(["78px", ["Error: The main process went away."]]);
  });

  function useNotesMenus(runs: JsonValue[]): void {
    TestBed.configureTestingModule({
      providers: [{
        provide: BuildTokens.menus, useValue: [MenuDeclarations.fromJson("notes", {
          places: [], groups: [{ name: "notes.create", place: "desktop.file", exclusive: false, items: [{ command: "notes.newNote", arguments: { template: "plan" } }] }]
        })]
      }]
    });
    TestBed.inject(CommandService).setCommands([new CommandContribution("notes.newNote", "New note", null, null, async t => {
      runs.push(t);
      return null;
    })]);
    TestBed.inject(MenuService).setActiveModules(["notes"]);
  }

  for (const panelSize of [12, 13, 18])
    for (const platform of ["win32", "linux", "darwin"])
      it(`stands as high as its tallest control and 0.25rem above and below it at panel size ${panelSize} on ${platform}`, async () => {
        PreloadBridgeFixture.install(platform);
        useNotesMenus([]);
        apply(DefaultTheme.theme, ThemeMode.Light, panelSize);

        const fixture = TestBed.createComponent(WindowRowComponent);
        fixture.detectChanges();
        await settle(fixture);
        const row: HTMLElement = DomFixture.host(fixture);
        const bounds = row.getBoundingClientRect();
        const controls = [...row.querySelectorAll<HTMLElement>("button:not(.nol-window-controls-button)")].filter(t => t.checkVisibility({ visibilityProperty: true })).map(t => t.getBoundingClientRect());
        const gap = AppearanceFixture.toPixels(0.25, panelSize);

        expect(controls.length).toBeGreaterThan(platform === "darwin" ? 0 : 3);
        AppearanceFixture.expectPixels(bounds.height, Math.max(24, AppearanceFixture.toPixels(1.375, panelSize)) + 2 * gap);
        AppearanceFixture.expectPixels(bounds.bottom - Math.max(...controls.map(t => t.bottom)), gap);
        AppearanceFixture.expectPixels(Math.min(...controls.map(t => t.top)) - bounds.top, gap);
      });

  function useMenuBarStyle(style: string): void {
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: { values: signal(new Map([["desktop.menuBar", style]])) } }] });
  }

  async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  }

  async function fadeAsync(backdrop: HTMLElement): Promise<void> {
    await Promise.allSettled(backdrop.getAnimations().map(t => t.finished));
  }

  function press(target: EventTarget, key: string, type: "keydown" | "keyup" = "keydown", init: KeyboardEventInit = {}): void {
    const keyCode = new Map([["ArrowLeft", 37], ["ArrowUp", 38], ["ArrowRight", 39], ["ArrowDown", 40], ["Escape", 27]]).get(key) ?? 0;
    target.dispatchEvent(new KeyboardEvent(type, { key, keyCode, bubbles: true, cancelable: true, ...init }));
  }

  it("opens the menu bar's places from a menu button at the row's start on Windows and Linux, outside the drag region", async () => {
    const runs: JsonValue[] = [];
    PreloadBridgeFixture.install("win32");
    useMenuBarStyle("Button");
    useNotesMenus(runs);
    apply();

    const row = render();
    const button = DomFixture.oneOf(row, ":scope > :first-child", HTMLButtonElement);
    button.click();
    const list = DomFixture.one(document, "nol-menu.nol-window-row-menu-list");
    const places = [...list.querySelectorAll<HTMLButtonElement>("button.nol-window-row-menu-place")];
    places[0]?.click();
    DomFixture.oneOf(document, "nol-menu[data-place='desktop.file'] button[data-command='notes.newNote']", HTMLButtonElement).click();
    await Promise.resolve();

    expect([button.classList.contains("nol-window-row-menu"), button.getAttribute("aria-label"), getComputedStyle(button).getPropertyValue("app-region")]).toEqual([true, "Menu", "no-drag"]);
    expect(places.map(t => t.getAttribute("data-place"))).toEqual(["desktop.file", "desktop.edit", "desktop.view", "desktop.help"]);
    expect(runs).toEqual([{ template: "plan" }]);
  });

  it("shows the places as a menu bar of items that open their menus below them and run their rows, outside the drag region", async () => {
    const runs: JsonValue[] = [];
    PreloadBridgeFixture.install("win32");
    useNotesMenus(runs);
    apply();

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const row: HTMLElement = DomFixture.host(fixture);
    const bar = DomFixture.one(row, "nol-menu-bar");
    const items = [...bar.querySelectorAll<HTMLButtonElement>("button.nol-window-row-menu-bar-item")];
    items[0]?.click();
    await fixture.whenStable();
    const menu = DomFixture.one(document, "nol-menu[data-place='desktop.file']");
    DomFixture.oneOf(menu, "button[data-command='notes.newNote']", HTMLButtonElement).click();
    await Promise.resolve();

    expect([bar.getAttribute("role"), bar.getAttribute("aria-label"), getComputedStyle(bar).getPropertyValue("app-region")]).toEqual(["menubar", "Menus", "no-drag"]);
    expect(items.map(t => [t.getAttribute("data-place"), String(t.textContent).trim(), t.getAttribute("role")])).toEqual([
      ["desktop.file", "File", "menuitem"], ["desktop.edit", "Edit", "menuitem"], ["desktop.view", "View", "menuitem"], ["desktop.help", "Help", "menuitem"]
    ]);
    expect(row.querySelector(".nol-window-row-menu")).toBeNull();
    expect(runs).toEqual([{ template: "plan" }]);
  });

  it("moves between the menu bar's items with the arrow keys and opens a menu with the down arrow", async () => {
    PreloadBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const items = DomFixture.allOf(DomFixture.host(fixture), "button.nol-window-row-menu-bar-item", HTMLButtonElement);
    items[0]?.focus();
    press(DomFixture.present(items[0]), "ArrowRight");
    const second = document.activeElement;
    press(DomFixture.present(items[1]), "ArrowDown");
    await settle(fixture);

    expect(second).toBe(items[1]);
    expect(items[1]?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("nol-menu[data-place='desktop.edit']")).not.toBeNull();
  });

  it("folds the menu bar into the menu button while the row cannot fit it and unfolds it when it can", async () => {
    PreloadBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    const row: HTMLElement = DomFixture.host(fixture);
    row.style.width = "1000px";
    fixture.detectChanges();
    await settle(fixture);
    const wide = [row.querySelector(".nol-window-row-menu"), row.querySelector("nol-menu-bar")?.classList.contains("nol-window-row-menu-bar-folded")];

    row.style.width = "150px";
    await settle(fixture);
    fixture.detectChanges();
    const bar = DomFixture.one(row, "nol-menu-bar");
    const narrow = [Object.isNull(row.querySelector(".nol-window-row-menu")), bar.classList.contains("nol-window-row-menu-bar-folded"), bar.getAttribute("aria-hidden"), bar.hasAttribute("inert"), getComputedStyle(bar).visibility];

    row.style.width = "1000px";
    await settle(fixture);
    fixture.detectChanges();

    expect(wide).toEqual([null, false]);
    expect(narrow).toEqual([false, true, "true", true, "hidden"]);
    expect(row.querySelector(".nol-window-row-menu")).toBeNull();
    expect(bar.classList.contains("nol-window-row-menu-bar-folded")).toBe(false);
  });

  for (const [platform, panelSize] of [["win32", 12], ["win32", 18], ["linux", 12], ["linux", 18]] as const)
    it(`folds the menu bar once the row cannot leave 6rem for dragging and 12rem for the search field, counting the window controls, at panel size ${panelSize} on ${platform}`, async () => {
      PreloadBridgeFixture.install(platform);
      useNotesMenus([]);
      apply();
      TestBed.inject(AppearanceService).setTypography(new Typography(panelSize));
      const fixture = TestBed.createComponent(WindowRowComponent);
      const row: HTMLElement = DomFixture.host(fixture);
      row.style.width = "1000px";
      fixture.detectChanges();
      await settle(fixture);
      const style = getComputedStyle(row);
      const parts = [".nol-window-row-start", ".nol-window-row-actions", "nol-menu-bar", "nol-window-controls"]
        .map(t => row.querySelector<HTMLElement>(t)?.getBoundingClientRect().width ?? 0);
      const barStyle = getComputedStyle(DomFixture.one(row, "nol-menu-bar"));
      const margins = parseFloat(barStyle.marginLeft) + parseFloat(barStyle.marginRight);
      const fits = Math.ceil(parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parts.reduce((a, b) => a + b, 0) + margins + AppearanceFixture.toPixels(6 + 12, panelSize));
      const folded = (): boolean | undefined => row.querySelector("nol-menu-bar")?.classList.contains("nol-window-row-menu-bar-folded");

      row.style.width = `${fits}px`;
      await settle(fixture);
      fixture.detectChanges();
      const atFit = folded();
      row.style.width = `${fits - 1}px`;
      await settle(fixture);
      fixture.detectChanges();

      expect([atFit, folded()]).toEqual([false, true]);
    });

  it("shows neither the bar nor the button when the menus are hidden, and ignores Alt and F10", async () => {
    PreloadBridgeFixture.install("win32");
    useMenuBarStyle("Hidden");
    useNotesMenus([]);
    apply();
    const field = document.createElement("input");
    document.body.append(field);
    field.focus();

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    press(field, "F10");
    press(field, "Alt");
    press(field, "Alt", "keyup");

    expect(fixture.nativeElement.querySelector("nol-menu-bar, .nol-window-row-menu")).toBeNull();
    expect(document.activeElement).toBe(field);
    field.remove();
  });

  it("focuses the first menu with F10 or a lone Alt, not with Alt used in a chord or after a click, and Escape gives the focus back", async () => {
    PreloadBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const field = document.createElement("input");
    document.body.append(field);
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const first = DomFixture.one(DomFixture.host(fixture), "button.nol-window-row-menu-bar-item");
    const focused: (Element | null)[] = [];

    field.focus();
    press(field, "F10", "keydown", { shiftKey: true });
    press(field, "Alt");
    press(field, "x", "keydown", { altKey: true });
    press(field, "Alt", "keyup");
    press(field, "Alt");
    const pointerdown = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    document.dispatchEvent(pointerdown);
    press(field, "Alt", "keyup");
    focused.push(document.activeElement);
    expect(pointerdown.defaultPrevented).toBe(false);
    press(field, "F10");
    focused.push(document.activeElement);
    press(first, "F10");
    press(first, "Escape");
    focused.push(document.activeElement);
    press(field, "Alt");
    press(field, "Alt", "keyup");
    focused.push(document.activeElement);
    field.remove();
    press(first, "Escape");
    press(first, "Escape");
    focused.push(document.activeElement);

    expect(focused).toEqual([field, first, field, first, first]);
    field.remove();
  });

  it("keeps the focus on the first menu at Escape when F10 came from an element that isn't an HTML element", async () => {
    PreloadBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const drawing = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    drawing.setAttribute("tabindex", "0");
    document.body.append(drawing);
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const first = DomFixture.one(DomFixture.host(fixture), "button.nol-window-row-menu-bar-item");

    drawing.focus();
    const start = document.activeElement;
    press(drawing, "F10");
    const menu = document.activeElement;
    press(first, "Escape");
    drawing.remove();

    expect([start, menu, document.activeElement]).toEqual([drawing, first, first]);
  });

  it("leaves the focus in an open dialog on F10 or a lone Alt, and focuses the first menu again once the dialog closes", async () => {
    PreloadBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const first = DomFixture.one(DomFixture.host(fixture), "button.nol-window-row-menu-bar-item");
    const dialog = TestBed.inject(DialogService).open(OpenDialogComponent, ".inside");
    await vi.waitFor(() => expect(document.activeElement?.classList.contains("inside")).toBe(true));
    const inside = DomFixture.present(document.activeElement);

    press(inside, "F10");
    press(inside, "Alt");
    press(inside, "Alt", "keyup");
    const whileOpen = document.activeElement;
    dialog.close();
    await settle(fixture);
    press(document.body, "F10");

    expect(whileOpen).toBe(inside);
    expect(document.activeElement).toBe(first);
  });

  it("focuses the menu button instead when the menus are a button, and keeps Escape for an open menu", async () => {
    PreloadBridgeFixture.install("win32");
    useMenuBarStyle("Button");
    useNotesMenus([]);
    apply();
    const field = document.createElement("input");
    document.body.append(field);
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const button = DomFixture.oneOf(DomFixture.host(fixture), ".nol-window-row-menu", HTMLButtonElement);

    field.focus();
    press(field, "F10");
    const focused = document.activeElement;
    button.setAttribute("aria-expanded", "true");
    press(button, "Escape");
    const stayed = document.activeElement;

    expect([focused, stayed]).toEqual([button, button]);
    field.remove();
  });

  it("does not move focus to a menu on macOS", async () => {
    PreloadBridgeFixture.install("darwin");
    useNotesMenus([]);
    apply();
    const field = document.createElement("input");
    document.body.append(field);
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);

    field.focus();
    press(field, "F10");

    expect(document.activeElement).toBe(field);
    expect(fixture.nativeElement.querySelector("nol-menu-bar")).toBeNull();
    field.remove();
  });

  it("puts the actions placed at the start right after the menu, the search field next and the others at the end", async () => {
    PreloadBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const action = (name: string, side: TopBarSide): TopBarAction =>
      new TopBarAction(new TopBarActionContribution(name, new TopBarActionState("note_add", name, "notes.newNote"), side), () => undefined);
    TestBed.inject(BarItemsService).set([], [action("notes.print", TopBarSide.End), action("notes.back", TopBarSide.Start), action("notes.forward", TopBarSide.Start)]);

    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await settle(fixture);
    const row: HTMLElement = DomFixture.host(fixture);

    expect([...row.children].map(t => `${t.tagName.toLowerCase()}.${[...t.classList].find(u => u.startsWith("nol-window-row-"))}`)).toEqual([
      "nol-menu-bar.nol-window-row-menu-bar", "div.nol-window-row-start", "div.nol-window-row-middle", "div.nol-window-row-actions"
    ]);
    expect([...row.querySelectorAll<HTMLElement>(".nol-window-row-start button")].map(t => nameOf(t))).toEqual(["left-dock", "back", "forward", "notes.back", "notes.forward", "layout", "settings"]);
    expect([...row.querySelectorAll<HTMLElement>(".nol-window-row-middle button")].map(t => nameOf(t))).toEqual(["search"]);
    expect([...row.querySelectorAll<HTMLElement>(".nol-window-row-actions button")].map(t => nameOf(t))).toEqual(["notes.print"]);
  });

  it("has no menu button on macOS, sends the menu bar to the main process and runs the row the main process reports until it is removed", async () => {
    const runs: JsonValue[] = [];
    const bridge = PreloadBridgeFixture.install("darwin");
    useNotesMenus(runs);
    apply();
    const listeners = bridge.listenerCount;
    const fixture = TestBed.createComponent(WindowRowComponent);
    await fixture.whenStable();

    bridge.chooseMenuCommand("desktop.file/notes.create/0");
    await Promise.resolve();
    fixture.destroy();

    expect(fixture.nativeElement.querySelector(".nol-window-row-menu")).toBeNull();
    expect(JsonReader.fromValue(bridge.menuBars.at(-1) ?? {}).readObjectArray("menus").map(t => t.readString("place")))
      .toEqual(["desktop.app", "desktop.file", "desktop.edit", "desktop.view", "desktop.window", "desktop.help"]);
    expect(runs).toEqual([{ template: "plan" }]);
    expect(bridge.listenerCount).toBe(listeners);
  });

  const registry = LayoutFixture.createRegistry();

  async function useLayout(): Promise<LayoutService> {
    const layout = await LayoutServiceFixture.prepareAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.plan));
    TestBed.inject(TabLabelService).register(ShellDocuments.settings.name, ShellDocuments.settingsLabel);
    return layout;
  }

  function isUnavailable(button: HTMLElement | undefined): boolean {
    return button?.getAttribute("aria-disabled") === "true" && !button.matches(":disabled");
  }

  function nameOf(button: HTMLElement): string {
    return button.getAttribute("data-nol-item") ?? [...button.classList].find(t => t.startsWith("nol-window-row-") && t !== "nol-window-row-control")?.slice("nol-window-row-".length) ?? String.empty;
  }

  function tooltipOf(fixture: ComponentFixture<WindowRowComponent>, selector: string): string {
    return fixture.debugElement.query(By.css(selector)).injector.get(TooltipDirective).text();
  }

  function resolveColor(token: string): string {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.backgroundColor = `var(${token})`;
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }

  function toRgb(color: string): string {
    const context = DomFixture.present(document.createElement("canvas").getContext("2d", { willReadFrequently: true }));
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${red}, ${green}, ${blue})`;
  }

  async function refresh(fixture: ComponentFixture<WindowRowComponent>): Promise<void> {
    TestBed.tick();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  for (const [platform, style, width, menu, edge] of [
    ["win32", "Inline", 1600, ["menu-bar-item", "menu-bar-item", "menu-bar-item", "menu-bar-item"], "nol-menu-bar"],
    ["win32", "Inline", 360, ["menu"], ".nol-window-row-menu"],
    ["linux", "Button", 1600, ["menu"], ".nol-window-row-menu"],
    ["win32", "Hidden", 1600, [], ".nol-window-row-left-dock"],
    ["darwin", "Inline", 1600, [], ".nol-window-row-left-dock"]
  ] as const)
    it(`puts the left dock, Back, Forward, the start actions, Layout, Settings and the search field after the menu in reading order, from the row's edge, on ${platform} with the menus ${style} at ${width}px`, async () => {
      PreloadBridgeFixture.install(platform);
      if (style !== "Inline")
        useMenuBarStyle(style);
      useNotesMenus([]);
      apply();
      await useLayout();
      TestBed.inject(BarItemsService).set([], [
        new TopBarAction(new TopBarActionContribution("notes.pin", new TopBarActionState("push_pin", "Pin", "notes.newNote"), TopBarSide.Start), () => undefined)
      ]);
      const fixture = TestBed.createComponent(WindowRowComponent);
      const row: HTMLElement = DomFixture.host(fixture);
      row.style.width = `${width}px`;
      fixture.detectChanges();
      await settle(fixture);
      fixture.detectChanges();
      const read = (): (readonly [string, DOMRect])[] => [...row.querySelectorAll<HTMLElement>("button")]
        .filter(t => Object.isNull(t.closest(".nol-window-row-actions, nol-window-controls")) && t.checkVisibility({ visibilityProperty: true })).map(t => [nameOf(t), t.getBoundingClientRect()] as const);
      const isOrdered = (bounds: readonly DOMRect[], isReversed: boolean): boolean =>
        bounds.slice(1).every((t, index) => isReversed ? t.right <= (bounds[index]?.left ?? 0) + 0.5 : t.left >= (bounds[index]?.right ?? 0) - 0.5);
      const ahead = read();
      const lead = DomFixture.one(row, edge).getBoundingClientRect().left - row.getBoundingClientRect().left;
      document.documentElement.dir = "rtl";
      await settle(fixture);
      const reversed = read();
      document.documentElement.removeAttribute("dir");

      expect(ahead.map(t => t[0])).toEqual([...menu, "left-dock", "back", "forward", "notes.pin", "layout", "settings", "search"]);
      expect(reversed.map(t => t[0])).toEqual(ahead.map(t => t[0]));
      expect([isOrdered(ahead.map(t => t[1]), false), isOrdered(reversed.map(t => t[1]), true)]).toEqual([true, true]);
      AppearanceFixture.expectPixels(lead, parseFloat(getComputedStyle(row).paddingLeft));
    });

  for (const mode of AppearanceFixture.modes)
    it(`draws the row's own buttons as squares as tall as the search field, level with it, outside the drag region and readable on the title bar in ${mode} mode`, async () => {
      PreloadBridgeFixture.install("win32");
      apply(DefaultTheme.theme, mode);
      await useLayout();
      const row = render();
      const background = getComputedStyle(row).backgroundColor;
      const search = DomFixture.one(row, ".nol-window-row-search").getBoundingClientRect();
      const buttons = [...row.querySelectorAll<HTMLButtonElement>(".nol-window-row-control")];
      const enabled = buttons.filter(t => !isUnavailable(t));

      expect(buttons.map(t => nameOf(t))).toEqual(["left-dock", "back", "forward", "layout", "settings"]);
      expect(buttons.map(t => [t.getBoundingClientRect().width, t.getBoundingClientRect().height, t.getBoundingClientRect().top])).toEqual(buttons.map(() => [search.height, search.height, search.top]));
      expect(buttons.map(t => getComputedStyle(t).getPropertyValue("app-region"))).toEqual(buttons.map(() => "no-drag"));
      expect(enabled.map(t => nameOf(t))).toEqual(["left-dock", "layout", "settings"]);
      expect(enabled.map(t => AppearanceFixture.contrast(toRgb(getComputedStyle(t).color), background) >= 3)).toEqual([true, true, true]);
    });

  it("shows or hides the left dock from its button, named and drawn for what a click does, with its key in the tooltip", async () => {
    PreloadBridgeFixture.install("win32");
    apply();
    const layout = await useLayout();
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    const button = DomFixture.oneOf(DomFixture.host(fixture), ".nol-window-row-left-dock", HTMLButtonElement);
    const read = (): (string | null)[] => [button.getAttribute("aria-label"), button.textContent.trim(), tooltipOf(fixture, ".nol-window-row-left-dock")];
    const shown = read();

    button.click();
    await refresh(fixture);

    expect(shown).toEqual(["Hide the left dock", "left_panel_close", "Hide the left dock (Ctrl+B)"]);
    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(true);
    expect(read()).toEqual(["Show the left dock", "left_panel_open", "Show the left dock (Ctrl+B)"]);
  });

  for (const [platform, backTip, forwardTip] of [["win32", "Back (Alt+Left)", "Forward (Alt+Right)"], ["darwin", "Back (⌘[)", "Forward (⌘])"]] as const)
    it(`goes back and forward over the documents shown, each button enabled only while there is a document that way, with its key in the tooltip on ${platform}`, async () => {
      PreloadBridgeFixture.install(platform);
      apply();
      const layout = await useLayout();
      const fixture = TestBed.createComponent(WindowRowComponent);
      fixture.detectChanges();
      await refresh(fixture);
      const row: HTMLElement = DomFixture.host(fixture);
      const [back, forward] = [".nol-window-row-back", ".nol-window-row-forward"].map(t => DomFixture.oneOf(row, t, HTMLButtonElement));
      const state = (): (boolean | string | undefined)[] => [isUnavailable(back), isUnavailable(forward), layout.layout().documents.active?.key];
      const tips = (): string[] => [tooltipOf(fixture, ".nol-window-row-back"), tooltipOf(fixture, ".nol-window-row-forward")];
      const first = state();
      const firstTips = tips();
      layout.openDocument(LayoutFixture.todo);
      await refresh(fixture);
      const opened = state();

      back?.click();
      await refresh(fixture);
      const returned = state();
      const returnedTips = tips();
      forward?.click();
      await refresh(fixture);

      expect([first, opened, returned, state()]).toEqual([
        [true, true, LayoutFixture.plan.key], [false, true, LayoutFixture.todo.key], [true, false, LayoutFixture.plan.key], [false, true, LayoutFixture.todo.key]
      ]);
      expect([back?.getAttribute("aria-label"), forward?.getAttribute("aria-label"), back?.textContent.trim(), forward?.textContent.trim()]).toEqual(["Back", "Forward", "arrow_back", "arrow_forward"]);
      expect([firstTips, returnedTips, tips()]).toEqual([
        ["No earlier document to go back to", "No later document to go forward to"], ["No earlier document to go back to", forwardTip], [backTip, "No later document to go forward to"]
      ]);
    });

  it("goes back and forward over a view's places between documents, showing the view each time, each button enabled only while a place or document lies that way", async () => {
    PreloadBridgeFixture.install("win32");
    apply();
    const layout = await useLayout();
    const history = TestBed.inject(DocumentHistoryService);
    const shown: string[] = [];
    history.onPlaceShown(LayoutFixture.files.name, place => shown.push(place));
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await refresh(fixture);
    const row: HTMLElement = DomFixture.host(fixture);
    const [back, forward] = [".nol-window-row-back", ".nol-window-row-forward"].map(t => DomFixture.oneOf(row, t, HTMLButtonElement));
    const state = (): (boolean | string | undefined)[] =>
      [isUnavailable(back), isUnavailable(forward), layout.layout().documents.active?.key, layout.layout().groups.some(t => t.active?.equals(LayoutFixture.files) ?? false), shown.join(",")];
    layout.openView(LayoutFixture.search);
    history.recordPlace(new ViewPlace(LayoutFixture.files.name, null, "a"));
    await refresh(fixture);
    const recorded = state();
    layout.openDocument(LayoutFixture.todo);
    await refresh(fixture);
    const opened = state();
    const steps: (boolean | string | undefined)[][] = [];

    for (const button of [back, back, forward, forward]) {
      button?.click();
      await refresh(fixture);
      steps.push(state());
    }

    expect([recorded, opened]).toEqual([[false, true, LayoutFixture.plan.key, false, ""], [false, true, LayoutFixture.todo.key, false, ""]]);
    expect(steps).toEqual([
      [false, false, LayoutFixture.todo.key, true, "a"],
      [true, false, LayoutFixture.plan.key, true, "a"],
      [false, false, LayoutFixture.plan.key, true, "a,a"],
      [false, true, LayoutFixture.todo.key, true, "a,a"]
    ]);
  });

  for (const mode of AppearanceFixture.modes)
    it(`keeps Back, Forward and Settings in the tab order while they can't run, each marked unavailable, described by its reason, showing it below on keyboard focus and running nothing on a click, Enter or Space, in ${mode} mode`, async () => {
      PreloadBridgeFixture.install("win32");
      apply(DefaultTheme.theme, mode);
      const run = vi.spyOn(TestBed.inject(CommandService), "runAsync");
      const fixture = TestBed.createComponent(WindowRowComponent);
      fixture.detectChanges();
      const row: HTMLElement = DomFixture.host(fixture);
      const visit = async (selector: string, reason: string): Promise<(boolean | string | null)[]> => {
        const button = DomFixture.oneOf(row, selector, HTMLButtonElement);
        await vi.waitFor(() => expect(TooltipFixture.find(reason)).toBeDefined());
        const tooltip = DomFixture.present(TooltipFixture.find(reason)).getBoundingClientRect();
        const below = tooltip.top >= button.getBoundingClientRect().bottom;
        await userEvent.keyboard("{Enter}");
        await userEvent.keyboard(" ");
        button.click();
        await fixture.whenStable();
        const descriptions = (button.getAttribute("aria-describedby") ?? String.empty).split(" ").map(t => document.getElementById(t)?.textContent);
        return [document.activeElement === button, isUnavailable(button), getComputedStyle(button).opacity, below, descriptions.includes(reason)];
      };
      DomFixture.oneOf(row, ".nol-window-row-left-dock", HTMLButtonElement).focus();

      await userEvent.tab();
      const back = await visit(".nol-window-row-back", "No earlier document to go back to");
      await userEvent.tab();
      const forward = await visit(".nol-window-row-forward", "No later document to go forward to");
      await userEvent.tab();
      await userEvent.tab();
      const settings = await visit(".nol-window-row-settings", "Settings opens once the window has started");

      const expected = [true, true, "0.5", true, true];
      expect([back, forward, settings]).toEqual([expected, expected, expected]);
      expect(run.mock.calls).toEqual([]);
    });

  it("mirrors the Back and Forward arrows in right-to-left, in place and at their size, and leaves the other buttons as they are", async () => {
    PreloadBridgeFixture.install("win32");
    apply();
    await useLayout();
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    await refresh(fixture);
    const buttons = [".nol-window-row-back", ".nol-window-row-forward", ".nol-window-row-layout"].map(t => DomFixture.one(DomFixture.host(fixture), t));
    const read = (): (string | number)[][] => buttons.map(t => [getComputedStyle(t).scale, t.getBoundingClientRect().width, t.getBoundingClientRect().height]);
    const ahead = read();
    try {
      document.documentElement.dir = "rtl";
      await refresh(fixture);
      const reversed = read();

      expect(ahead.map(t => t[0])).toEqual(["none", "none", "none"]);
      expect(reversed.map(t => t[0])).toEqual(["-1 1", "-1 1", "none"]);
      expect(reversed.map(t => t.slice(1))).toEqual(ahead.map(t => t.slice(1)));
    }
    finally {
      document.documentElement.removeAttribute("dir");
    }
  });

  it("opens the layout menu below its button, with the docks, every view without instances checked while it is open, and Reset the layout, and shows a view chosen there", async () => {
    PreloadBridgeFixture.install("win32");
    apply();
    const layout = await useLayout();
    layout.setRegistry(new ViewRegistry([...registry.views, new ViewType("terminal.session", DockSide.Bottom, false, true)], ["notes.note", "desktop.settings"]));
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    const button = DomFixture.oneOf(DomFixture.host(fixture), ".nol-window-row-layout", HTMLButtonElement);
    button.click();
    await settle(fixture);
    const menu = DomFixture.one(document, "nol-menu[data-place='desktop.layoutMenu']");
    const rows = [...menu.querySelectorAll<HTMLButtonElement>("button")];
    const labels = rows.map(t => t.querySelector(".nol-menu-item-label")?.textContent.trim());
    const checks = rows.slice(3, 7).map(t => t.getAttribute("aria-checked"));
    const below = menu.getBoundingClientRect().top - button.getBoundingClientRect().bottom;
    const start = menu.getBoundingClientRect().left - button.getBoundingClientRect().left;

    rows.find(t => t.textContent.includes(LayoutFixture.search.name))?.click();
    await settle(fixture);

    expect([button.getAttribute("aria-label"), button.textContent.trim(), tooltipOf(fixture, ".nol-window-row-layout")]).toEqual(["Layout", "dashboard", "Layout"]);
    AppearanceFixture.expectPixels(below, 0);
    AppearanceFixture.expectPixels(start, 0);
    expect(labels).toEqual(["Left dock", "Right dock", "Bottom dock", LayoutFixture.files.name, LayoutFixture.search.name, LayoutFixture.changes.name, "terminal.shell", "Reset the layout"]);
    expect(checks).toEqual(["true", "false", "true", "false"]);
    expect([layout.layout().isOpen(LayoutFixture.search), layout.layout().groupOf(LayoutFixture.search)?.active?.key]).toEqual([true, LayoutFixture.search.key]);
  });

  it("opens Settings from its button, with its key in the tooltip, and disables the button while the window has no settings", async () => {
    PreloadBridgeFixture.install("win32");
    apply();
    const empty = isUnavailable(DomFixture.oneOf(render(), ".nol-window-row-settings", HTMLButtonElement));
    const layout = await useLayout();
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();
    const button = DomFixture.oneOf(DomFixture.host(fixture), ".nol-window-row-settings", HTMLButtonElement);

    button.click();
    await refresh(fixture);

    expect([empty, isUnavailable(button), button.getAttribute("aria-label"), button.textContent.trim()]).toEqual([true, false, "Settings", "settings"]);
    expect(tooltipOf(fixture, ".nol-window-row-settings")).toBe("Settings (Ctrl+,)");
    expect(layout.layout().documents.active?.key).toBe(ShellDocuments.settingsTab.key);
  });

  it("names only the action in a button's tooltip once the person has taken its key away", () => {
    PreloadBridgeFixture.install("win32");
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: { values: signal(new Map([["desktop.keyBindings", { "desktop.goBack": null }]])) } }] });
    apply();
    vi.spyOn(TestBed.inject(CommandService), "isAvailable").mockReturnValue(true);
    const fixture = TestBed.createComponent(WindowRowComponent);
    fixture.detectChanges();

    expect([tooltipOf(fixture, ".nol-window-row-back"), tooltipOf(fixture, ".nol-window-row-forward")]).toEqual(["Back", "Forward (Alt+Right)"]);
  });

  function useHeadings(): LayoutService {
    const layout = TestBed.inject(LayoutService);
    const labels = TestBed.inject(TabLabelService);
    layout.setRegistry(LayoutFixture.createRegistry());
    labels.register(ShellDocuments.settings.name, ShellDocuments.settingsLabel);
    labels.setHeading(LayoutFixture.plan, new DocumentHeading("Plan", ["Notes", "Drafts"]));
    labels.setHeading(LayoutFixture.todo, new DocumentHeading("A todo list for the release that goes on and on", ["The notes of the whole team", "Everything that is not done yet"]));
    return layout;
  }

  it("names the window after the active document and follows it, with no heading in the row", () => {
    PreloadBridgeFixture.install("win32");
    apply();
    const layout = useHeadings();
    const fixture = TestBed.createComponent(WindowRowComponent);
    const row: HTMLElement = DomFixture.host(fixture);
    const read = (): string => {
      fixture.detectChanges();
      return document.title;
    };
    const empty = read();
    layout.openDocument(LayoutFixture.plan);
    const plan = read();
    TestBed.inject(TabLabelService).setHeading(LayoutFixture.plan, new DocumentHeading("Launch plan"));
    const renamed = read();
    layout.openDocument(ShellDocuments.settingsTab);
    const settings = read();
    layout.activate(LayoutFixture.files);

    expect([empty, plan, renamed, settings, read()]).toEqual(["Noldova Desktop Sample", "Plan — Noldova Desktop Sample", "Launch plan — Noldova Desktop Sample",
      "Settings — Noldova Desktop Sample", "Settings — Noldova Desktop Sample"]);
    expect(row.querySelector(".nol-window-row-heading, .nol-window-row-breadcrumb")).toBeNull();
  });

  it("names the window after a view's instance in the document area, not after a plain view there or an instance in a dock, and follows an instance moved between them", () => {
    PreloadBridgeFixture.install("win32");
    apply();
    const layout = useHeadings();
    const labels = TestBed.inject(TabLabelService);
    labels.setHeading(LayoutFixture.terminal, new DocumentHeading("pwsh", ["Work", "api"]));
    labels.setHeading(LayoutFixture.secondTerminal, new DocumentHeading("bash", ["Home"]));
    labels.setHeading(LayoutFixture.files, new DocumentHeading("Files", ["Work"]));
    const fixture = TestBed.createComponent(WindowRowComponent);
    const read = (): string => {
      fixture.detectChanges();
      return document.title;
    };
    layout.openView(LayoutFixture.secondTerminal);
    const docked = read();
    const documents = layout.layout().documents.id;
    layout.focusGroup(documents);
    layout.openInCurrentGroup(LayoutFixture.files);
    const plain = read();
    layout.openInCurrentGroup(LayoutFixture.terminal);
    const instance = read();
    layout.activate(LayoutFixture.secondTerminal);
    const dockFocused = read();
    layout.closeTabs([LayoutFixture.files]);
    layout.place(LayoutFixture.terminal, new TabDropTarget(layout.layout().groupOf(LayoutFixture.secondTerminal)?.id ?? documents, 0));
    const movedOut = read();
    layout.place(LayoutFixture.secondTerminal, new TabDropTarget(documents, 0));
    layout.activate(LayoutFixture.secondTerminal);

    expect([docked, plain, instance, dockFocused, movedOut, read()]).toEqual(["Noldova Desktop Sample", "Noldova Desktop Sample", "pwsh — Noldova Desktop Sample",
      "pwsh — Noldova Desktop Sample", "Noldova Desktop Sample", "bash — Noldova Desktop Sample"]);
  });

  function centreOf(element: Element): number {
    const box = element.getBoundingClientRect();
    return box.left + box.width / 2;
  }

  for (const platform of ["win32", "linux", "darwin"])
    it(`centres the search field on the window on ${platform}, and moves it aside only as far as the row's middle needs, never over the buttons beside it`, async () => {
      PreloadBridgeFixture.install(platform);
      useNotesMenus([]);
      apply();
      const fixture = TestBed.createComponent(WindowRowComponent);
      const row: HTMLElement = DomFixture.host(fixture);
      row.style.width = "1600px";
      fixture.detectChanges();
      await settle(fixture);
      const field = DomFixture.one(row, ".nol-window-row-search");
      const middle = DomFixture.one(row, ".nol-window-row-middle");
      const wide = centreOf(field) - centreOf(row);
      const resize = async (width: number): Promise<void> => {
        row.style.width = `${width}px`;
        await settle(fixture);
        fixture.detectChanges();
        await settle(fixture);
      };
      const inner = (): readonly number[] => {
        const box = middle.getBoundingClientRect();
        const style = getComputedStyle(middle);
        return [box.left + parseFloat(style.paddingLeft), box.right - parseFloat(style.paddingRight)];
      };

      await resize(900);
      const [left, right] = inner();
      const narrow = field.getBoundingClientRect();
      await resize(1600);

      expect(Math.abs(wide)).toBeLessThanOrEqual(0.5);
      expect(narrow.left).toBeGreaterThanOrEqual((left ?? 0) - 0.5);
      expect(narrow.right).toBeLessThanOrEqual((right ?? 0) + 0.5);
      expect(Math.abs(centreOf(field) - centreOf(row))).toBeLessThanOrEqual(0.5);
    });

  it("measures the field again when fonts load, so a field drawn narrower moves back towards the window's centre", async () => {
    PreloadBridgeFixture.install("win32");
    useNotesMenus([]);
    apply();
    const fixture = TestBed.createComponent(WindowRowComponent);
    const row: HTMLElement = DomFixture.host(fixture);
    row.style.width = "1000px";
    fixture.detectChanges();
    await settle(fixture);
    const field = DomFixture.one(row, ".nol-window-row-search");
    const before = Math.abs(centreOf(field) - centreOf(row));

    field.style.width = "4rem";
    row.ownerDocument.fonts.dispatchEvent(new Event("loadingdone"));
    await settle(fixture);
    fixture.detectChanges();
    await settle(fixture);

    expect(before).toBeGreaterThan(1);
    expect(Math.abs(centreOf(field) - centreOf(row))).toBeLessThanOrEqual(0.5);
  });
});
