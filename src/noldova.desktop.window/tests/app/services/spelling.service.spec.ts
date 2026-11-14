/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ApplicationRef, ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { JsonException, type JsonValue } from "@noldova/context.json";

import { MenuService } from "../../../src/app/services/menu.service";
import { SettingsService } from "../../../src/app/services/settings.service";
import { SpellingService } from "../../../src/app/services/spelling.service";
import { PreloadBridgeFixture } from "../../fixtures/preload-bridge.fixture";

class FakeSettingsService {
  public readonly values: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map());
}

describe("SpellingService", () => {
  let bridge: PreloadBridgeFixture;
  let settings: FakeSettingsService;
  let errors: unknown[];

  async function startAsync(): Promise<SpellingService> {
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useValue: settings },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
    const service = TestBed.inject(SpellingService);
    await TestBed.inject(ApplicationRef).whenStable();
    return service;
  }

  function load(values: Record<string, JsonValue>): void {
    settings.values.set(new Map(Object.entries(values)));
    TestBed.tick();
  }

  beforeEach(() => {
    bridge = PreloadBridgeFixture.install();
    settings = new FakeSettingsService();
    errors = [];
  });

  afterEach(() => PreloadBridgeFixture.remove());

  it("offers the main process's languages by name and says which one checks words when none of the device's languages is offered", async () => {
    bridge.spelling = Promise.resolve({ languages: ["en-US"], fallback: "en-US" });

    const service = await startAsync();

    expect(service.options().map(t => [t.value, t.title])).toEqual([["en-US", "English (United States)"]]);
    expect(service.noteFor([])).toBe("None of this device's languages has a dictionary here, so words are checked in English (United States).");
    expect(service.noteFor(["de-DE"])).toBe("None of this device's languages has a dictionary here, so words are checked in English (United States).");
    expect(service.noteFor(["en-US"])).toBeNull();
    expect(service.noteFor(undefined)).toBe("None of this device's languages has a dictionary here, so words are checked in English (United States).");
  });

  it("adds no note when a device language is offered, and says so when no language is offered", async () => {
    bridge.spelling = Promise.resolve({ languages: ["en-US"], fallback: null });
    const service = await startAsync();
    const offered = service.noteFor([]);
    bridge.spelling = Promise.resolve({ languages: [], fallback: null });
    TestBed.resetTestingModule();

    const empty = await startAsync();

    expect(offered).toBeNull();
    expect(empty.noteFor([])).toBe("No spelling languages are offered on this device.");
  });

  it("gives macOS its own note, since the system chooses the languages there", async () => {
    bridge.platform = "darwin";
    bridge.spelling = Promise.resolve({ languages: [], fallback: null });

    const service = await startAsync();

    expect(service.noteFor([])).toBe("On macOS the system chooses the spelling languages.");
  });

  it("keeps each change of the spelling settings through the main process, and ignores values that do not form one", async () => {
    await startAsync();

    load({ "desktop.spellCheck": true, "desktop.spellCheckLanguages": [] });
    load({ "desktop.spellCheck": true, "desktop.spellCheckLanguages": [] });
    load({ "desktop.spellCheck": false, "desktop.spellCheckLanguages": [] });
    load({ "desktop.spellCheck": false, "desktop.spellCheckLanguages": ["en-US"] });
    load({ "desktop.spellCheck": "yes", "desktop.spellCheckLanguages": [] });
    load({ "desktop.spellCheck": true, "desktop.spellCheckLanguages": "en-US" });
    load({ "desktop.spellCheck": true, "desktop.spellCheckLanguages": [1] });

    expect(bridge.keptSpellings).toEqual([[true, []], [false, []], [false, ["en-US"]]]);
  });

  it("gives the field menu up to five suggestions for a misspelled word, or a disabled No suggestions row, then Add to dictionary for the word", async () => {
    bridge.spelling = Promise.resolve({ languages: ["en-US"], fallback: null });
    await startAsync();
    const menus = TestBed.inject(MenuService);
    const rows = (context: Record<string, JsonValue>): string[] => menus.resolve("desktop.field", context)
      .find(t => t.group === "desktop.fieldSpelling")?.rows.map(t => t.isSubmenu ? t.title : `${t.command} ${t.title} ${t.isEnabled}`) ?? [];

    const many = rows({ word: "wrold", suggestions: ["world", "would", "wold", "word", "wield", "weld"] });
    const none = rows({ word: "qzx", suggestions: [] });
    const correct = rows({ word: String.empty, suggestions: [] });
    const plain = rows({});

    expect(many).toEqual([
      "desktop.replaceMisspelling world true", "desktop.replaceMisspelling would true", "desktop.replaceMisspelling wold true",
      "desktop.replaceMisspelling word true", "desktop.replaceMisspelling wield true", "desktop.addToDictionary Add to dictionary true"
    ]);
    expect(none).toEqual(["desktop.replaceMisspelling No suggestions false", "desktop.addToDictionary Add to dictionary true"]);
    expect([correct, plain]).toEqual([[], []]);
  });

  it("reports an offer it cannot read and offers nothing", async () => {
    bridge.spelling = Promise.resolve(null);

    const service = await startAsync();

    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(JsonException);
    expect(service.options()).toEqual([]);
  });
});
