/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type Signal, type WritableSignal, computed, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/context.json";

import { ClockChoice } from "../../../src/app/enums/clock-choice";
import { ClockSettingService } from "../../../src/app/services/clock-setting.service";
import { SettingsService } from "../../../src/app/services/settings.service";

class FakeSettingsService {
  public readonly values: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map());
  public readonly sets: WritableSignal<ReadonlySet<string>> = signal(new Set());
  public readonly calls: string[] = [];

  public isSet(name: string): Signal<boolean> {
    return computed(() => this.sets().has(name));
  }

  public setAsync(name: string, value: JsonValue): Promise<void> {
    this.calls.push(`set ${name} ${JSON.stringify(value)}`);
    return Promise.resolve();
  }

  public resetAsync(name: string): Promise<void> {
    this.calls.push(`reset ${name}`);
    return Promise.resolve();
  }
}

describe("ClockSettingService", () => {
  let settings: FakeSettingsService;
  let clock: ClockSettingService;

  beforeEach(() => {
    settings = new FakeSettingsService();
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: settings }] });
    clock = TestBed.inject(ClockSettingService);
  });

  it("offers the two clocks on General, in the date and time group, with the 12-hour clock first and by default", () => {
    const definition = clock.definition;

    expect([definition.name.text, definition.page, definition.group, definition.defaultValue, definition.type.options.map(t => `${t.value} ${t.title}`)])
      .toEqual(["desktop.clock", "General", "Date and time", ClockChoice.TwelveHour, ["TwelveHour 12-hour", "TwentyFourHour 24-hour"]]);
  });

  it("reads the clock from the time format, as 24-hour only when it is text with no hour of twelve or marker", () => {
    const read = (pattern: JsonValue | undefined): ClockChoice => {
      settings.values.set(new Map(Object.isUndefined(pattern) ? [] : [["desktop.timeFormat", pattern]]));
      return clock.value();
    };

    expect([undefined, "HH:mm", "h:mm a", "hh:mm", "HH:mm a", "'h' HH", 12].map(read)).toEqual([
      ClockChoice.TwelveHour, ClockChoice.TwentyFourHour, ClockChoice.TwelveHour, ClockChoice.TwelveHour, ClockChoice.TwelveHour, ClockChoice.TwentyFourHour,
      ClockChoice.TwelveHour
    ]);
  });

  it("counts as set while either format is set", () => {
    const flags = [[], ["desktop.timeFormat"], ["desktop.dateTimeFormat"], ["desktop.theme"]].map(names => {
      settings.sets.set(new Set(names));
      return clock.isSet();
    });

    expect(flags).toEqual([false, true, true, false]);
  });

  it("sets both formats to the chosen clock's shape, and puts both back on reset", async () => {
    await clock.chooseAsync(ClockChoice.TwelveHour);
    await clock.chooseAsync(ClockChoice.TwentyFourHour);
    await clock.chooseAsync("Sundial");
    await clock.resetAsync();

    expect(settings.calls).toEqual([
      "set desktop.timeFormat \"h:mm a\"", "set desktop.dateTimeFormat \"MMM d, yyyy, h:mm a\"",
      "set desktop.timeFormat \"HH:mm\"", "set desktop.dateTimeFormat \"d MMM yyyy, HH:mm\"",
      "set desktop.timeFormat \"h:mm a\"", "set desktop.dateTimeFormat \"MMM d, yyyy, h:mm a\"",
      "reset desktop.timeFormat", "reset desktop.dateTimeFormat"
    ]);
  });

  it("sends both formats' writes together rather than one after the other", async () => {
    const choosing = clock.chooseAsync(ClockChoice.TwelveHour);
    const chosen = settings.calls.length;
    const resetting = clock.resetAsync();
    const reset = settings.calls.length;
    await Promise.all([choosing, resetting]);

    expect([chosen, reset]).toEqual([2, 4]);
  });
});
