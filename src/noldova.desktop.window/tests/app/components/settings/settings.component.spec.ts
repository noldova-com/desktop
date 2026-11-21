/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, ErrorHandler, type Signal, type Type, type WritableSignal, computed, inject, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type {} from "@vitest/browser-playwright";
import { page, userEvent } from "vitest/browser";

import { ClipboardWriter, DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";
import { ModuleState, type SettingDefinition, SettingOption, SettingType } from "@noldova/desktop.protocol";

import { SettingsComponent } from "../../../../src/app/components/settings/settings.component";
import { GalleryTokens } from "../../../../src/app/models/gallery-tokens";
import { CommandContribution } from "../../../../src/app/models/command-contribution";
import type { IWindowPartContext } from "../../../../src/app/interfaces/i-window-part-context";
import { WindowPartFailureException } from "../../../../src/app/exceptions/window-part-failure.exception";
import { ModuleFailure } from "../../../../src/app/models/module-failure";
import { SettingsPageContribution } from "../../../../src/app/models/settings-page-contribution";
import { SettingsPageEntry } from "../../../../src/app/models/settings/settings-page-entry";
import { SettingsRow } from "../../../../src/app/models/settings/settings-row";
import { WindowPartContext } from "../../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { SettingCheckService } from "../../../../src/app/services/setting-check.service";
import { CommandService } from "../../../../src/app/services/command.service";
import { PreloadBridgeService } from "../../../../src/app/services/preload-bridge.service";
import { SettingsPageService } from "../../../../src/app/services/settings-page.service";
import { SettingOptionsService } from "../../../../src/app/services/setting-options.service";
import { SettingsService } from "../../../../src/app/services/settings.service";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { PreloadBridgeFixture } from "../../../fixtures/preload-bridge.fixture";
import { MediaFixture } from "../../../fixtures/media.fixture";
import { ModuleStatusFixture } from "../../../fixtures/module-status.fixture";
import { SettingsFixture } from "../../../fixtures/settings.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { WindowPartContextHostFixture } from "../../../fixtures/window-part-context-host.fixture";

class FakeSettingsService {
  public readonly definitions: WritableSignal<readonly SettingDefinition[]> = signal(SettingsFixture.all);
  public readonly values: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map<string, JsonValue>([["desktop.mode", "Dark"], ["desktop.panelSize", 13]]));
  public readonly sets: WritableSignal<ReadonlySet<string>> = signal(new Set(["desktop.mode"]));
  public readonly calls: string[] = [];
  public failure: Error | null = null;
  public held: Promise<void> | null = null;

  public isSet(name: string): Signal<boolean> {
    return computed(() => this.sets().has(name));
  }

  public setAsync(name: string, value: JsonValue): Promise<void> {
    this.calls.push(`set ${name} ${JSON.stringify(value)}`);
    if (!Object.isNull(this.held))
      return this.held.then(() => this.values.update(t => new Map([...t, [name, value]])));
    return Object.is(this.failure, null) ? Promise.resolve() : Promise.reject(this.failure);
  }

  public resetAsync(name: string): Promise<void> {
    this.calls.push(`reset ${name}`);
    return Object.is(this.failure, null) ? Promise.resolve() : Promise.reject(this.failure);
  }
}

@Component({ selector: "nol-fake-gallery", template: "<p class=\"fake-gallery\">Controls</p>" })
class FakeGalleryComponent {}

@Component({ selector: "nol-fake-plain-account", template: "<p class=\"fake-plain\">Signed in as Ada.</p>" })
class FakePlainAccountComponent {}

@Component({
  selector: "nol-fake-rows",
  template: `
    <section class="nol-settings-group">
      <div class="nol-settings-rows">
        @for (row of rows; track row) {
          <div class="nol-setting-row" [attr.data-setting]="row"><div class="nol-setting-row-heading"><span class="nol-setting-row-title">{{ row }}</span></div></div>
        }
      </div>
    </section>`
})
class FakeRowsComponent {
  protected readonly rows: readonly string[] = [...Array.from({ length: 40 }, (_, index) => `clock.account.row${index}`), "clock.tick"];
}

const pageContexts: IWindowPartContext[] = [];

@Component({
  selector: "nol-fake-account",
  template: `
    <section class="nol-settings-group">
      <h3 class="nol-settings-group-title">Signed in</h3>
      <div class="nol-settings-rows">
        @for (row of rows; track row.title) {
          <div class="nol-setting-row">
            <div class="nol-setting-row-heading"><span class="nol-setting-row-title">{{ row.title }}</span><span class="nol-setting-row-end">{{ row.end }}</span></div>
            <div class="nol-setting-row-description">What the clock signs in with.</div>
            @if (row.control === "field") {
              <div class="nol-setting-row-control"><input type="text" /></div>
            } @else if (row.control === "summary") {
              <div class="nol-setting-row-control"><details><summary>Signed-in devices</summary>This device</details></div>
            }
          </div>
        }
      </div>
    </section>`
})
class FakeAccountComponent {
  protected readonly rows: readonly { title: string; end: string; control: "field" | "summary" | null }[] = [
    { title: "Account", end: "Change", control: "field" }, { title: "Server", end: "Change", control: "field" }, { title: "Status", end: "Works", control: null },
    { title: "Devices", end: String.empty, control: "summary" }
  ];

  public constructor() {
    pageContexts.push(inject(WindowPartTokens.context));
  }
}

@Component({
  selector: "nol-fake-notice",
  template: `<p>Nothing to change here.</p>`
})
class FakeNoticeComponent {
}

describe("SettingsComponent", () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let bridge: PreloadBridgeFixture;
  let settings: FakeSettingsService;
  let errors: unknown[];
  let gallery: Type<unknown> | null;
  let ownPages: WritableSignal<readonly SettingsPageEntry[]>;
  const pageSource = new WindowPartSource("clock", [], [], [], [], [], [], [], () => Promise.reject(new Error("unused")), [], [], [{ name: "clock.account", title: "Account" }]);
  const pageContext = new WindowPartContext(pageSource, new WindowPartContextHostFixture());
  const accountEntry = (loadComponent: () => Promise<Type<unknown>> = () => Promise.resolve(FakeAccountComponent)): SettingsPageEntry =>
    new SettingsPageEntry("clock.account", "Account", "clock", new SettingsPageContribution("clock.account", loadComponent), pageContext, null);

  function render(mode: ThemeMode = ThemeMode.Light, height: string = String.empty): HTMLElement {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    fixture = TestBed.createComponent(SettingsComponent);
    DomFixture.host(fixture).style.height = height;
    fixture.detectChanges();
    return DomFixture.host(fixture);
  }

  const element = (): HTMLElement => DomFixture.host(fixture);
  const texts = (selector: string): readonly string[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.trim() ?? String.empty);

  async function searchAsync(text: string): Promise<void> {
    const field = DomFixture.oneOf(element(), ".nol-settings-search-field", HTMLInputElement);
    field.value = text;
    field.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function renderSitesAsync(stored: string | null): Promise<HTMLInputElement> {
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.define("clock.sites", "Sites", "The sites the clock links to.", SettingType.text(200, true), String.empty, "Clock", "Words")]);
    if (!Object.isNull(stored))
      settings.values.update(t => new Map([...t, ["clock.sites", stored]]));
    const host = render();
    await searchAsync("sites");
    TestBed.inject(SettingCheckService).provide("clock.sites", value => value.includes(" ") ? "Enter hosts only." : null);
    fixture.detectChanges();
    return DomFixture.oneOf(host, "[data-setting='clock.sites'] input", HTMLInputElement);
  }

  function sitesMessage(): string {
    return element().querySelector("[data-setting='clock.sites'] [role=alert]")?.textContent?.trim() ?? String.empty;
  }

  function pageSelect(host: HTMLElement): HTMLButtonElement {
    return DomFixture.oneOf(host, ".nol-settings-page-select .nol-select-button", HTMLButtonElement);
  }

  async function chooseClockAsync(host: HTMLElement): Promise<void> {
    host.style.width = "37rem";
    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    fixture.detectChanges();
  }

  function framesAsync(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install("linux");
    settings = new FakeSettingsService();
    errors = [];
    gallery = null;
    ownPages = signal([]);
    pageContexts.length = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: WindowPartHostService, useValue: { settingsPages: ownPages } },
        { provide: GalleryTokens.component, useFactory: () => gallery },
        { provide: ClipboardWriter, useExisting: PreloadBridgeService },
        { provide: SettingsService, useValue: settings },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
    ModuleStatusFixture.report(
      ModuleStatusFixture.create("clock", "Clock"), ModuleStatusFixture.create("notes", "Notes", ["notes.saved"]), ModuleStatusFixture.create("reminder", "Reminder", ["reminder.due"]));
    TestBed.inject(CommandService).setCommands([
      new CommandContribution("clock.tick", "Tick the clock", null, "Ctrl+Alt+T", () => Promise.resolve(null)),
      new CommandContribution("clock.stop", "Stop the clock", null, "Ctrl+Alt+T", () => Promise.resolve(null))
    ]);
  });

  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    await userEvent.unhover(DomFixture.host(fixture));
    vi.useRealTimers();
    PreloadBridgeFixture.remove();
    AppearanceFixture.reset();
  });

  it("lists the pages, shows Appearance first with its groups and rows, and shows another page when it is chosen", async () => {
    render();
    const appearance = { pages: texts(".nol-tree-label"), current: texts("[aria-selected=true]"), groups: texts(".nol-settings-group-title"), rows: texts(".nol-setting-row-title") };
    const markers = ["desktop.mode", "desktop.panelSize"].map(t => !Object.isNull(element().querySelector(`[data-setting='${t}'] .nol-setting-row-marker`)));

    await page.getByRole("treeitem", { name: "Clock" }).click();
    fixture.detectChanges();

    expect(appearance).toEqual({
      pages: ["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "About"], current: ["Appearance"], groups: ["Theme", "Text"], rows: ["Mode", "Interface text size"]
    });
    expect([texts("[aria-selected=true]"), texts(".nol-settings-group-title"), texts(".nol-setting-row-title")]).toEqual([["Clock"], ["Words", "Ticks"], ["Greeting", "Tick step"]]);
    expect(markers).toEqual([true, false]);
  });

  it("opens on General once it has rows, with the runtime's state first, then the Clock row before the formats and a module's rows after them", async () => {
    settings.definitions.set([SettingsFixture.timeFormat, SettingsFixture.dateTimeFormat, ...SettingsFixture.all, SettingsFixture.alarmSound]);
    render();
    await fixture.whenStable();
    fixture.detectChanges();
    const status = DomFixture.one(element(), "nol-runtime-status [role=status] > span");
    const heading = DomFixture.one(element(), "[data-setting='desktop.clock'] .nol-setting-row-heading");
    const shown = [texts(".nol-tree-label"), texts("[aria-selected=true]"), texts(".nol-settings-group-title"), texts(".nol-setting-row-title"), status.textContent?.trim()];
    await searchAsync("runtime");

    expect(shown).toEqual([
      ["General", "Appearance", "Notifications", "Keyboard shortcuts", "Clock", "About"], ["General"], ["Runtime", "Date and time", "Clock"],
      ["Clock", "Time format", "Date and time format", "Alarm sound"], "Connected"
    ]);
    expect(status.getBoundingClientRect().left - heading.getBoundingClientRect().left).toBe(0);
    expect(element().querySelector("nol-runtime-status")).toBeNull();
  });

  it("shows each format as the time now looks in it, from the text as it is typed until it is committed, and sets both formats from the Clock row", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 10, 13, 5));
    settings.definitions.set([SettingsFixture.timeFormat, SettingsFixture.dateTimeFormat, ...SettingsFixture.all]);
    settings.values.set(new Map([["desktop.timeFormat", "H:mm:ss"]]));
    settings.sets.set(new Set(["desktop.timeFormat"]));
    render();
    const notes = (): readonly string[] => texts(".nol-setting-row-note");
    const time = DomFixture.oneOf(element(), "[data-setting='desktop.timeFormat'] input", HTMLInputElement);
    const shown = [notes()];
    time.value = "EEE h:mm a";
    time.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    shown.push(notes());
    time.dispatchEvent(new Event("change"));
    fixture.detectChanges();
    shown.push(notes());
    await page.getByRole("radio", { name: "12-hour" }).click();
    await page.getByRole("button", { name: "Reset Clock" }).click();
    await expect.poll(() => settings.calls.length).toBe(5);

    const dateTime = `Shows as ${new Date(2026, 8, 10).toLocaleString("en-GB", { month: "short" })} 10, 2026, 1:05 PM`;

    expect(shown).toEqual([["Shows as 13:05:00", dateTime], ["Shows as Thu 1:05 PM", dateTime], ["Shows as 13:05:00", dateTime]]);
    expect(settings.calls).toEqual([
      "set desktop.timeFormat \"EEE h:mm a\"", "set desktop.timeFormat \"h:mm a\"", "set desktop.dateTimeFormat \"MMM d, yyyy, h:mm a\"",
      "reset desktop.timeFormat", "reset desktop.dateTimeFormat"
    ]);
  });

  it("drops a format's draft once its stored value changes, from the Clock row or its Reset, and puts a blank format back to its default, set or not", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 10, 13, 5));
    settings.definitions.set([SettingsFixture.timeFormat, SettingsFixture.dateTimeFormat, ...SettingsFixture.all]);
    render();
    const time = DomFixture.oneOf(element(), "[data-setting='desktop.timeFormat'] input", HTMLInputElement);
    const read = (): readonly string[] => [time.value, texts("[data-setting='desktop.timeFormat'] .nol-setting-row-note")[0] ?? String.empty];
    const type = (text: string, event: string): void => {
      time.value = text;
      time.dispatchEvent(new Event(event));
      fixture.detectChanges();
    };
    const store = (values: ReadonlyMap<string, JsonValue>): void => {
      settings.values.set(values);
      settings.sets.set(new Set(values.keys()));
      fixture.detectChanges();
    };
    type("h:mm:ss a", "input");
    type("h:mm a", "input");
    await page.getByRole("radio", { name: "24-hour" }).click();
    store(new Map([["desktop.timeFormat", "HH:mm"], ["desktop.dateTimeFormat", "d MMM yyyy, HH:mm"]]));
    const clocked = read();
    type("HH:mm:ss", "input");
    await page.getByRole("button", { name: "Reset Clock" }).click();
    store(new Map());
    const reset = read();
    store(new Map([["desktop.timeFormat", "H:mm:ss"]]));
    type("  ", "input");
    type("  ", "change");
    store(new Map());
    const blank = read();
    type(String.empty, "change");
    const unset = read();
    await expect.poll(() => settings.calls.length).toBe(6);

    expect([clocked, reset, blank, unset]).toEqual([["HH:mm", "Shows as 13:05"], ["h:mm a", "Shows as 1:05 PM"], ["h:mm a", "Shows as 1:05 PM"], ["h:mm a", "Shows as 1:05 PM"]]);
    expect(settings.calls).toEqual([
      "set desktop.timeFormat \"HH:mm\"", "set desktop.dateTimeFormat \"d MMM yyyy, HH:mm\"", "reset desktop.timeFormat", "reset desktop.dateTimeFormat",
      "reset desktop.timeFormat", "reset desktop.timeFormat"
    ]);
  });

  it("swaps its page list for a Settings pages select at the start of the search row below 34rem inside its padding, and changes page and leaves a search through it", async () => {
    const host = render();
    const select = (): HTMLButtonElement => DomFixture.oneOf(host, ".nol-settings-page-select .nol-select-button", HTMLButtonElement);
    const shown = (): readonly boolean[] => [".nol-settings-pages", ".nol-settings-page-select"].map(t => getComputedStyle(DomFixture.oneOf(host, t, Element)).display !== "none");
    const box = (selector: string): DOMRect => DomFixture.one(host, selector).getBoundingClientRect();
    host.style.width = "37rem";
    const wide = shown();
    host.style.width = "calc(37rem - 1px)";
    const narrow = shown();
    const row = [box(".nol-settings-page-select").top === box(".nol-settings-search-field").top, box(".nol-settings-page-select").left < box(".nol-settings-search-field").left];
    const filled = Math.abs(box(".nol-settings-content").width - (box(".nol-settings-body").width)) < 1;

    await userEvent.click(select());
    await page.getByRole("option", { name: "Clock" }).click();
    fixture.detectChanges();
    const clock = [select().getAttribute("aria-label"), texts(".nol-settings-group-title")];
    await searchAsync("greeting");
    const searching = select().getAttribute("aria-label");
    await userEvent.click(select());
    await page.getByRole("option", { name: "Appearance" }).click();
    fixture.detectChanges();
    host.style.width = "15rem";
    const stacked = box(".nol-settings-page-select").bottom <= box(".nol-settings-search-field").top;

    expect([wide, narrow]).toEqual([[true, false], [false, true]]);
    expect([row, filled]).toEqual([[true, true], true]);
    expect(clock).toEqual(["Settings pages, Clock", ["Words", "Ticks"]]);
    expect(searching).toBe("Settings pages, Search results");
    expect([DomFixture.oneOf(host, ".nol-settings-search-field", HTMLInputElement).value, select().getAttribute("aria-label"), texts(".nol-settings-group-title")])
      .toEqual([String.empty, "Settings pages, Appearance", ["Theme", "Text"]]);
    expect(stacked).toBe(true);
  });

  it("scrolls its page list up to its content and its content from there to its end edge with a stable gutter, with the space after the list inside the content, and fills the content with its column at any width", () => {
    const host = render();
    host.style.width = "100rem";
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const box = (selector: string): DOMRect => DomFixture.one(host, selector).getBoundingClientRect();
    const content = DomFixture.one(host, ".nol-settings-content");
    const inRem = (pixels: number): number => Math.round(pixels / rem * 100) / 100 + 0;
    const divider = [inRem(box(".nol-settings-content").left - box(".nol-settings-pages").right), inRem(box(".nol-settings-column").left - box(".nol-settings-pages").right)];
    host.style.width = "calc(37rem - 1px)";
    const narrow = inRem(box(".nol-settings-column").left - host.getBoundingClientRect().left);
    const fills = ["150rem", "100rem"].map(width => {
      host.style.width = width;
      return Math.round(box(".nol-settings-column").right - box(".nol-settings-content").left - content.clientWidth);
    });

    expect([divider, narrow]).toEqual([[0, 1.5], 1.5]);
    expect(Math.abs(box(".nol-settings-content").right - host.getBoundingClientRect().right)).toBeLessThan(1);
    expect(getComputedStyle(content).scrollbarGutter).toBe("stable");
    expect(fills).toEqual([0, 0]);
  });

  it("spans its search field from the page list's start to the end of the column's content, at 100rem and 60rem", () => {
    const host = render();
    const box = (selector: string): DOMRect => DomFixture.one(host, selector).getBoundingClientRect();
    const column = DomFixture.one(host, ".nol-settings-column");
    const edges = ["100rem", "60rem"].map(width => {
      host.style.width = width;
      const end = box(".nol-settings-column").right - parseFloat(getComputedStyle(column).paddingRight);
      return [Math.round(box(".nol-settings-search-field").left - box(".nol-settings-pages").left), Math.round(box(".nol-settings-search-field").right - end)];
    });

    expect(edges).toEqual([[0, 0], [0, 0]]);
  });

  it("tops its first heading level with the page list's first item on a page, on Keyboard shortcuts and in search results", async () => {
    const host = render();
    host.style.width = "100rem";
    const top = (selector: string): number => DomFixture.one(host, selector).getBoundingClientRect().top;
    const offset = (): number => Math.round(top(".nol-settings-column h2") - top(".nol-settings-pages .nol-tree-row"));
    const offsets = [offset()];
    await page.getByRole("treeitem", { name: "Keyboard shortcuts" }).click();
    fixture.detectChanges();
    offsets.push(offset());
    await searchAsync("greeting");
    offsets.push(offset());

    expect(offsets).toEqual([0, 0, 0]);
  });

  it("starts and ends the shortcuts table's text, actions and row lines at the page's edges, Settings' edge inside the column's content edges, with the product's name in the From column, and Reset all beside the explanation", async () => {
    const host = render();
    await page.getByRole("treeitem", { name: "Keyboard shortcuts" }).click();
    fixture.detectChanges();
    const textLeft = (element: Element): number => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().left;
    };
    const column = DomFixture.one(host, ".nol-settings-column");
    const heading = DomFixture.one(host, ".nol-settings-group-title");
    const rows = [...DomFixture.oneOf(host, ".nol-shortcuts-table", HTMLTableElement).rows];
    const actions = rows.flatMap(t => [...DomFixture.present(t.cells[t.cells.length - 1]).querySelectorAll("button")].slice(-1));
    const shortcuts = DomFixture.one(host, "nol-shortcuts");
    const columnEnd = (): number => column.getBoundingClientRect().right - parseFloat(getComputedStyle(column).paddingRight);
    const textEnd = (): number => columnEnd() - parseFloat(getComputedStyle(heading).paddingInlineStart);
    const offsets = ["100rem"].map(width => {
      host.style.width = width;
      const start = textLeft(heading);
      const end = textEnd();
      return [
        ...rows.map(t => textLeft(DomFixture.present(t.cells[0])) - start),
        ...rows.map(t => DomFixture.present(t.cells[0]).getBoundingClientRect().left - start),
        ...rows.map(t => DomFixture.present(t.cells[t.cells.length - 1]).getBoundingClientRect().right - end),
        ...actions.map(t => t.getBoundingClientRect().right - end)
      ].map(t => Math.round(t));
    });
    host.style.width = "100rem";
    const reset = DomFixture.one(host, ".nol-shortcuts-reset-all").getBoundingClientRect().right;

    expect([rows.length > 1, actions.length > 0]).toEqual([true, true]);
    expect(offsets).toEqual(offsets.map(t => t.map(() => 0)));
    expect(Math.round(reset - textEnd())).toBe(0);
    expect(Math.round(shortcuts.getBoundingClientRect().right - columnEnd())).toBe(0);
    expect(rows.every(t => getComputedStyle(DomFixture.present(t.cells[0])).borderBottomStyle === "solid")).toBe(true);
  });

  for (const owner of ["Clock", "Clockwork Almanac"])
    it(`scrolls its content sideways, under its own scrollbar at the pane's bottom edge, whenever Keyboard shortcuts is wider than the column, with every row's actions within its scroll and the table scrolling nothing itself, at 40rem, 62rem and 100rem with "${owner}" in the From column`, async () => {
      ModuleStatusFixture.report(ModuleStatusFixture.create("clock", owner));
      const host = render(ThemeMode.Light, "30rem");
      host.style.width = "100rem";
      await page.getByRole("treeitem", { name: "Keyboard shortcuts" }).click();
      fixture.detectChanges();
      const content = DomFixture.one(host, ".nol-settings-content");
      const actions = [...DomFixture.oneOf(host, ".nol-shortcuts-table", HTMLTableElement).tBodies[0]?.rows ?? []]
        .flatMap(t => [...DomFixture.present(t.cells[t.cells.length - 1]).querySelectorAll("button")]);
      const views: (readonly [string, boolean, number, number])[] = [];
      for (const width of ["40rem", "62rem", "100rem"]) {
        host.style.width = width;
        content.scrollTo(0, 0);
        await framesAsync();
        const box = content.getBoundingClientRect();
        const reach = box.left + content.scrollWidth;
        const outOfReach = actions.filter(t => t.getBoundingClientRect().left < box.left || t.getBoundingClientRect().right > reach).length;
        views.push([width, content.scrollWidth > content.clientWidth, Math.round(box.bottom - host.getBoundingClientRect().bottom), outOfReach]);
      }

      expect(actions.length).toBeGreaterThan(0);
      expect([getComputedStyle(content).overflowX, getComputedStyle(DomFixture.one(host, ".nol-configuration-table-body")).overflowX]).toEqual(["auto", "visible"]);
      AppearanceFixture.expectLook(getComputedStyle(content, "::-webkit-scrollbar").height, DefaultTheme.theme, "scrollbar-size", "height");
      expect(views).toEqual([
        ["40rem", true, 0, 0],
        ["62rem", false, 0, 0],
        ["100rem", false, 0, 0]
      ]);
    });

  it("mirrors its insets right to left, so its scroller meets the left edge, its page list meets its content and its start inset is on the right", () => {
    const host = render();
    host.dir = "rtl";
    host.style.width = "100rem";
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const box = (selector: string): DOMRect => DomFixture.one(host, selector).getBoundingClientRect();
    const edges = host.getBoundingClientRect();

    expect(Math.abs(box(".nol-settings-content").left - edges.left)).toBeLessThan(1);
    expect(Math.abs(box(".nol-settings-pages").left - box(".nol-settings-content").right)).toBeLessThan(1);
    expect(Math.abs(edges.right - box(".nol-settings-pages").right - 1.5 * rem)).toBeLessThan(1);
    expect(Math.abs(edges.right - box(".nol-settings-search").right - 1.5 * rem)).toBeLessThan(1);
  });

  it("shows a dynamic choice with the options its window part supplies for the module's settings, and its value alone until then", async () => {
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.model]);
    settings.values.update(t => new Map([...t, ["clock.greeting", "Noon"], ["clock.model", "calm"]]));
    const host = render();
    await searchAsync("voice");
    const row = (): HTMLElement => DomFixture.one(host, "[data-setting='clock.model']");
    const waiting = row().querySelector(".nol-select-button")?.getAttribute("aria-label");

    TestBed.inject(SettingOptionsService).provide("clock.model", values => [new SettingOption("calm", "Calm"), new SettingOption("bright", `Bright at ${String(values["clock.greeting"])}`)]);
    fixture.detectChanges();

    expect(waiting).toBe("Model, calm");
    expect([...row().querySelectorAll("[role=radio]")].map(t => t.textContent?.trim())).toEqual(["Calm", "Bright at Noon"]);
  });

  it("refuses a checked text its window part's check answers with a message, and saves it once the check accepts it", async () => {
    const field = await renderSitesAsync(null);

    field.value = "git hub.com";
    field.dispatchEvent(new Event("change"));
    fixture.detectChanges();
    const refused = [settings.calls.length, sitesMessage()];
    field.value = "github.com";
    field.dispatchEvent(new Event("change"));
    fixture.detectChanges();
    await expect.poll(() => settings.calls.length).toBe(1);

    expect([refused, settings.calls]).toEqual([[0, "Enter hosts only."], ["set clock.sites \"github.com\""]]);
  });

  it("keeps a refused text and its message in the field when the person's earlier accepted text is saved after the refusal", async () => {
    const field = await renderSitesAsync(null);
    let save = (): void => undefined;
    settings.held = new Promise<void>(resolve => save = resolve);

    field.value = "github.com";
    field.dispatchEvent(new Event("change"));
    field.value = "git hub.com";
    field.dispatchEvent(new Event("change"));
    fixture.detectChanges();
    save();
    await expect.poll(() => settings.values().get("clock.sites")).toBe("github.com");
    fixture.detectChanges();

    expect([field.value, sitesMessage(), field.getAttribute("aria-invalid"), settings.calls]).toEqual(["git hub.com", "Enter hosts only.", "true", ["set clock.sites \"github.com\""]]);
  });

  it("stops showing a stored text's refusal once the person commits a text the check accepts, before and after it is saved", async () => {
    const field = await renderSitesAsync("git hub.com");
    let save = (): void => undefined;
    settings.held = new Promise<void>(resolve => save = resolve);
    const shown = [sitesMessage()];

    field.value = "github.com";
    field.dispatchEvent(new Event("change"));
    fixture.detectChanges();
    shown.push(sitesMessage(), String(field.getAttribute("aria-invalid")), field.value);
    save();
    await expect.poll(() => settings.values().get("clock.sites")).toBe("github.com");
    fixture.detectChanges();
    shown.push(sitesMessage(), field.value);

    expect(shown).toEqual(["Enter hosts only.", String.empty, "null", "github.com", String.empty, "github.com"]);
  });

  it("moves focus to the page control it now shows when it switches between the page list and the select, and to no control that was not focused", async () => {
    const host = render();
    const field = DomFixture.oneOf(host, ".nol-settings-search-field", HTMLInputElement);
    await chooseClockAsync(host);

    host.style.width = "15rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(pageSelect(host)));
    host.style.width = "37rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(host.querySelector(".nol-tree-row-current")));
    host.style.width = "15rem";
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement))
      throw new Error("Nothing is focused.");
    focused.blur();
    await vi.waitFor(() => expect(document.activeElement).toBe(pageSelect(host)));
    await searchAsync("greeting");
    field.focus();
    host.style.width = "37rem";
    await framesAsync();
    const searching = document.activeElement;
    host.style.width = "15rem";
    await framesAsync();
    pageSelect(host).focus();
    host.style.width = "37rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(host.querySelector(".nol-tree-row")));

    expect(searching).toBe(field);
  });

  it("closes the Settings pages list when it widens while the list is open, moving focus to the current page, and leaves focus that moved elsewhere", async () => {
    const host = render();
    const outside = document.body.appendChild(document.createElement("button"));
    await chooseClockAsync(host);
    host.style.width = "15rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(pageSelect(host)));
    await userEvent.click(pageSelect(host));
    await expect.element(page.getByRole("listbox")).toBeVisible();

    host.style.width = "37rem";
    await vi.waitFor(() => expect(document.querySelector("[role=listbox]")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(host.querySelector(".nol-tree-row-current")));
    host.style.width = "15rem";
    await vi.waitFor(() => expect(document.activeElement).toBe(pageSelect(host)));
    await userEvent.click(pageSelect(host));
    await expect.element(page.getByRole("listbox")).toBeVisible();
    await userEvent.click(outside);
    await vi.waitFor(() => expect(document.querySelector("[role=listbox]")).toBeNull());
    host.style.width = "37rem";
    await framesAsync();
    const kept = document.activeElement;
    outside.remove();

    expect(kept).toBe(outside);
  });

  it("reveals the scrollbars of its page list and its content while they are hovered", async () => {
    render();

    for (const area of [".nol-settings-pages", ".nol-settings-content"])
      await AppearanceFixture.expectThumbRevealsOnHoverAsync(DomFixture.one(element(), area));
  });

  it("sets every page's content between the column's content edges, the Settings content inset after the page list at 100rem, 60rem and 40rem and none below 37rem with the select, sideways only on Keyboard shortcuts: a built-in page's rows, a module's rows, the shortcuts table and the Gallery", async () => {
    gallery = FakeGalleryComponent;
    const host = render();
    const column = DomFixture.one(host, ".nol-settings-column");
    const wide = "100rem";
    const widths = [wide, "60rem", "40rem", "calc(37rem - 1px)"];
    const content = DomFixture.one(host, ".nol-settings-content");
    const sideways: boolean[] = [];
    const measure = (selector: string): readonly (readonly number[])[] => {
      const columnBox = column.getBoundingClientRect();
      const box = DomFixture.one(host, selector).getBoundingClientRect();
      return [
        [columnBox.left + parseFloat(getComputedStyle(column).paddingLeft), columnBox.right - parseFloat(getComputedStyle(column).paddingRight)].map(t => Math.round(t)),
        [box.left, box.right].map(t => Math.round(t))
      ];
    };
    const edges = async (title: string, selector: string): Promise<readonly (readonly (readonly number[])[])[]> => {
      host.style.width = wide;
      await page.getByRole("treeitem", { name: title, exact: true }).click();
      fixture.detectChanges();
      return widths.map(t => {
        host.style.width = t;
        if (title !== "Keyboard shortcuts")
          sideways.push(content.scrollWidth > content.clientWidth);
        return measure(selector);
      });
    };
    const shown = [
      await edges("Appearance", "nol-setting-row"),
      await edges("Appearance", ".nol-settings-group-title"),
      await edges("Clock", "nol-setting-row"),
      await edges("Keyboard shortcuts", "nol-shortcuts"),
      await edges("Gallery", ".fake-gallery")
    ];
    const lists = widths.map(t => {
      host.style.width = t;
      return [".nol-settings-pages", ".nol-settings-page-select"].map(u => getComputedStyle(DomFixture.oneOf(host, u, Element)).display === "none" ? "hidden" : "shown");
    });
    const insets = widths.map(t => {
      host.style.width = t;
      return getComputedStyle(column).paddingLeft;
    });

    expect(lists).toEqual([["shown", "hidden"], ["shown", "hidden"], ["shown", "hidden"], ["hidden", "shown"]]);
    expect(shown.flat().map(t => t[1])).toEqual(shown.flat().map(t => t[0]));
    expect(sideways.filter(t => t)).toEqual([]);
    expect(insets.at(-1)).toBe("0px");
    for (const inset of insets.slice(0, -1))
      AppearanceFixture.expectLook(inset, DefaultTheme.theme, "settings-content-inset", "padding-left");
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`stands each setting row the row gap after the one before it, the tabs' gap until the kit names one, with the hovered row's fill its own box, in the ${theme.id} theme in ${mode} mode`, async () => {
        settings.definitions.set([SettingsFixture.timeFormat, SettingsFixture.dateTimeFormat, ...SettingsFixture.all]);
        const host = render(mode);
        AppearanceFixture.apply(theme, mode);
        const rows = [...host.querySelectorAll(".nol-settings-rows")].map(t => [...t.querySelectorAll<HTMLElement>(":scope > nol-setting-row")]).filter(t => t.length > 1);
        const [first, second] = rows[0] ?? [];
        if (Object.isUndefined(first) || Object.isUndefined(second))
          throw new Error("No group shows two setting rows.");
        await userEvent.hover(first);
        const gaps = (): readonly number[] => rows.flatMap(t => t.slice(1).map((u, index) => u.getBoundingClientRect().top - DomFixture.present(t[index]).getBoundingClientRect().bottom));
        const tabs = host.appendChild(document.createElement("div"));
        tabs.style.width = "calc(2 * var(--nol-tab-inset))";
        const tabGap = tabs.getBoundingClientRect().width;
        tabs.remove();
        const kept = gaps();
        host.style.setProperty("--nol-row-gap", "0.5rem");
        const named = gaps();

        expect([getComputedStyle(first).backgroundColor, getComputedStyle(second).backgroundColor === getComputedStyle(first).backgroundColor])
          .toEqual([AppearanceFixture.readColor(theme, mode, "hover"), false]);
        for (const gap of kept)
          AppearanceFixture.expectPixels(gap, tabGap);
        for (const gap of named)
          AppearanceFixture.expectPixels(gap, AppearanceFixture.toPixels(0.5));
      });

  it("starts each group title, on a page and in search results, where its setting rows' headings start, inside their padding", async () => {
    const host = render();
    const offsets = (heading: string): readonly number[] => [...host.querySelectorAll(".nol-settings-group")].map(t => {
      const title = DomFixture.one(t, heading);
      const start = title.getBoundingClientRect().left + parseFloat(getComputedStyle(title).paddingInlineStart);
      return Math.round(start - DomFixture.one(t, ".nol-setting-row-heading").getBoundingClientRect().left);
    });

    const appearance = offsets(".nol-settings-group-title");
    await searchAsync("clock");
    const results = offsets(".nol-settings-result-group");

    expect([appearance.length > 1, results.length]).toEqual([true, 2]);
    expect([...appearance, ...results]).toEqual([...appearance, ...results].map(() => 0));
  });

  it("draws each group title, on a page and in search results, and each result's title at the kit's emphasis weight", async () => {
    const host = render();
    const weights = (selector: string): readonly string[] => [...host.querySelectorAll(selector)].map(t => {
      const style = getComputedStyle(t);
      return style.fontWeight === style.getPropertyValue("--nol-weight-emphasis").trim() ? "emphasis" : style.fontWeight;
    });

    const groups = weights(".nol-settings-group-title");
    await searchAsync("clock");
    const results = [...weights(".nol-settings-result-title"), ...weights(".nol-settings-result-group")];

    expect([groups.length > 1, results.length > 1]).toEqual([true, true]);
    expect([...groups, ...results]).toEqual([...groups, ...results].map(() => "emphasis"));
  });

  it("searches only for what its own field holds", async () => {
    render();
    await searchAsync("tick");

    fixture.debugElement.query(By.css(".nol-settings-search-field")).triggerEventHandler("input", { target: document.createElement("div") });
    fixture.detectChanges();

    expect(texts(".nol-settings-result-title")).toEqual(["Keyboard shortcuts", "Clock"]);
  });

  it("shows the Gallery as the last page when the build has one, and leaves it out of a search", async () => {
    gallery = FakeGalleryComponent;
    render();
    const pages = texts(".nol-tree-label");

    await page.getByRole("treeitem", { name: "Gallery", exact: true }).click();
    fixture.detectChanges();
    const shown = [texts(".fake-gallery"), texts("[aria-selected=true]")];
    await searchAsync("tick");

    expect(pages).toEqual(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Gallery", "About"]);
    expect(shown).toEqual([["Controls"], ["Gallery"]]);
    expect(texts(".nol-settings-result-title")).toEqual(["Keyboard shortcuts", "Clock"]);
    expect(element().querySelector(".fake-gallery")).toBeNull();
  });

  it("lists every module the runtime reports with notification kinds on Notifications, whatever its parts, each checked while its notifications are on", async () => {
    render();
    await page.getByRole("treeitem", { name: "Notifications", exact: true }).click();
    fixture.detectChanges();
    const row = DomFixture.one(element(), "[data-setting='desktop.mutedModules']");
    const boxes = [...row.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].map(t => [t.closest("nol-checkbox")?.querySelector(".nol-checkbox-text")?.textContent?.trim(), t.checked]);

    await page.getByRole("checkbox", { name: "Notes notifications" }).click();

    expect(boxes).toEqual([["Notes notifications", true], ["Reminder notifications", true]]);
    expect(settings.calls).toEqual(["set desktop.mutedModules [\"notes\"]"]);
  });

  it("shows a module's own page after its module's settings page under its title, loading until its component loads, then the component with its part's context, and leaves it when the page goes away", async () => {
    let release: (type: Type<unknown>) => void = () => undefined;
    ownPages.set([accountEntry(() => new Promise(resolve => {
      release = resolve;
    }))]);
    render();
    const pages = texts(".nol-tree-label");
    await page.getByRole("treeitem", { name: "Account", exact: true }).click();
    fixture.detectChanges();
    const loading = [texts("h2.nol-settings-group-title"), element().querySelectorAll("nol-settings-page-host nol-spinner").length, pageContexts.length];
    release(FakeAccountComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const loaded = [texts("nol-settings-page-host h3"), element().querySelectorAll("nol-settings-page-host nol-spinner").length, texts("nol-settings-page-host .nol-setting-row-title")];
    ownPages.set([]);
    fixture.detectChanges();

    expect(pages).toEqual(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Account", "About"]);
    expect([loading, loaded]).toEqual([[["Account"], 1, 0], [["Signed in"], 0, ["Account", "Server", "Status", "Devices"]]]);
    expect(pageContexts).toHaveLength(1);
    expect(pageContexts[0]).toBe(pageContext);
    expect([texts(".nol-tree-label"), texts("[aria-selected=true]")]).toEqual([["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "About"], ["Appearance"]]);
  });

  it("shows its module's failure card on a module's own page while the module has failed, and a card naming the module, by its id while the runtime reports none, when the page's component fails to load, and reports that failure", async () => {
    const failure = new ModuleFailure("clock", "Clock", ModuleState.Failed, "Its window part failed to activate.", []);
    ownPages.set([
      new SettingsPageEntry("clock.account", "Account", "clock", null, null, failure),
      new SettingsPageEntry("notes.sync", "Sync", "notes", new SettingsPageContribution("notes.sync", () => Promise.reject(new Error("No chunk."))), pageContext, null),
      new SettingsPageEntry("radio.tuning", "Tuning", "radio", new SettingsPageContribution("radio.tuning", () => Promise.reject(new Error("No tuner."))), pageContext, null)
    ]);
    render();
    const shownAsync = async (title: string): Promise<readonly (readonly string[])[]> => {
      await page.getByRole("treeitem", { name: title, exact: true }).click();
      await fixture.whenStable();
      fixture.detectChanges();
      return [texts(".nol-module-failure-card-title"), texts(".nol-module-failure-card-cause")];
    };

    const account = await shownAsync("Account");
    const sync = await shownAsync("Sync");
    const tuning = await shownAsync("Tuning");

    expect([account[1], sync[1], tuning[1], account[0]?.some(t => t.includes("Clock")), sync[0]?.some(t => t.includes("Notes")), tuning[0]?.some(t => t.includes("radio"))])
      .toEqual([["Its window part failed to activate."], ["Its settings page could not be loaded."], ["Its settings page could not be loaded."], true, true, true]);
    expect(errors.map(t => t instanceof WindowPartFailureException ? [t.moduleId, t.message, t.cause instanceof Error ? t.cause.message : null] : t))
      .toEqual([["notes", "Its settings page could not be loaded.", "No chunk."], ["radio", "Its settings page could not be loaded.", "No tuner."]]);
  });

  it("finds a module's own page by its title alone, offers to open it from the results, and opens it by its name when asked", async () => {
    ownPages.set([accountEntry()]);
    render();
    await searchAsync("signed in");
    const unmatched = texts(".nol-settings-result-title");
    await searchAsync("accou");
    const found = [texts(".nol-settings-result-title"), element().querySelectorAll("nol-settings-page-host").length];
    await page.getByRole("button", { name: "Open page" }).click();
    await fixture.whenStable();
    fixture.detectChanges();
    const opened = [texts("[aria-selected=true]"), texts("nol-settings-page-host h3")];
    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    TestBed.inject(SettingsPageService).open("clock.account");
    TestBed.tick();
    await fixture.whenStable();

    expect([unmatched, found, opened]).toEqual([[], [["Account"], 0], [["Account"], ["Signed in"]]]);
    expect(texts("[aria-selected=true]")).toEqual(["Account"]);
  });

  it("shows the settings that name a module's own page after its component, as far below it as Settings' groups are apart, and finds them on that page", async () => {
    const reminder = SettingsFixture.define("tasks.reminder", "Reminder text", "What a reminder says.", SettingType.text(20), "Due", "Account", "Tasks");
    settings.definitions.set([...SettingsFixture.all, reminder]);
    ownPages.set([accountEntry()]);
    render();
    const gapAfter = (above: Element, below: Element): number => Math.round((below.getBoundingClientRect().top - above.getBoundingClientRect().bottom) * 10) / 10;
    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    fixture.detectChanges();
    const [ticks, words] = [...element().querySelectorAll(".nol-settings-column > .nol-settings-group")];
    if (Object.isUndefined(ticks) || Object.isUndefined(words))
      throw new Error("Clock shows fewer than two groups.");
    const apart = gapAfter(ticks, words);
    await page.getByRole("treeitem", { name: "Account", exact: true }).click();
    await fixture.whenStable();
    fixture.detectChanges();
    const shown = [texts(".nol-tree-label"), texts(".nol-settings-column > .nol-settings-group > h2.nol-settings-group-title"),
      gapAfter(DomFixture.one(element(), "nol-settings-page-host"), DomFixture.one(element(), ".nol-settings-column > .nol-settings-group"))];
    await searchAsync("reminder");
    const found = [texts(".nol-settings-result-title"), texts(".nol-settings-result-group"), texts(".nol-settings-result .nol-setting-row-title"),
      element().querySelectorAll(".nol-settings-result button").length, element().querySelectorAll("nol-settings-page-host").length];

    expect(apart).toBeGreaterThan(0);
    expect(shown).toEqual([["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Account", "About"], ["Tasks"], apart]);
    expect(found).toEqual([["Account"], ["Tasks"], ["Reminder text"], 1, 0]);
  });

  it("opens a module's own page asked for by its name before it is listed once it is listed", async () => {
    render();
    TestBed.inject(SettingsPageService).open("clock.account");
    TestBed.tick();
    await fixture.whenStable();
    const before = texts("[aria-selected=true]");
    ownPages.set([accountEntry()]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect([before, texts("[aria-selected=true]"), texts("h2.nol-settings-group-title")]).toEqual([["Appearance"], ["Account"], ["Account"]]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`starts General's groups, a setting row's heading, Keyboard shortcuts' heading, explanation and table and a module page's first element at one edge, and ends the search field and a page's rows at the content area's end, at 150rem and 60rem in the ${theme.id} theme in ${mode} mode`, async () => {
        settings.definitions.set([SettingsFixture.timeFormat, SettingsFixture.dateTimeFormat, ...SettingsFixture.all]);
        ownPages.set([accountEntry(() => Promise.resolve(FakePlainAccountComponent))]);
        const host = render(mode);
        AppearanceFixture.apply(theme, mode);
        const column = DomFixture.one(host, ".nol-settings-column");
        const content = DomFixture.one(host, ".nol-settings-content");
        const textLeft = (selector: string): number => {
          const range = document.createRange();
          range.selectNodeContents(DomFixture.one(host, selector));
          return range.getBoundingClientRect().left;
        };
        const openAsync = async (title: string): Promise<void> => {
          await page.getByRole("treeitem", { name: title, exact: true }).click();
          await fixture.whenStable();
          fixture.detectChanges();
        };
        const measureAsync = async (width: string): Promise<readonly (readonly number[])[]> => {
          host.style.width = width;
          await openAsync("General");
          const general = textLeft(".nol-settings-group-title");
          const columnBox = column.getBoundingClientRect();
          const contentEnd = content.getBoundingClientRect().left + content.clientWidth;
          const end = columnBox.right - parseFloat(getComputedStyle(column).paddingRight);
          const ends = [columnBox.right - contentEnd, DomFixture.one(host, ".nol-settings-search-field").getBoundingClientRect().right - end];
          await openAsync("Appearance");
          ends.push(DomFixture.one(host, "nol-setting-row").getBoundingClientRect().right - end);
          const rowHeading = DomFixture.one(host, ".nol-setting-row-heading").getBoundingClientRect().left;
          await openAsync("Keyboard shortcuts");
          const starts = [rowHeading, ...[".nol-settings-group-title", ".nol-configuration-table-explanation", ".nol-shortcuts-table th"].map(textLeft)];
          await openAsync("Account");
          starts.push(textLeft(".fake-plain"));
          return [starts.map(t => t - general), ends].map(t => t.map(u => Math.round(u)));
        };

        const edges = [await measureAsync("150rem"), await measureAsync("60rem")];

        expect(edges).toEqual(edges.map(() => [[0, 0, 0, 0, 0], [0, 0, 0]]));
      });

  for (const mode of AppearanceFixture.modes)
    it(`leaves Settings' margin before the page list and the search field and after the search field and a page's rows, and before the rows once the list is a select, whether the page scrolls or not, at 150rem, 60rem and below 37rem in ${mode} mode`, async () => {
      settings.definitions.set([SettingsFixture.timeFormat, SettingsFixture.dateTimeFormat, ...SettingsFixture.all]);
      const host = render(mode);
      await page.getByRole("treeitem", { name: "Appearance", exact: true }).click();
      fixture.detectChanges();
      const content = DomFixture.one(host, ".nol-settings-content");
      const search = DomFixture.one(host, ".nol-settings-search");
      const margin = AppearanceFixture.toPixels(1.5);
      const measure = (width: string, height: string): readonly unknown[] => {
        host.style.width = width;
        host.style.height = height;
        const edges = host.getBoundingClientRect();
        const row = DomFixture.one(host, "nol-setting-row").getBoundingClientRect();
        const isNarrow = getComputedStyle(DomFixture.one(host, ".nol-settings-pages")).display === "none";
        const start = Math.min(...[...search.children].filter(t => getComputedStyle(t).display !== "none").map(t => t.getBoundingClientRect().left));
        const gaps = [start - edges.left, edges.right - DomFixture.one(host, ".nol-settings-search-field").getBoundingClientRect().right, edges.right - row.right];
        if (isNarrow)
          gaps.push(row.left - edges.left);
        else
          gaps.push(DomFixture.one(host, ".nol-settings-pages").getBoundingClientRect().left - edges.left);
        return [content.scrollHeight > content.clientHeight, ...gaps.map(t => Math.round(t - margin) + 0)];
      };

      const shown = ["150rem", "60rem", "calc(37rem - 1px)"].flatMap(width => ["12rem", "200rem"].map(height => measure(width, height)));

      expect(shown).toEqual(["150rem", "60rem", "narrow"].flatMap(() => [[true, 0, 0, 0, 0], [false, 0, 0, 0, 0]]));
    });

  for (const mode of AppearanceFixture.modes)
    it(`finds the rows a module's page gives by their titles and descriptions, lists them under the page's result at Settings' edge, and opens one scrolled into view and marked until the person searches again or leaves the page, in ${mode} mode`, async () => {
      const context = new WindowPartContext(pageSource, new WindowPartContextHostFixture());
      ownPages.set([new SettingsPageEntry("clock.account", "Account", "clock", new SettingsPageContribution("clock.account", () => Promise.resolve(FakeRowsComponent)), context, null)]);
      context.setSettingsRows("clock.account", [new SettingsRow("clock.account.row35", "Run and stop a turn", "Stops the agent's turn when you ask."), new SettingsRow("clock.account.row36", "Turn sounds")]);
      const host = render(mode, "30rem");
      host.style.width = "100rem";
      const content = DomFixture.one(host, ".nol-settings-content");
      const textLeft = (element: Element): number => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return Math.round(range.getBoundingClientRect().left);
      };
      await searchAsync("turn");
      const found = [texts(".nol-settings-found-row-open"), texts(".nol-settings-found-row-description")];
      const edges = [DomFixture.one(host, ".nol-settings-found-row-open nol-highlighted-text"), DomFixture.one(host, ".nol-settings-found-row-description")].map(t => textLeft(t) - textLeft(DomFixture.one(host, ".nol-settings-result-title")));
      await searchAsync("when you ask");
      const byDescription = texts(".nol-settings-found-row-open");
      await searchAsync("turn");
      await userEvent.click(DomFixture.one(host, ".nol-settings-found-row-open"));
      await fixture.whenStable();
      fixture.detectChanges();
      const row = DomFixture.one(host, "[data-setting='clock.account.row35']");
      await expect.poll(() => row.classList.contains("nol-setting-row-found")).toBe(true);
      const shown = [row.getBoundingClientRect().top >= content.getBoundingClientRect().top, row.getBoundingClientRect().bottom <= content.getBoundingClientRect().bottom, getComputedStyle(row).backgroundColor];
      await searchAsync("turn");
      const searched = row.classList.contains("nol-setting-row-found");

      expect([found, edges, byDescription]).toEqual([[["Run and stop a turn", "Turn sounds"], ["Stops the agent's turn when you ask."]], [0, 0], ["Run and stop a turn"]]);
      expect(shown).toEqual([true, true, AppearanceFixture.readColor(DefaultTheme.theme, mode, "selected")]);
      expect(searched).toBe(false);
    });

  it("unmarks an opened row when the person picks another page", async () => {
    const context = new WindowPartContext(pageSource, new WindowPartContextHostFixture());
    ownPages.set([new SettingsPageEntry("clock.account", "Account", "clock", new SettingsPageContribution("clock.account", () => Promise.resolve(FakeRowsComponent)), context, null)]);
    context.setSettingsRows("clock.account", [new SettingsRow("clock.account.row3", "Run and stop a turn")]);
    const host = render();
    await searchAsync("turn");
    await userEvent.click(DomFixture.one(host, ".nol-settings-found-row-open"));
    await fixture.whenStable();
    fixture.detectChanges();
    const row = DomFixture.one(host, "[data-setting='clock.account.row3']");
    await expect.poll(() => row.classList.contains("nol-setting-row-found")).toBe(true);
    await page.getByRole("treeitem", { name: "Appearance", exact: true }).click();

    expect(row.classList.contains("nol-setting-row-found")).toBe(false);
  });

  it("marks nothing when the opened page never draws the row it gave", async () => {
    const context = new WindowPartContext(pageSource, new WindowPartContextHostFixture());
    ownPages.set([new SettingsPageEntry("clock.account", "Account", "clock", new SettingsPageContribution("clock.account", () => Promise.resolve(FakeRowsComponent)), context, null)]);
    context.setSettingsRows("clock.account", [new SettingsRow("clock.account.missing", "Run and stop a turn")]);
    const host = render();
    await searchAsync("turn");
    await userEvent.click(DomFixture.one(host, ".nol-settings-found-row-open"));
    await fixture.whenStable();
    fixture.detectChanges();
    await expect.poll(() => host.querySelectorAll("[data-setting^='clock.account.row']").length).toBe(40);

    expect(host.querySelectorAll(".nol-setting-row-found").length).toBe(0);
  });

  it("marks the opened page's row, not the shortcut row the same search found with the same name", async () => {
    const context = new WindowPartContext(pageSource, new WindowPartContextHostFixture());
    ownPages.set([new SettingsPageEntry("clock.account", "Account", "clock", new SettingsPageContribution("clock.account", () => Promise.resolve(FakeRowsComponent)), context, null)]);
    context.setSettingsRows("clock.account", [new SettingsRow("clock.tick", "Tick the clock")]);
    const host = render();
    await searchAsync("tick");
    const shortcut = host.querySelector("tr[data-setting='clock.tick']");
    await userEvent.click(DomFixture.one(host, ".nol-settings-found-row-open"));
    await fixture.whenStable();
    fixture.detectChanges();
    const row = DomFixture.one(host, "div[data-setting='clock.tick']");
    await expect.poll(() => row.classList.contains("nol-setting-row-found")).toBe(true);

    expect([shortcut?.classList.contains("nol-setting-row-found"), host.querySelectorAll(".nol-setting-row-found").length]).toEqual([false, 1]);
  });

  it("opens Keyboard shortcuts at the command a request names, with its row scrolled into view and marked", async () => {
    const host = render(ThemeMode.Light, "20rem");
    await page.getByRole("treeitem", { name: "Keyboard shortcuts", exact: true }).click();
    fixture.detectChanges();
    const name = [...host.querySelectorAll("tr[data-setting]")].at(-1)?.getAttribute("data-setting") ?? String.empty;
    await page.getByRole("treeitem", { name: "Appearance", exact: true }).click();
    fixture.detectChanges();
    TestBed.inject(SettingsPageService).open("Keyboard shortcuts", name);
    fixture.detectChanges();
    await fixture.whenStable();
    const row = DomFixture.one(host, `tr[data-setting='${name}']`);
    const content = DomFixture.one(host, ".nol-settings-content").getBoundingClientRect();

    expect([row.classList.contains("nol-setting-row-found"), row.getBoundingClientRect().top >= content.top, row.getBoundingClientRect().bottom <= content.bottom])
      .toEqual([true, true, true]);
    expect(getComputedStyle(row).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "selected"));
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`lays out a module's own page drawn with Settings' public classes as Settings lays out its own groups and rows, in the ${theme.id} theme in ${mode} mode`, async () => {
        settings.definitions.set([SettingsFixture.timeFormat, SettingsFixture.dateTimeFormat, ...SettingsFixture.all]);
        ownPages.set([accountEntry()]);
        const host = render(mode);
        AppearanceFixture.apply(theme, mode);
        const measureAsync = async (root: ParentNode): Promise<readonly (string | number)[]> => {
          const group = [...root.querySelectorAll<HTMLElement>(".nol-settings-group")].find(t => t.querySelectorAll(".nol-setting-row").length > 1);
          const [first, second] = [...group?.querySelectorAll<HTMLElement>(".nol-setting-row") ?? []];
          if (Object.isUndefined(group) || Object.isUndefined(first) || Object.isUndefined(second))
            throw new Error("No group shows two rows.");
          await userEvent.hover(first);
          const heading = DomFixture.one(first, ".nol-setting-row-heading").getBoundingClientRect();
          const title = DomFixture.one(group, ".nol-settings-group-title");
          const style = (selector: string): CSSStyleDeclaration => getComputedStyle(DomFixture.one(first, selector));
          const row = first.getBoundingClientRect();
          return [
            getComputedStyle(first).backgroundColor, getComputedStyle(second).backgroundColor, getComputedStyle(first).borderRadius,
            heading.left - row.left, heading.top - row.top, heading.height, second.getBoundingClientRect().top - row.bottom,
            title.getBoundingClientRect().left + parseFloat(getComputedStyle(title).paddingInlineStart) - heading.left, row.top - title.getBoundingClientRect().bottom,
            getComputedStyle(title).fontWeight, getComputedStyle(title).fontSize, getComputedStyle(title).color,
            style(".nol-setting-row-title").fontWeight, style(".nol-setting-row-title").color,
            style(".nol-setting-row-description").marginTop, style(".nol-setting-row-description").color, style(".nol-setting-row-control").marginTop
          ].map(t => Object.isNumber(t) ? Math.round(t * 10) / 10 : t);
        };

        const own = await measureAsync(host);
        await page.getByRole("treeitem", { name: "Account", exact: true }).click();
        await fixture.whenStable();
        fixture.detectChanges();
        const module = await measureAsync(DomFixture.one(host, "nol-settings-page-host"));

        expect([own[0], own[1] === own[0]]).toEqual([AppearanceFixture.readColor(theme, mode, "hover"), false]);
        expect(module).toEqual(own);
      });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`shows the hover background on a module page's rows with a field or a details summary and none on its row with nothing to click, with and without forced colors, in the ${theme.id} theme in ${mode} mode`, async () => {
        ownPages.set([accountEntry()]);
        const host = render(mode);
        AppearanceFixture.apply(theme, mode);
        await page.getByRole("treeitem", { name: "Account", exact: true }).click();
        await fixture.whenStable();
        fixture.detectChanges();
        const row = (title: string): HTMLElement => {
          const found = [...host.querySelectorAll<HTMLElement>("nol-settings-page-host .nol-setting-row")].find(t => t.querySelector(".nol-setting-row-title")?.textContent === title);
          if (Object.isUndefined(found))
            throw new Error(`The page shows no row ${title}.`);
          return found;
        };
        const measureAsync = async (title: string): Promise<readonly [string, string]> => {
          const resting = getComputedStyle(row(title)).backgroundColor;
          await userEvent.hover(row(title));
          return [resting, getComputedStyle(row(title)).backgroundColor];
        };

        const [plain, plainControl, plainSummary] = [await measureAsync("Status"), await measureAsync("Account"), await measureAsync("Devices")];
        await MediaFixture.forceColorsAsync("active");
        try {
          const [forced, forcedControl, forcedSummary] = [await measureAsync("Status"), await measureAsync("Account"), await measureAsync("Devices")];
          const hover = AppearanceFixture.readColor(theme, mode, "hover");

          expect([plain[1], plainControl[1], plainSummary[1]]).toEqual([plain[0], hover, hover]);
          expect([forced[1] === forced[0], forcedControl[1] === forcedControl[0], forcedSummary[1] === forcedSummary[0]]).toEqual([true, false, false]);
        }
        finally {
          await MediaFixture.forceColorsAsync("none");
        }
      });

  it("returns to the first page when the chosen page goes away with its module", async () => {
    render();
    await page.getByRole("treeitem", { name: "Clock" }).click();
    fixture.detectChanges();

    settings.definitions.set(SettingsFixture.all.filter(t => t.name.owner !== "clock"));
    fixture.detectChanges();

    expect([texts(".nol-tree-label"), texts(".nol-settings-group-title")]).toEqual([["Appearance", "Notifications", "Keyboard shortcuts", "About"], ["Theme", "Text"]]);
  });

  it("shows every command's owner and key on Keyboard shortcuts, a key another command kept, and the person's bindings as modified", async () => {
    settings.values.update(t => new Map([...t, ["desktop.keyBindings", { "desktop.closeTab": null }]]));
    render();

    await page.getByRole("treeitem", { name: "Keyboard shortcuts" }).click();
    fixture.detectChanges();
    const rows = [...element().querySelectorAll("tbody tr")].map(t => [t.getAttribute("data-command"), ...[...t.querySelectorAll("td")].map(u => u.textContent?.trim())]);

    expect(texts("th")).toEqual(["Command", "From", "Key", String.empty]);
    expect(rows.filter(t => t[0]?.startsWith("clock."))).toEqual([
      ["clock.tick", "Tick the clockclock.tick", "Clock", "Ctrl+Alt+T", "Remove"],
      ["clock.stop", "Stop the clockclock.stop", "Clock", "No keyCtrl+Alt+T is taken by Tick the clock", String.empty]
    ]);
    expect(rows.find(t => t[0] === "desktop.openSettings")?.slice(1, 3)).toEqual(["Settings…desktop.openSettings", "Noldova Desktop Sample"]);
    expect(rows.find(t => t[0] === "desktop.closeTab")?.slice(3)).toEqual(["No key", "Reset"]);
    expect(element().querySelector("[data-command='desktop.closeTab'] .nol-shortcut-marker")?.getAttribute("aria-label")).toBe("Modified");
  });

  it("finds a command by a part of its id found only there, and underlines that part in the id under its title", async () => {
    render();

    await searchAsync("bu");
    const split = element().querySelector("[data-command='desktop.splitTabUp']");

    expect([split?.querySelector(".nol-shortcut-title")?.textContent?.trim(), split?.querySelector(".nol-shortcut-name")?.textContent]).toEqual(["Split the tab up", "desktop.splitTabUp"]);
    expect([...split?.querySelectorAll(".nol-shortcut-name mark") ?? []].map(t => t.textContent)).toEqual(["bU"]);
    expect([".nol-shortcut-title", ".nol-shortcut-owner", ".nol-shortcut-key"].map(t => split?.querySelectorAll(`${t} mark`).length)).toEqual([0, 0, 0]);
  });

  it("finds commands by their owner", async () => {
    render();

    await searchAsync("Noldova Desktop Sample");
    const found = [...element().querySelectorAll("tbody tr")].map(t => String(t.getAttribute("data-command")));

    expect(found.length).toBeGreaterThan(0);
    expect(found.every(t => t.startsWith("desktop."))).toBe(true);
  });

  it("searches every page by title, description and name, grouping the hits by page and marking them, and leaves the search when a page is chosen", async () => {
    render();

    await searchAsync("clock");
    const hits = { pages: texts(".nol-settings-result-title"), groups: texts(".nol-settings-result-group"), rows: texts(".nol-setting-row-title"), marks: texts("mark").length };
    await searchAsync("nothing like this");
    const empty = texts(".nol-settings-empty");
    await searchAsync("size");
    const current = texts("[aria-selected=true]");
    await page.getByRole("treeitem", { name: "Appearance" }).click();
    fixture.detectChanges();

    expect(hits).toEqual({ pages: ["Keyboard shortcuts", "Clock"], groups: ["Words", "Ticks"], rows: ["Greeting", "Tick step"], marks: 10 });
    expect(empty).toEqual(["No settings match your search."]);
    expect(current).toEqual([]);
    expect([DomFixture.oneOf(element(), ".nol-settings-search-field", HTMLInputElement).value, texts(".nol-settings-result-title")]).toEqual([String.empty, []]);
  });

  it("offers the main process's spelling languages on the Spelling languages row and says which one checks words when none of the device's languages is offered", async () => {
    bridge.spelling = Promise.resolve({ languages: ["en-US"], fallback: "en-US" });
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.spellCheckLanguages]);
    render();
    await fixture.whenStable();
    fixture.detectChanges();
    const row = DomFixture.one(element(), "[data-setting='desktop.spellCheckLanguages']");

    expect([...row.querySelectorAll(".nol-checkbox-text")].map(t => t.textContent?.trim())).toEqual(["English (United States)"]);
    expect(row.querySelector(".nol-setting-row-note")?.textContent).toBe("None of this device's languages has a dictionary here, so words are checked in English (United States).");
  });

  it("notes on the tray icon's row while the main process shows no tray icons, drops the note once it does, and ignores a report that is not a yes or no", async () => {
    bridge.trayAvailable = Promise.resolve(false);
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.trayIcon]);
    render();
    await fixture.whenStable();
    await searchAsync("tray");
    const note = (): string | null | undefined => element().querySelector("[data-setting='desktop.trayIcon'] .nol-setting-row-note")?.textContent;

    const unavailable = note();
    bridge.changeTrayAvailable(true);
    fixture.detectChanges();
    const available = note();
    bridge.changeTrayAvailable(false);
    bridge.changeTrayAvailable("yes");
    fixture.detectChanges();

    expect(unavailable).toBe("This main process shows no tray icons right now, so the icon appears once it does. On GNOME, turning on the AppIndicator extension adds them.");
    expect(available).toBeUndefined();
    expect(note()).toBe(unavailable);
    expect(element().querySelectorAll(".nol-setting-row-note").length).toBe(1);
  });

  it("reports a failure to read whether the main process shows tray icons and adds no note for it", async () => {
    const failure = new Error("The main process did not answer.");
    bridge.trayAvailable = Promise.reject(failure);
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.trayIcon]);
    render();
    await fixture.whenStable();
    await searchAsync("tray");

    expect(errors).toEqual([failure]);
    expect(element().querySelector("[data-setting='desktop.trayIcon'] .nol-setting-row-note")).toBeNull();
  });

  it("runs an action's command from its row, stores nothing, and finds the row by its label", async () => {
    const runs: string[] = [];
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.alarms]);
    TestBed.inject(CommandService).setCommands([new CommandContribution("clock.openAlarms", "Open alarms", null, null, async () => {
      runs.push("clock.openAlarms");
      return null;
    })]);
    render();

    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    fixture.detectChanges();
    await page.getByRole("button", { name: "Open alarms" }).click();
    await searchAsync("open alarms");

    expect(runs).toEqual(["clock.openAlarms"]);
    expect(settings.calls).toEqual([]);
    expect([texts(".nol-settings-result-title"), texts(".nol-setting-row-title")]).toEqual([["Keyboard shortcuts", "Clock"], ["Alarms"]]);
  });

  it("disables an action while its command is not registered, as for a module that failed", async () => {
    settings.definitions.set([...SettingsFixture.all, SettingsFixture.alarms]);
    render();

    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    fixture.detectChanges();

    expect(element().querySelector<HTMLButtonElement>("[data-setting=\"clock.alarms\"] .nol-setting-row-control button")?.disabled).toBe(true);
  });

  it("moves the focus from a Reset that goes away to its row's control, the selected one of its pills", async () => {
    render();

    await page.getByRole("button", { name: "Reset Mode" }).click();

    expect(DomFixture.one(element(), "[data-setting='desktop.mode'] .nol-setting-row-control").contains(document.activeElement)).toBe(true);
    expect([document.activeElement?.getAttribute("role"), document.activeElement?.textContent?.trim()]).toEqual(["radio", "Dark"]);
  });

  it("moves the focus from Open page to the opened page's first control once it loads, and to the page list when that page has none", async () => {
    const notice = new SettingsPageEntry("clock.notice", "Notice", "clock", new SettingsPageContribution("clock.notice", () => Promise.resolve(FakeNoticeComponent)), pageContext, null);
    ownPages.set([accountEntry(), notice]);
    render();
    const focused = (): string | null => {
      const active = document.activeElement;
      if (Object.isNull(active))
        return null;
      if (!Object.isNull(active.closest("nol-settings-page-host")))
        return active.tagName.toLowerCase();
      return DomFixture.one(element(), ".nol-settings-pages").contains(active) ? "pages" : null;
    };
    const openAsync = async (query: string): Promise<readonly [readonly string[], string | null]> => {
      await searchAsync(query);
      await page.getByRole("button", { name: "Open page" }).click();
      await expect.poll(focused).not.toBeNull();
      return [texts("[aria-selected=true]"), focused()];
    };

    const opened = await openAsync("accou");
    const empty = await openAsync("notic");

    expect(opened).toEqual([["Account"], "input"]);
    expect(empty).toEqual([["Notice"], "pages"]);
  });

  describe("while a page opened from the results loads", () => {
    let gates: (() => void)[];
    let field: HTMLInputElement;

    const loadAsync = async (): Promise<string> => {
      await expect.poll(() => {
        gates.splice(0).forEach(t => t());
        fixture.detectChanges();
        return element().querySelector("nol-settings-page-host input");
      }).not.toBeNull();
      await fixture.whenStable();
      const active = document.activeElement;
      return active === field ? "search" : active === document.body ? "body" : active?.tagName.toLowerCase() ?? "none";
    };
    const blur = (): void => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    };

    beforeEach(async () => {
      gates = [];
      ownPages.set([accountEntry(() => new Promise(resolve => {
        gates.push(() => resolve(FakeAccountComponent));
      }))]);
      render();
      field = DomFixture.oneOf(element(), ".nol-settings-search-field", HTMLInputElement);
      await searchAsync("accou");
      await page.getByRole("button", { name: "Open page" }).click();
    });

    it("leaves the focus where the person moved it", async () => {
      field.focus();

      expect(await loadAsync()).toBe("search");
    });

    it("moves the focus nowhere once the person picked another page", async () => {
      await page.getByRole("treeitem", { name: "Appearance", exact: true }).click();
      blur();
      TestBed.inject(SettingsPageService).open("clock.account");
      TestBed.tick();

      expect(await loadAsync()).toBe("body");
    });

    it("moves the focus nowhere once the person searched", async () => {
      for (const text of ["x", String.empty]) {
        field.value = text;
        field.dispatchEvent(new Event("input"));
        fixture.detectChanges();
      }
      blur();

      expect(await loadAsync()).toBe("body");
    });
  });

  it("changes and resets a setting through the settings service, and reports a change or reset that fails", async () => {
    render();

    await page.getByRole("button", { name: "Reset Mode" }).click();
    settings.failure = new Error("The runtime refused the value.");
    const size = DomFixture.oneOf(element(), "[data-setting='desktop.panelSize'] input", HTMLInputElement);
    size.value = "15";
    size.dispatchEvent(new Event("change"));
    await page.getByRole("button", { name: "Reset Mode" }).click();
    await expect.poll(() => errors.length).toBe(2);

    expect(settings.calls).toEqual(["reset desktop.mode", "set desktop.panelSize 15", "reset desktop.mode"]);
    expect(errors.map(t => t instanceof Error ? t.message : t)).toEqual(["The runtime refused the value.", "The runtime refused the value."]);
  });

  it("shows About last, with Noldova Desktop Sample's version above its Updates group, finds its setting in a search, and shows the page a command asks for", async () => {
    settings.definitions.set([SettingsFixture.updateChecks, ...SettingsFixture.all]);
    render();
    await fixture.whenStable();
    bridge.publishUpdate({ kind: "UpToDate", version: null, progress: null, checkedAt: null, reason: null, mustMove: false });
    await fixture.whenStable();
    const pages = texts(".nol-tree-label");

    TestBed.inject(SettingsPageService).open("About");
    TestBed.tick();
    await fixture.whenStable();
    const about = [texts("[aria-selected=true]"), texts(".nol-about-title"), texts(".nol-settings-group-title"), texts(".nol-setting-row-title")];
    const requested = TestBed.inject(SettingsPageService).requested();
    await page.getByRole("treeitem", { name: "Clock", exact: true }).click();
    TestBed.inject(SettingsPageService).open("About");
    TestBed.tick();
    await fixture.whenStable();
    const again = texts("[aria-selected=true]");
    await searchAsync("updates");

    expect(pages).toEqual(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "About"]);
    expect(about).toEqual([["About"], ["Noldova Desktop Sample 1.2.3"], ["Updates"], ["Check for updates"]]);
    expect([requested, again]).toEqual([null, ["About"]]);
    expect([texts(".nol-settings-result-title"), texts(".nol-setting-row-title"), element().querySelector("nol-about")]).toEqual([["Keyboard shortcuts", "About"], ["Check for updates"], null]);
  });

  it("opens at a setting a search asks for, scrolling its row into view and focusing its control, and only shows the page for a setting it doesn't list", async () => {
    settings.definitions.set(SettingsFixture.all);
    render(ThemeMode.Light, "8rem");
    await fixture.whenStable();
    const pages = TestBed.inject(SettingsPageService);

    pages.open("Appearance", "desktop.panelSize");
    TestBed.tick();
    await fixture.whenStable();
    const row = element().querySelector("[data-setting=\"desktop.panelSize\"]");
    const list = element().querySelector(".nol-settings-content");
    const [rowBox, listBox] = [row?.getBoundingClientRect(), list?.getBoundingClientRect()];

    expect([texts("[aria-selected=true]"), row?.contains(document.activeElement)]).toEqual([["Appearance"], true]);
    const shown = Math.min(rowBox?.bottom ?? 0, listBox?.bottom ?? 0) - Math.max(rowBox?.top ?? 0, listBox?.top ?? 0);
    expect(shown >= Math.min(rowBox?.height ?? 1, listBox?.height ?? 1) - 1, JSON.stringify([rowBox, listBox])).toBe(true);
    pages.open("Notifications", "desktop.missing");
    TestBed.tick();
    await fixture.whenStable();
    expect([texts("[aria-selected=true]"), pages.requested()]).toEqual([["Notifications"], null]);
  });

  it("leaves the Updates group out of About and out of a search while the build turns updates off", async () => {
    settings.definitions.set([SettingsFixture.updateChecks, ...SettingsFixture.all]);
    render();
    await fixture.whenStable();

    TestBed.inject(SettingsPageService).open("About");
    TestBed.tick();
    await fixture.whenStable();
    const about = [texts("[aria-selected=true]"), texts(".nol-about-status span"), texts(".nol-settings-group-title"), texts(".nol-setting-row-title")];
    await searchAsync("updates");

    expect(about).toEqual([["About"], ["Updates are turned off in this build."], [], []]);
    expect([texts(".nol-settings-result-title"), texts(".nol-setting-row-title")]).toEqual([["Keyboard shortcuts"], []]);
  });

  it("follows the component table for the page list and headings", () => {
    render();
    const current = getComputedStyle(DomFixture.oneOf(element(), ".nol-tree-row-current", Element));
    const heading = getComputedStyle(DomFixture.oneOf(element(), ".nol-settings-group-title", Element));

    expect(current.backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "selected"));
    AppearanceFixture.expectLook(current.minHeight, DefaultTheme.theme, "tree-row-height", "min-height");
    AppearanceFixture.expectLook(getComputedStyle(DomFixture.oneOf(element(), ".nol-settings-pages", Element)).width, DefaultTheme.theme, "settings-pages-width", "width");
    expect(heading.marginTop).toBe("0px");
    AppearanceFixture.expectLook(heading.marginBottom, DefaultTheme.theme, "settings-heading-space", "margin-bottom");
    AppearanceFixture.expectLook(heading.paddingLeft, DefaultTheme.theme, "settings-item-padding", "padding-left", "padding");
    expect(heading.fontWeight).toBe(heading.getPropertyValue("--nol-weight-emphasis").trim());
    expect(heading.fontSize).toBe(`${parseFloat(getComputedStyle(document.body).fontSize) * 2}px`);
    expect(heading.color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "setting-title"));
  });
});
