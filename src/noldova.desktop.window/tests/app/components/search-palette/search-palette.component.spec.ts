/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ErrorHandler, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type {} from "@vitest/browser-playwright";

import { AppearanceService, DefaultTheme, ModePreference, QuickInputComponent, QuickInputItem, type Theme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { SearchPaletteComponent } from "../../../../src/app/components/search-palette/search-palette.component";
import { SearchAnswer } from "../../../../src/app/models/search-answer";
import { SearchRequest } from "../../../../src/app/models/search-request";
import { SearchResult } from "../../../../src/app/models/search-result";
import { SearchSession } from "../../../../src/app/models/search-session";
import { SearchSourceContribution } from "../../../../src/app/models/search-source-contribution";
import { TextRange } from "../../../../src/app/models/text-range";
import { SearchPaletteService } from "../../../../src/app/services/search-palette.service";
import { SearchService } from "../../../../src/app/services/search.service";
import { DomFixture } from "../../../fixtures/dom.fixture";
import { MediaFixture } from "../../../fixtures/media.fixture";

describe("SearchPaletteComponent", () => {
  let opened: string[];
  let closes: number;
  let errors: unknown[];
  let request: SearchRequest;

  const result = (id: string, title: string, openAsync: () => Promise<void> = () => {
    opened.push(id);
    return Promise.resolve();
  }): SearchResult => new SearchResult(id, title, `In ${id.split(".")[0] ?? String.empty}`, openAsync, new TextRange(0, Math.min(title.length, 4)));

  const chats = new SearchSourceContribution("chat.chats", "Chats", "chats", "In Chats", "Recent chats", "forum",
    () => Promise.resolve([result("chat.fix", "Fix toMiles")]),
    query => Promise.resolve(new SearchAnswer(["Terminal tab freezes", "Open a terminal per teammate", "Terminal fonts"].filter(t => t.toLowerCase().includes(query)).map((t, index) => result(`chat.${index}`, t)), 7)));
  const failing = new SearchSourceContribution("chat.messages", "Messages", "messages", "In Messages", null, "chat",
    () => Promise.resolve([]), query => Promise.resolve(new SearchAnswer("terminal is broken".includes(query) ? [result("chat.broken", "Terminal is broken", () => Promise.reject(new Error("The chat is gone.")))] : [])));
  const commands = new SearchSourceContribution("desktop.commands", "Commands", "commands", "In Commands", "Recent commands", "terminal",
    () => Promise.resolve([]), query => Promise.resolve(new SearchAnswer(["Toggle terminal", "New terminal"].filter(t => t.toLowerCase().includes(query)).map((t, index) => result(`desktop.${index}`, t)))));

  beforeEach(() => {
    opened = [];
    closes = 0;
    errors = [];
    request = SearchRequest.plain;
    TestBed.configureTestingModule({
      providers: [
        { provide: SearchService, useValue: { placeholder: signal("Search chats, messages and commands"), createSession: () => new SearchSession([chats, failing, commands], "desktop.commands", () => undefined) } },
        { provide: SearchPaletteService, useValue: { get request(): SearchRequest {
          return request;
        }, close: () => closes++ } },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
  });

  afterEach(() => {
    AppearanceFixture.reset();
  });

  function apply(theme: Theme = DefaultTheme.theme, mode: ThemeMode = ThemeMode.Light): void {
    AppearanceFixture.apply(theme, mode);
    const appearance = TestBed.inject(AppearanceService);
    appearance.setTheme(theme);
    appearance.setModePreference(mode === ThemeMode.Dark ? ModePreference.Dark : ModePreference.Light);
  }

  async function settle(fixture: ComponentFixture<SearchPaletteComponent>, isReady: (host: HTMLElement) => boolean = () => true): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(isReady(DomFixture.host(fixture))).toBe(true);
    });
    await fixture.whenStable();
  }

  function hasAnswered(host: HTMLElement): boolean {
    return ["chat.chats/chat.0", "chat.messages/chat.broken", "desktop.commands/desktop.1"].every(t => !Object.isNull(host.querySelector(`[data-item='${t}']`)));
  }

  async function renderAsync(isReady: (host: HTMLElement) => boolean = host => !Object.isNull(host.querySelector("[role=option]"))): Promise<ComponentFixture<SearchPaletteComponent>> {
    const fixture = TestBed.createComponent(SearchPaletteComponent);
    DomFixture.host(fixture).style.width = "40rem";
    fixture.detectChanges();
    await settle(fixture, isReady);
    return fixture;
  }

  async function typeAsync(fixture: ComponentFixture<SearchPaletteComponent>, text: string, isReady: (host: HTMLElement) => boolean = hasAnswered): Promise<void> {
    const field = DomFixture.oneOf(DomFixture.host(fixture), ".nol-quick-input-field", HTMLInputElement);
    field.value = text;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(fixture, isReady);
  }

  function headings(host: HTMLElement): string[] {
    return [...host.querySelectorAll(".nol-quick-input-heading")].map(t => String(t.textContent).trim());
  }

  function filters(host: HTMLElement): (string | null)[][] {
    return [...host.querySelectorAll<HTMLButtonElement>(".nol-search-filter")].map(t => [t.getAttribute("data-source"), [...t.childNodes].filter(u => u.nodeType !== Node.COMMENT_NODE).map(u => String(u.textContent).trim()).filter(u => u.length > 0).join(" "), t.getAttribute("aria-pressed")]);
  }

  it("names its field after the sources, shows their recent items under their headings before typing, and the filters and the footer's hints", async () => {
    const host = DomFixture.host(await renderAsync());
    const field = DomFixture.oneOf(host, ".nol-quick-input-field", HTMLInputElement);

    expect([field.getAttribute("aria-label"), field.placeholder, field.value]).toEqual(["Search chats, messages and commands", "Search chats, messages and commands", String.empty]);
    expect(String(DomFixture.one(host, ".nol-quick-input-glyph").textContent).trim()).toBe("search");
    expect(headings(host)).toEqual(["Recent chats"]);
    expect([...host.querySelectorAll("[role=option]")].map(t => t.getAttribute("data-item"))).toEqual(["chat.chats/chat.fix"]);
    expect(filters(host)).toEqual([[null, "All", "true"], ["chat.chats", "Chats", "false"], ["chat.messages", "Messages", "false"], ["desktop.commands", "Commands", "false"]]);
    expect([...host.querySelectorAll(".nol-search-hint")].map(t => String(t.textContent).trim())).toEqual(["Enter to open", "↑ ↓ to move", "Tab for the next filter", "Type > for commands only"]);
    expect(host.querySelector(".nol-quick-input-empty")).toBeNull();
  });

  it("shows a Best match, then two of each source's matches under its heading with its marks, and each source's total on its filter", async () => {
    const fixture = await renderAsync();
    const host = DomFixture.host(fixture);
    await typeAsync(fixture, "term");

    expect(headings(host)).toEqual(["Best match", "In Chats", "In Messages", "In Commands"]);
    expect([...host.querySelectorAll("[role=option]")].map(t => t.getAttribute("data-item"))).toEqual([
      "chat.chats/chat.0", "chat.chats/chat.1", "chat.chats/chat.2", "chat.messages/chat.broken", "desktop.commands/desktop.0", "desktop.commands/desktop.1"
    ]);
    expect(String(DomFixture.one(host, "[role=option] mark").textContent)).toBe("Term");
    expect(filters(host).map(t => t[1])).toEqual(["All", "Chats 7", "Messages 1", "Commands 2"]);
    expect([DomFixture.one(host, "nol-quick-input").getAttribute("data-searching"), host.querySelector("[aria-busy]")]).toEqual(["false", null]);
  });

  it("shows a capped count with a + right after it, and a count of 1000 or more that isn't capped as it is", async () => {
    const capped = new SearchSourceContribution("chat.capped", "Capped", "capped", "In Capped", null, "chat",
      () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([result("chat.many", "Terminal logs")], 1000, true)));
    const exact = new SearchSourceContribution("chat.exact", "Exact", "exact", "In Exact", null, "chat",
      () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([result("chat.more", "Terminal notes")], 1500)));
    TestBed.overrideProvider(SearchService, { useValue: { placeholder: signal("Search chats"), createSession: () => new SearchSession([capped, exact], "desktop.commands", () => undefined) } });
    const fixture = await renderAsync(t => t.querySelectorAll(".nol-search-filter").length === 3);
    const host = DomFixture.host(fixture);
    await typeAsync(fixture, "term", t => !Object.isNull(t.querySelector("[data-item='chat.exact/chat.more']")));

    expect(filters(host).map(t => t[1])).toEqual(["All", "Capped 1000+", "Exact 1500"]);
    expect([...host.querySelectorAll(".nol-search-filter-count")].map(t => t.textContent)).toEqual(["1000+", "1500"]);
  });

  it("marks the palette as searching while a source is still answering, and leaves the count, the results and the field to assistive technology", async () => {
    let answer: (value: SearchAnswer) => void = () => undefined;
    const slow = new SearchSourceContribution("chat.slow", "Slow", "slow", "In Slow", null, "chat",
      () => Promise.resolve([]), () => new Promise<SearchAnswer>(resolve => {
        answer = resolve;
      }));
    TestBed.overrideProvider(SearchService, { useValue: { placeholder: signal("Search chats"), createSession: () => new SearchSession([chats, slow, commands], "desktop.commands", () => undefined) } });
    const fixture = await renderAsync();
    const host = DomFixture.host(fixture);
    const input = DomFixture.one(host, "nol-quick-input");
    await typeAsync(fixture, "term", t => !Object.isNull(t.querySelector("[data-item='chat.chats/chat.0']")));
    const pending = [input.getAttribute("data-searching"), host.querySelector("[aria-busy]")];

    answer(new SearchAnswer([]));
    await settle(fixture, () => input.getAttribute("data-searching") === "false");

    expect([pending, [input.getAttribute("data-searching"), host.querySelector("[aria-busy]")]]).toEqual([["true", null], ["false", null]]);
  });

  it("steps through the filters with Tab and back with Shift+Tab, keeping the focus in its field, and takes a filter from a click", async () => {
    const fixture = await renderAsync();
    const host = DomFixture.host(fixture);
    await typeAsync(fixture, "term");
    const field = DomFixture.oneOf(host, ".nol-quick-input-field", HTMLInputElement);
    field.focus();
    const press = async (shiftKey: boolean): Promise<boolean> => {
      const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
      field.dispatchEvent(event);
      await settle(fixture);
      return event.defaultPrevented;
    };
    const pressed = (): (string | null)[] => filters(host).filter(t => t[2] === "true").map(t => t[0] ?? null);

    const forward = await press(false);
    const onChats = [pressed(), headings(host)];
    const back = await press(true);
    const onAll = pressed();
    await press(true);
    const wrapped = pressed();
    const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    DomFixture.one(host, ".nol-search-filter[data-source='chat.messages']").dispatchEvent(mousedown);
    DomFixture.oneOf(host, ".nol-search-filter[data-source='chat.messages']", HTMLButtonElement).click();
    await settle(fixture, t => !Object.isNull(t.querySelector(".nol-search-filter[data-source='chat.messages'][aria-pressed=true]")));

    expect([forward, back]).toEqual([true, true]);
    expect(onChats).toEqual([["chat.chats"], ["In Chats"]]);
    expect([onAll, wrapped, pressed()]).toEqual([[null], ["desktop.commands"], ["chat.messages"]]);
    expect([mousedown.defaultPrevented, document.activeElement]).toEqual([true, field]);
    expect([...host.querySelectorAll("[role=option]")].length).toBe(1);
  });

  it("closes, then opens the chosen result, and reports a result that fails to open", async () => {
    const fixture = await renderAsync();
    const host = DomFixture.host(fixture);
    await typeAsync(fixture, "term");

    DomFixture.oneOf(host, "[data-item='desktop.commands/desktop.1']", HTMLElement).click();
    await settle(fixture, () => opened.length === 1);
    DomFixture.oneOf(host, "[data-item='chat.messages/chat.broken']", HTMLElement).click();
    await settle(fixture, () => errors.length === 1);

    expect([closes, opened]).toEqual([2, ["desktop.1"]]);
    expect(errors.map(t => String(t))).toEqual(["Error: The chat is gone."]);
  });

  it("only closes for a chosen item that has no result", async () => {
    const fixture = await renderAsync();
    fixture.debugElement.query(By.directive(QuickInputComponent)).injector.get(QuickInputComponent).chosen.emit(new QuickInputItem("chat.chats/gone", "Gone", null, null, null));
    await settle(fixture, () => closes === 1);

    expect([closes, opened, errors]).toEqual([1, [], []]);
  });

  it("closes when dismissed with Escape", async () => {
    const fixture = await renderAsync();
    DomFixture.one(DomFixture.host(fixture), ".nol-quick-input-field").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await settle(fixture, () => closes === 1);

    expect(closes).toBe(1);
  });

  it("says Nothing found for a query with no results, and starts with the query and filter it was opened with", async () => {
    const fixture = await renderAsync();
    await typeAsync(fixture, "zzz", host => !Object.isNull(host.querySelector(".nol-quick-input-empty")));
    const nothing = String(DomFixture.one(DomFixture.host(fixture), ".nol-quick-input-empty").textContent).trim();
    fixture.destroy();
    request = new SearchRequest(">", "chat.chats");
    const commandsOnly = DomFixture.host(await renderAsync());
    request = new SearchRequest(String.empty, "chat.chats");
    const chatsOnly = DomFixture.host(await renderAsync());

    expect(nothing).toBe("Nothing found.");
    expect([DomFixture.oneOf(commandsOnly, ".nol-quick-input-field", HTMLInputElement).value, filters(commandsOnly).map(t => [t[0], t[2]])]).toEqual([">", [[null, "true"], ["desktop.commands", "false"]]]);
    expect(filters(chatsOnly).filter(t => t[2] === "true").map(t => t[0])).toEqual(["chat.chats"]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`draws the filters as chips 1.375rem tall and the kit's smallest space apart, the chosen one selected, and ends the footer with the commands hint, in the ${theme.id} theme in ${mode} mode`, async () => {
        apply(theme, mode);
        const fixture = await renderAsync();
        const host = DomFixture.host(fixture);
        await typeAsync(fixture, "term");
        const chips = [...host.querySelectorAll<HTMLButtonElement>(".nol-search-filter")];
        const boxes = chips.map(t => t.getBoundingClientRect());
        const [active, idle] = [getComputedStyle(DomFixture.present(chips[0])), getComputedStyle(DomFixture.present(chips[1]))];
        const end = DomFixture.one(host, ".nol-search-hint-end");
        const footer = DomFixture.one(host, ".nol-quick-input-footer");
        const space = (): number => {
          const element = host.appendChild(document.createElement("div"));
          element.style.width = "var(--nol-space-1)";
          const width = element.getBoundingClientRect().width;
          element.remove();
          return width;
        };
        const probe = (token: string): string => {
          const element = host.appendChild(document.createElement("div"));
          element.style.backgroundColor = `var(${token})`;
          const color = getComputedStyle(element).backgroundColor;
          element.remove();
          return color;
        };

        let previous: DOMRect | null = null;
        for (const box of boxes) {
          AppearanceFixture.expectPixels(box.height, AppearanceFixture.toPixels(1.375));
          if (!Object.isNull(previous)) {
            AppearanceFixture.expectPixels(box.top, previous.top);
            AppearanceFixture.expectPixels(box.left - previous.right, space());
          }
          previous = box;
        }
        AppearanceFixture.expectPixels(parseFloat(active.paddingLeft), AppearanceFixture.toPixels(0.5625));
        AppearanceFixture.expectPixels(parseFloat(active.borderTopLeftRadius), AppearanceFixture.toPixels(0.6875));
        expect([active.backgroundColor, active.color]).toEqual([probe("--nol-selected"), probe("--nol-text-strong")]);
        expect(idle.backgroundColor).not.toBe(active.backgroundColor);
        AppearanceFixture.expectPixels(end.getBoundingClientRect().right, footer.getBoundingClientRect().right - parseFloat(getComputedStyle(footer).paddingRight));
      });

  it("keeps the filter chips' boxes with forced colors, the chosen one in the highlight colors and the others edged and written in the button text color", async () => {
    apply(DefaultTheme.theme, ThemeMode.Light);
    const fixture = await renderAsync();
    const host = DomFixture.host(fixture);
    await typeAsync(fixture, "term");
    const chips = [...host.querySelectorAll<HTMLButtonElement>(".nol-search-filter")];
    const before = chips.map(t => t.getBoundingClientRect());
    const system = (color: string): string => {
      const probe = host.appendChild(document.createElement("span"));
      probe.style.color = color;
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };
    await MediaFixture.forceColorsAsync("active");
    try {
      const [active, idle] = [getComputedStyle(DomFixture.present(chips[0])), getComputedStyle(DomFixture.present(chips[1]))];
      const buttonText = system("ButtonText");

      expect([active.backgroundColor, active.color]).toEqual([system("Highlight"), system("HighlightText")]);
      expect([idle.color, idle.borderTopColor, idle.borderRightColor, idle.borderBottomColor, idle.borderLeftColor, idle.borderTopStyle]).toEqual([...Array<string>(5).fill(buttonText), "solid"]);
      chips.forEach((chip, index) => {
        const box = chip.getBoundingClientRect();
        const kept = DomFixture.present(before[index]);
        const pairs: [number, number][] = [[box.left, kept.left], [box.top, kept.top], [box.width, kept.width], [box.height, kept.height]];
        for (const [shown, was] of pairs)
          AppearanceFixture.expectPixels(shown, was);
      });
    }
    finally {
      await MediaFixture.forceColorsAsync("none");
    }
  });
});
