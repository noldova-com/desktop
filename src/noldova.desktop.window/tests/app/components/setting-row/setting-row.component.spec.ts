/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import type {} from "@vitest/browser-playwright";
import { page, userEvent } from "vitest/browser";

import { DefaultTheme, SelectOption, type Theme, ThemeMode } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";
import { type SettingDefinition, SettingOption, SettingType } from "@noldova/desktop.protocol";

import { SettingRowComponent } from "../../../../src/app/components/setting-row/setting-row.component";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { SettingsFixture } from "../../../fixtures/settings.fixture";
import { MediaFixture } from "../../../fixtures/media.fixture";
import { DomFixture } from "../../../fixtures/dom.fixture";

describe("SettingRowComponent", () => {
  let fixture: ComponentFixture<SettingRowComponent>;
  let changes: JsonValue[];
  let drafts: string[];
  let resets: number;
  let runs: number;
  const checkedSites: SettingDefinition = SettingsFixture.define("notes.sites", "Sites", "The sites notes link to.", SettingType.text(200, true), String.empty, "Notes", "Links");

  function render(definition: SettingDefinition, value?: JsonValue, isSet: boolean = false, query: string = String.empty, theme = DefaultTheme.theme, mode = ThemeMode.Light,
    panelSize?: number): HTMLElement {
    AppearanceFixture.apply(theme, mode, panelSize);
    fixture = TestBed.createComponent(SettingRowComponent);
    fixture.componentRef.setInput("definition", definition);
    fixture.componentRef.setInput("value", value);
    fixture.componentRef.setInput("isSet", isSet);
    fixture.componentRef.setInput("query", query);
    fixture.componentRef.setInput("modules", [new SelectOption("clock", "Clock"), new SelectOption("notes", "Notes")]);
    fixture.componentInstance.changed.subscribe(t => changes.push(t));
    fixture.componentInstance.drafted.subscribe(t => drafts.push(t));
    fixture.componentInstance.reset.subscribe(() => resets++);
    fixture.componentInstance.run.subscribe(() => runs++);
    fixture.detectChanges();
    return DomFixture.host(fixture);
  }

  function baseline(host: Element): number {
    const probe = document.createElement("span");
    probe.style.display = "inline-block";
    host.prepend(probe);
    const bottom = probe.getBoundingClientRect().bottom;
    probe.remove();
    return bottom;
  }

  function measureBaselineThroughAlignedCopy(field: HTMLInputElement): number {
    const line = document.createElement("div");
    line.style.display = "flex";
    line.style.alignItems = "baseline";
    const copy = field.cloneNode();
    if (!(copy instanceof HTMLInputElement))
      throw new Error("The copy is not an input.");
    copy.value = field.value;
    const text = document.createElement("div");
    line.append(copy, text);
    document.body.append(line);
    const offset = baseline(text) - copy.getBoundingClientRect().top;
    line.remove();
    return field.getBoundingClientRect().top + offset;
  }

  function renderChecked(value: string, theme = DefaultTheme.theme, mode = ThemeMode.Light): HTMLElement {
    const row = render(checkedSites, value, true, String.empty, theme, mode);
    fixture.componentRef.setInput("check", (text: string): string | null => text.includes(" ") ? "Enter hosts only." : null);
    fixture.detectChanges();
    return row;
  }

  function renderFormat(format: readonly [SettingDefinition, string], note: string, theme: Theme, mode: ThemeMode, panelSize?: number): HTMLElement {
    const row = render(format[0], format[1], false, String.empty, theme, mode, panelSize);
    fixture.componentRef.setInput("note", note);
    fixture.detectChanges();
    return row;
  }

  function measureFormat(row: HTMLElement): { gap: number; baseline: number } {
    const field = DomFixture.oneOf(row, "input", HTMLInputElement);
    const note = DomFixture.one(row, ".nol-setting-row-note");
    return {
      gap: Math.round(note.getBoundingClientRect().left - field.getBoundingClientRect().right - AppearanceFixture.measureLook("space-2")),
      baseline: Math.round(baseline(note) - measureBaselineThroughAlignedCopy(field))
    };
  }

  const timeFormat: readonly [SettingDefinition, string] = [SettingsFixture.timeFormat, "HH:mm"];
  const dateTimeFormat: readonly [SettingDefinition, string] = [SettingsFixture.dateTimeFormat, "d MMM yyyy, HH:mm"];
  const formats: readonly (readonly [SettingDefinition, string])[] = [timeFormat, dateTimeFormat];

  beforeEach(() => {
    changes = [];
    drafts = [];
    resets = 0;
    runs = 0;
  });

  afterEach(async () => {
    await userEvent.keyboard("{Escape}");
    await userEvent.unhover(DomFixture.host(fixture));
    AppearanceFixture.reset();
  });

  it("shows the title, name and description with the query's matches marked, and no marker or Reset while the value is not set", () => {
    const row = render(SettingsFixture.panelSize, undefined, false, "size");

    expect(row.getAttribute("data-setting")).toBe("desktop.panelSize");
    expect(row.querySelector(".nol-setting-row-title")?.textContent).toBe("Interface text size");
    expect(row.querySelector(".nol-setting-row-name")?.textContent).toBe("desktop.panelSize");
    expect([...row.querySelectorAll("mark")].map(t => t.textContent)).toEqual(["size", "Size", "size"]);
    expect([row.querySelector(".nol-setting-row-marker"), row.querySelector(".nol-setting-row-reset")]).toEqual([null, null]);
    expect(DomFixture.oneOf(row, "input", HTMLInputElement).value).toBe("13");
  });

  it("marks a set value with a named marker that is not color alone, and resets it", async () => {
    const row = render(SettingsFixture.mode, "Dark", true);
    const marker = DomFixture.one(row, ".nol-setting-row-marker");

    await page.getByRole("button", { name: "Reset Mode" }).click();

    expect([marker.getAttribute("role"), marker.getAttribute("aria-label"), marker.textContent]).toEqual(["img", "Modified", "circle"]);
    expect(getComputedStyle(marker).color).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "accent"));
    expect(getComputedStyle(marker).fontVariationSettings).toBe("\"FILL\" 1");
    const title = getComputedStyle(DomFixture.oneOf(row, ".nol-setting-row-title", Element));
    expect(title.fontWeight).toBe(title.getPropertyValue("--nol-weight-emphasis").trim());
    expect(resets).toBe(1);
  });

  it("shows an action as its title and description with a button that runs it from the keyboard, never as modified", async () => {
    const row = render(SettingsFixture.alarms, undefined, false, "alarm");
    fixture.componentRef.setInput("canRun", true);
    fixture.detectChanges();

    row.querySelector<HTMLButtonElement>(".nol-setting-row-control button")?.focus();
    await userEvent.keyboard("{Enter}");

    expect([row.querySelector(".nol-setting-row-title")?.textContent, row.querySelector(".nol-setting-row-description")?.textContent]).toEqual(["Alarms", "The times the clock rings, in a tab of their own."]);
    expect([...row.querySelectorAll("mark")].map(t => t.textContent)).toEqual(["Alarm", "alarm", "alarm"]);
    expect([row.querySelector(".nol-setting-row-marker"), row.querySelector(".nol-setting-row-reset")]).toEqual([null, null]);
    expect([runs, changes]).toEqual([1, []]);
  });

  it("disables an action while its command cannot run", () => {
    const row = render(SettingsFixture.alarms);
    const button = row.querySelector<HTMLButtonElement>(".nol-setting-row-control button");

    button?.click();

    expect([button?.disabled, runs]).toEqual([true, 0]);
  });

  it("describes every kind of control by its description, which a boolean's checkbox takes as its label instead", () => {
    const controls: readonly (readonly [SettingDefinition, JsonValue, string])[] = [
      [SettingsFixture.mode, "Dark", "[role=radiogroup]"],
      [SettingsFixture.accent, "Blue", ".nol-select-button"],
      [SettingsFixture.panelSize, 14, "input"],
      [SettingsFixture.greeting, "Noon", "input"],
      [SettingsFixture.alarms, null, "button"],
      [SettingsFixture.mutedModules, [], "[role=group]"]
    ];
    const described = controls.map(([definition, value, selector]) => {
      const row = render(definition, value);
      const ids = row.querySelector(`.nol-setting-row-control ${selector}`)?.getAttribute("aria-describedby")?.split(" ") ?? [];
      return [definition.name.text, ids.map(t => document.getElementById(t)?.textContent?.trim())];
    });
    const languages = render(SettingsFixture.spellCheckLanguages, []);
    fixture.componentRef.setInput("languages", [new SelectOption("en-US", "English (United States)")]);
    fixture.detectChanges();
    const languageIds = languages.querySelector(".nol-setting-row-control [role=group]")?.getAttribute("aria-describedby")?.split(" ") ?? [];
    const languagesDescribed = languageIds.map(t => document.getElementById(t)?.textContent?.trim());
    const boolean = render(SettingsFixture.doNotDisturb, false);

    expect(languagesDescribed).toEqual([SettingsFixture.spellCheckLanguages.description]);
    expect(described).toEqual(controls.map(([definition]) => [definition.name.text, [definition.description]]));
    expect([boolean.querySelector(".nol-setting-row-description"), boolean.querySelector("input")?.getAttribute("aria-describedby")]).toEqual([null, null]);
  });

  it("changes a boolean with its checkbox, labelled by the description", async () => {
    render(SettingsFixture.doNotDisturb, false);

    await page.getByRole("checkbox", { name: "Holds back notifications on this device." }).click();

    expect(changes).toEqual([true]);
  });

  it("shows a choice of few options as choice pills, and changes it with the pointer and the arrow keys", async () => {
    const row = render(SettingsFixture.mode, "System");
    const pills = (): string[] => [...row.querySelectorAll("[role=radio]")].filter(t => t.getAttribute("aria-checked") === "true").map(t => t.textContent?.trim() ?? String.empty);

    expect(row.querySelector("nol-select")).toBeNull();
    expect(row.querySelector("[role=radiogroup]")?.getAttribute("aria-label")).toBe("Mode");
    expect(pills()).toEqual(["System"]);
    await page.getByRole("radio", { name: "Dark" }).click();
    fixture.componentRef.setInput("value", "Dark");
    fixture.detectChanges();
    DomFixture.one(row, "[role=radio][aria-checked=true]").focus();
    await userEvent.keyboard("{ArrowLeft}");

    expect(changes).toEqual(["Dark", "Light"]);
  });

  it("shows a choice of more than four options, or of a single one, as a select", async () => {
    const lone = render(SettingsFixture.theme, "Default");
    const isLoneSelect = [lone.querySelector("[role=radiogroup]"), lone.querySelector("nol-select")?.tagName];
    const row = render(SettingsFixture.accent, "Blue");

    expect(isLoneSelect).toEqual([null, "NOL-SELECT"]);
    expect([row.querySelector("[role=radiogroup]"), row.querySelector("nol-select")?.tagName]).toEqual([null, "NOL-SELECT"]);
    await page.getByRole("button", { name: "Accent, Blue" }).click();
    await page.getByRole("option", { name: "Violet" }).click();

    expect(changes).toEqual(["Violet"]);
  });

  it("shows a dynamic choice with the options it is supplied, as pills for a few and a select for more", async () => {
    const row = render(SettingsFixture.model, String.empty);
    fixture.componentRef.setInput("supplied", [new SettingOption(String.empty, "Provider default"), new SettingOption("large", "Large")]);
    fixture.detectChanges();
    const titles = [...row.querySelectorAll("[role=radio]")].map(t => t.textContent?.trim());

    await page.getByRole("radio", { name: "Large" }).click();
    fixture.componentRef.setInput("supplied", ["a", "b", "c", "d", "e"].map(t => new SettingOption(t, t.toUpperCase())));
    fixture.componentRef.setInput("value", "a");
    fixture.detectChanges();

    expect(titles).toEqual(["Provider default", "Large"]);
    expect([row.querySelector("[role=radiogroup]"), row.querySelector("nol-select")?.tagName]).toEqual([null, "NOL-SELECT"]);
    expect(changes).toEqual(["large"]);
  });

  it("keeps a value that is not among the supplied options, marked unavailable and still selected, empty or not", () => {
    const titles = (value: string): (string | undefined)[] => {
      const row = render(SettingsFixture.model, value);
      fixture.componentRef.setInput("supplied", [new SettingOption("small", "Small"), new SettingOption("large", "Large")]);
      fixture.detectChanges();
      return [...row.querySelectorAll("[role=radio]")].map(t => `${t.textContent?.trim()}${t.getAttribute("aria-checked") === "true" ? " checked" : String.empty}`);
    };

    expect(titles("retired")).toEqual(["retired (unavailable) checked", "Small", "Large"]);
    expect(titles(String.empty)).toEqual(["None (unavailable) checked", "Small", "Large"]);
    expect(changes).toEqual([]);
  });

  for (const mode of [ThemeMode.Light, ThemeMode.Dark])
    it(`shows the value alone in a disabled select of the same size until options are supplied, in ${mode} mode`, () => {
      const row = render(SettingsFixture.model, "large", true, String.empty, DefaultTheme.theme, mode);
      const button = (): HTMLButtonElement => DomFixture.oneOf(row, ".nol-select-button", HTMLButtonElement);
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const waiting = button().getBoundingClientRect();
      const waitingState = [button().getAttribute("aria-disabled"), button().getAttribute("aria-label")];
      fixture.componentRef.setInput("supplied", [new SettingOption("large", "Large")]);
      fixture.detectChanges();
      const supplied = button().getBoundingClientRect();

      expect(waitingState).toEqual(["true", "Model, large"]);
      expect([button().getAttribute("aria-disabled"), button().getAttribute("aria-label")]).toEqual([null, "Model, Large"]);
      expect([waiting.left / rem, waiting.top / rem, waiting.height / rem]).toEqual([supplied.left / rem, supplied.top / rem, supplied.height / rem]);
    });

  it("keeps a number outside its range or step as typed, marked invalid and explained, until it is corrected", () => {
    const row = render(SettingsFixture.panelSize, 14);
    const field = DomFixture.oneOf(row, "input", HTMLInputElement);
    const shown: string[][] = [];

    for (const value of ["20", "13.5", String.empty, "16"]) {
      field.value = value;
      field.dispatchEvent(new Event("change"));
      fixture.detectChanges();
      const alert = row.querySelector("[role=alert]");
      const description = row.querySelector(".nol-setting-row-description")?.id;
      shown.push([field.value, alert?.textContent?.trim() ?? String.empty, String(field.getAttribute("aria-invalid")), String(field.getAttribute("aria-describedby") === `${description} ${alert?.id}`)]);
    }

    expect(shown).toEqual([
      ["20", "Enter a whole number from 12 to 18.", "true", "true"],
      ["13.5", "Enter a whole number from 12 to 18.", "true", "true"],
      [String.empty, "Enter a whole number from 12 to 18.", "true", "true"],
      ["16", String.empty, "null", "false"]
    ]);
    expect(changes).toEqual([16]);
  });

  it("puts the stored number back with Escape, and lets Escape through when there is nothing to put back", async () => {
    const row = render(SettingsFixture.panelSize, 14);
    const field = DomFixture.oneOf(row, "input", HTMLInputElement);
    const passed: string[] = [];
    const listen = (event: KeyboardEvent): number => passed.push(event.key);
    document.addEventListener("keydown", listen);
    let reverted: unknown[] = [];

    try {
      field.focus();
      await userEvent.keyboard("{Escape}");
      field.value = "20";
      field.dispatchEvent(new Event("change"));
      fixture.detectChanges();
      await userEvent.keyboard("{Escape}");
      fixture.detectChanges();
      reverted = [field.value, row.querySelector("[role=alert]"), field.getAttribute("aria-invalid")];
      field.value = "17";
      await userEvent.keyboard("{Escape}");
    } finally {
      document.removeEventListener("keydown", listen);
    }

    expect(reverted).toEqual(["14", null, null]);
    expect([field.value, passed, changes]).toEqual(["14", ["Escape"], []]);
  });

  it("drops a rejected entry and its error when the stored number changes, by Reset or from elsewhere", () => {
    const row = render(SettingsFixture.panelSize, 14, true);
    const field = DomFixture.oneOf(row, "input", HTMLInputElement);
    const shown: string[][] = [];

    for (const value of [undefined, 16]) {
      field.value = "20";
      field.dispatchEvent(new Event("change"));
      fixture.detectChanges();
      fixture.componentRef.setInput("value", value);
      fixture.detectChanges();
      shown.push([field.value, String(row.querySelector("[role=alert]")), String(field.getAttribute("aria-invalid"))]);
    }

    expect(shown).toEqual([["13", "null", "null"], ["16", "null", "null"]]);
    expect(changes).toEqual([]);
  });

  it("explains a range with another step in its words", () => {
    const row = render(SettingsFixture.define("clock.ratio", "Ratio", "A ratio.", SettingType.number(0, 1, 0.25), 0.5, "Clock", "Ticks"));
    const field = DomFixture.oneOf(row, "input", HTMLInputElement);

    field.value = "0.3";
    field.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    expect(row.querySelector("[role=alert]")?.textContent?.trim()).toBe("Enter a number from 0 to 1 in steps of 0.25.");
  });

  it("takes a number, a text or an escape only from its own field", () => {
    const foreign = { target: document.createElement("div"), stopPropagation: () => {
      throw new Error("An escape from another element was handled.");
    } };
    const number = render(SettingsFixture.panelSize, 14);
    const numberField = fixture.debugElement.query(By.css("input"));
    numberField.triggerEventHandler("change", foreign);
    numberField.triggerEventHandler("keydown.escape", foreign);
    fixture.detectChanges();
    const numberShown = [number.querySelector("[role=alert]"), DomFixture.oneOf(number, "input", HTMLInputElement).value];
    render(SettingsFixture.greeting);
    fixture.debugElement.query(By.css("input")).triggerEventHandler("change", foreign);
    fixture.debugElement.query(By.css("input")).triggerEventHandler("input", foreign);

    expect(numberShown).toEqual([null, "14"]);
    expect([changes, drafts]).toEqual([[], []]);
  });

  it("changes text when the field is committed", () => {
    const row = render(SettingsFixture.greeting);
    const field = DomFixture.oneOf(row, "input", HTMLInputElement);

    field.value = "Midday";
    field.dispatchEvent(new Event("change"));

    expect([field.maxLength, changes]).toEqual([20, ["Midday"]]);
  });

  it("reports each text as it is typed, before it is committed", () => {
    const field = DomFixture.oneOf(render(SettingsFixture.greeting), "input", HTMLInputElement);

    for (const text of ["Noon!", "Noon!a"]) {
      field.value = text;
      field.dispatchEvent(new Event("input"));
    }

    expect([drafts, changes]).toEqual([["Noon!", "Noon!a"], []]);
  });

  it("refuses a text its check answers with a message, shows the message under the field, and saves and clears it once the entry is fixed", () => {
    const row = renderChecked("github.com");
    const field = DomFixture.oneOf(row, "input", HTMLInputElement);
    const shown: string[][] = [];

    for (const value of ["git hub.com", "github.com,gitlab.com"]) {
      field.value = value;
      field.dispatchEvent(new Event("change"));
      fixture.detectChanges();
      const alert = row.querySelector("[role=alert]");
      const description = row.querySelector(".nol-setting-row-description")?.id;
      shown.push([field.value, alert?.textContent?.trim() ?? String.empty, String(field.getAttribute("aria-invalid")), String(field.getAttribute("aria-describedby") === `${description} ${alert?.id}`)]);
    }

    expect(shown).toEqual([
      ["git hub.com", "Enter hosts only.", "true", "true"],
      ["github.com,gitlab.com", String.empty, "null", "false"]
    ]);
    expect(changes).toEqual(["github.com,gitlab.com"]);
  });

  it("shows its check's message for a stored text the check refuses, without changing it, until the text is fixed", () => {
    const row = renderChecked("git hub.com");
    const shown = (): string => row.querySelector("[role=alert]")?.textContent?.trim() ?? String.empty;
    const stored = shown();
    fixture.componentRef.setInput("value", "github.com");
    fixture.detectChanges();

    expect([stored, shown(), changes]).toEqual(["Enter hosts only.", String.empty, []]);
  });

  it("saves any text when no check is supplied for it", () => {
    const row = render(checkedSites, "github.com");
    const field = DomFixture.oneOf(row, "input", HTMLInputElement);

    field.value = "git hub.com";
    field.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    expect([changes, row.querySelector("[role=alert]")]).toEqual([["git hub.com"], null]);
  });

  it("chooses modules with a checkbox each, keeping their order", async () => {
    render(SettingsFixture.mutedModules, ["notes"]);

    await page.getByRole("checkbox", { name: "Clock" }).click();
    fixture.componentRef.setInput("value", ["clock", "notes"]);
    fixture.detectChanges();
    await page.getByRole("checkbox", { name: "Notes" }).click();

    expect(changes).toEqual([["clock", "notes"], ["clock"]]);
  });

  it("checks the modules not chosen when inverse, so unchecking one chooses it", async () => {
    const row = render(SettingsFixture.mutedModules, ["notes"]);
    fixture.componentRef.setInput("isInverse", true);
    fixture.detectChanges();
    const checked = [...row.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].map(t => t.checked);

    await page.getByRole("checkbox", { name: "Clock" }).click();
    fixture.componentRef.setInput("value", ["clock", "notes"]);
    fixture.detectChanges();
    await page.getByRole("checkbox", { name: "Notes" }).click();

    expect(checked).toEqual([true, false]);
    expect(changes).toEqual([["clock", "notes"], ["clock"]]);
  });

  it("chooses spelling languages with a checkbox each, in the order offered, and leaves out one no longer offered", async () => {
    render(SettingsFixture.spellCheckLanguages, ["sv-SE"]);
    fixture.componentRef.setInput("languages", [new SelectOption("en-GB", "English (United Kingdom)"), new SelectOption("en-US", "English (United States)")]);
    fixture.detectChanges();
    const group = page.getByRole("group", { name: "Spelling languages" });

    await group.getByRole("checkbox", { name: "English (United States)" }).click();
    fixture.componentRef.setInput("value", ["en-US"]);
    fixture.detectChanges();
    await group.getByRole("checkbox", { name: "English (United Kingdom)" }).click();
    fixture.componentRef.setInput("value", ["en-GB", "en-US"]);
    fixture.detectChanges();
    await group.getByRole("checkbox", { name: "English (United States)" }).click();

    expect(changes).toEqual([["en-US"], ["en-GB", "en-US"], ["en-GB"]]);
  });

  it("describes its control by its note after its description, and by an error after both", () => {
    const row = render(SettingsFixture.panelSize, 14);
    const field = DomFixture.oneOf(row, "input", HTMLInputElement);
    const described = (): readonly string[] => (field.getAttribute("aria-describedby") ?? String.empty).split(" ").map(t => document.getElementById(t)?.textContent?.trim() ?? String.empty);
    fixture.componentRef.setInput("note", "Shows as 13:05");
    fixture.detectChanges();
    const noted = described();
    field.value = "20";
    field.dispatchEvent(new Event("change"));
    fixture.detectChanges();
    const description = SettingsFixture.panelSize.description;

    expect([noted, described()]).toEqual([[description, "Shows as 13:05"], [description, "Shows as 13:05", "Enter a whole number from 12 to 18."]]);
  });

  it("shows the note it is given about the spelling languages, under the languages offered or alone", () => {
    const row = render(SettingsFixture.spellCheckLanguages);

    expect(row.querySelector(".nol-setting-row-note")).toBeNull();
    fixture.componentRef.setInput("note", "No spelling languages are offered on this device.");
    fixture.detectChanges();
    expect(row.querySelector(".nol-setting-row-note")?.textContent).toBe("No spelling languages are offered on this device.");
    expect(row.querySelector("nol-checkbox")).toBeNull();
    fixture.componentRef.setInput("languages", [new SelectOption("en-US", "English (United States)")]);
    fixture.detectChanges();
    expect(row.querySelectorAll("nol-checkbox").length).toBe(1);
    expect(row.querySelector(".nol-setting-row-note")?.textContent).toBe("No spelling languages are offered on this device.");
  });

  it("marks a row with nothing to click or change, and no other row", () => {
    const marked = (definition: SettingDefinition, isSet: boolean, listed: readonly SelectOption[]): boolean => {
      const row = render(definition, undefined, isSet);
      fixture.componentRef.setInput(definition === SettingsFixture.mutedModules ? "modules" : "languages", listed);
      fixture.detectChanges();
      return row.classList.contains("nol-setting-row-static");
    };
    const english = [new SelectOption("en-US", "English (United States)")];
    const keys = SettingsFixture.define("desktop.keyBindings", "Keys", "The keys of commands.", SettingType.keyBindings(), {}, "Keyboard", "Keys");

    expect([
      marked(SettingsFixture.spellCheckLanguages, false, []), marked(SettingsFixture.spellCheckLanguages, true, []), marked(SettingsFixture.spellCheckLanguages, false, english),
      marked(SettingsFixture.mutedModules, false, []), marked(SettingsFixture.mutedModules, false, english), marked(keys, false, []), marked(keys, true, []),
      marked(SettingsFixture.doNotDisturb, false, []), marked(SettingsFixture.alarms, false, [])
    ]).toEqual([true, false, false, true, false, true, false, false, false]);
  });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes)
      it(`shows the hover background on a row with a control and none on a row with nothing to click, with and without forced colors, in the ${theme.id} theme in ${mode} mode`, async () => {
        const measureAsync = async (definition: SettingDefinition): Promise<readonly [string, string]> => {
          const row = render(definition, undefined, false, String.empty, theme, mode);
          const resting = getComputedStyle(row).backgroundColor;
          await userEvent.hover(row);
          return [resting, getComputedStyle(row).backgroundColor];
        };

        const [plain, plainControl] = [await measureAsync(SettingsFixture.spellCheckLanguages), await measureAsync(SettingsFixture.mode)];
        await MediaFixture.forceColorsAsync("active");
        try {
          const [forced, forcedControl] = [await measureAsync(SettingsFixture.spellCheckLanguages), await measureAsync(SettingsFixture.mode)];

          expect([plain[1], plainControl[1]]).toEqual([plain[0], AppearanceFixture.readColor(theme, mode, "hover")]);
          expect([forced[1] === forced[0], forcedControl[1] === forcedControl[0]]).toEqual([true, false]);
        }
        finally {
          await MediaFixture.forceColorsAsync("none");
        }
      });

  for (const mode of AppearanceFixture.modes)
    for (const theme of AppearanceFixture.themes) {
      it(`puts a format's preview the space-2 gap beside its field, on the field text's baseline, at every panel size in the ${theme.id} theme in ${mode} mode`, () => {
        const measured = formats.flatMap(t => AppearanceFixture.panelSizes.map(size => [t[0].title, size, measureFormat(renderFormat(t, "Shows as 13:05", theme, mode, size))]));

        expect(measured).toEqual(formats.flatMap(t => AppearanceFixture.panelSizes.map(size => [t[0].title, size, { gap: 0, baseline: 0 }])));
      });

      it(`wraps a long preview under itself beside its field while the row has room for it in the ${theme.id} theme in ${mode} mode`, () => {
        const row = renderFormat(dateTimeFormat, "Shows as Saturday 31 October 2026, 23:49:05 Pacific Daylight Time", theme, mode);
        row.style.width = "32rem";
        const control = DomFixture.one(row, ".nol-setting-row-control");
        const note = DomFixture.one(row, ".nol-setting-row-note");
        const range = document.createRange();
        range.selectNodeContents(note);
        const lines = new Set([...range.getClientRects()].map(t => Math.round(t.top))).size;

        expect([measureFormat(row), lines > 1, note.getBoundingClientRect().right <= control.getBoundingClientRect().right, control.scrollWidth <= control.clientWidth])
          .toEqual([{ gap: 0, baseline: 0 }, true, true, true]);
      });

      it(`moves the whole preview under its field on the narrowest row, at panel sizes 12 and 18, in the ${theme.id} theme in ${mode} mode`, () => {
        const measured = [12, 18].map(size => {
          const row = renderFormat(dateTimeFormat, "Shows as 31 Oct 2026, 23:49", theme, mode, size);
          row.style.width = "10rem";
          const control = DomFixture.one(row, ".nol-setting-row-control").getBoundingClientRect();
          const field = DomFixture.oneOf(row, "input", HTMLInputElement).getBoundingClientRect();
          const note = DomFixture.one(row, ".nol-setting-row-note").getBoundingClientRect();
          return [size, Math.round(note.left - control.left), Math.round(note.width - control.width), note.top >= field.bottom, field.right <= control.right];
        });

        expect(measured).toEqual([[12, 0, 0, true, true], [18, 0, 0, true, true]]);
      });

      it(`puts a checked text's message under its field, from the field's start, in the ${theme.id} theme in ${mode} mode`, () => {
        const row = renderChecked("git hub.com", theme, mode);
        const field = DomFixture.oneOf(row, "input", HTMLInputElement).getBoundingClientRect();
        const message = DomFixture.one(row, "[role=alert]").getBoundingClientRect();

        expect([Math.round(message.left - field.left), message.top >= field.bottom, message.width > 0]).toEqual([0, true, true]);
      });

      it(`follows the component table in the ${theme.id} theme in ${mode} mode`, async () => {
        const row = render(SettingsFixture.mode, "Dark", true, String.empty, theme, mode);
        const style = getComputedStyle(row);
        const look = { top: style.paddingTop, side: style.paddingLeft, bottom: style.paddingBottom, radius: style.borderTopLeftRadius };
        const description = getComputedStyle(DomFixture.oneOf(row, ".nol-setting-row-description", Element)).marginTop;
        const control = getComputedStyle(DomFixture.oneOf(row, ".nol-setting-row-control", Element)).marginTop;
        await userEvent.hover(row);

        AppearanceFixture.expectLook(look.top, theme, "settings-item-padding", "padding-top", "padding");
        AppearanceFixture.expectLook(look.side, theme, "settings-item-padding", "padding-left", "padding");
        AppearanceFixture.expectLook(look.bottom, theme, "settings-item-padding", "padding-bottom", "padding");
        AppearanceFixture.expectLook(look.radius, theme, "radius-medium", "border-top-left-radius");
        AppearanceFixture.expectLook(description, theme, "settings-item-description-gap", "margin-top");
        AppearanceFixture.expectLook(control, theme, "settings-item-control-gap", "margin-top");
        expect(getComputedStyle(row).backgroundColor).toBe(AppearanceFixture.readColor(theme, mode, "hover"));
        expect(getComputedStyle(DomFixture.oneOf(row, ".nol-setting-row-title", Element)).color).toBe(AppearanceFixture.readColor(theme, mode, "setting-title"));
      });
    }

  it("treats a value that is not a list of names as no modules", () => {
    const row = render(SettingsFixture.mutedModules, "clock");

    expect([...row.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].map(t => t.checked)).toEqual([false, false]);
  });
});
