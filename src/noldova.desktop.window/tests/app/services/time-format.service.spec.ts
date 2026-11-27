/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, computed, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/context.json";

import { SettingsService } from "../../../src/app/services/settings.service";
import { TimeFormatService } from "../../../src/app/services/time-format.service";

class FakeSettingsService {
  public readonly values: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map());

  public value(name: string): Signal<JsonValue | undefined> {
    return computed(() => this.values().get(name));
  }

  public use(time: JsonValue, dateTime: JsonValue): void {
    this.values.set(new Map([["desktop.timeFormat", time], ["desktop.dateTimeFormat", dateTime]]));
  }
}

describe("TimeFormatService", () => {
  const at = new Date(2026, 9, 22, 13, 5).getTime();
  let settings: FakeSettingsService;
  let times: TimeFormatService;

  beforeEach(() => {
    settings = new FakeSettingsService();
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: settings }] });
    times = TestBed.inject(TimeFormatService);
  });

  it("writes in the 12-hour defaults until the settings load, then follows a change of each setting on its own", () => {
    const shown = computed(() => [times.time(at), times.dateTime(at), times.weekdayTime(at)]);
    const before = shown();
    settings.use("HH:mm", "MMM d, yyyy, h:mm a");
    const timeChanged = shown();
    settings.use("HH:mm", "d MMM yyyy, HH:mm");
    const dateTimeChanged = shown();
    settings.use("h:mm:ss a", "d MMM yyyy, HH:mm");

    expect([before, timeChanged, dateTimeChanged, shown()]).toEqual([
      ["1:05 PM", "Oct 22, 2026, 1:05 PM", "Thu 1:05 PM"],
      ["13:05", "Oct 22, 2026, 1:05 PM", "Thu 13:05"],
      ["13:05", "22 Oct 2026, 13:05", "Thu 13:05"],
      ["1:05:00 PM", "22 Oct 2026, 13:05", "Thu 1:05:00 PM"]]);
  });

  it("writes the shorter forms in the date-and-time format's order and separators, without the tokens each drops", () => {
    const forms = (dateTime: string): readonly string[] => {
      settings.use("h:mm a", dateTime);
      return [times.shortDateTime(at), times.date(at), times.shortDate(at)];
    };
    const before = [times.shortDateTime(at), times.date(at), times.shortDate(at)];

    expect([before, forms("d MMM yyyy, HH:mm"), forms("yyyy-MM-dd HH:mm"), forms("EEE, dd/MM/yy 'at' HH:mm"), forms("HH:mm, d MMMM yyyy"), forms("HH:mm")]).toEqual([
      ["Oct 22, 1:05 PM", "Oct 22, 2026", "Oct 22"],
      ["22 Oct, 13:05", "22 Oct 2026", "22 Oct"],
      ["10-22 13:05", "2026-10-22", "10-22"],
      ["22/10 at 13:05", "Thu, 22/10/26", "22/10"],
      ["13:05, 22 October", "22 October 2026", "22 October"],
      ["13:05", "22 Oct 2026", "22 Oct"]]);
  });

  it("reads a moment given as an ISO 8601 text as it reads one given in milliseconds", () => {
    const text = new Date(at).toISOString();

    expect([times.time(text), times.dateTime(text), times.date(text)]).toEqual([times.time(at), times.dateTime(at), times.date(at)]);
  });

  it("keeps a format's default while its stored value is blank or not text", () => {
    settings.use(" ", 12);

    expect([times.time(at), times.dateTime(at), times.date(at)]).toEqual(["1:05 PM", "Oct 22, 2026, 1:05 PM", "Oct 22, 2026"]);
  });
});
