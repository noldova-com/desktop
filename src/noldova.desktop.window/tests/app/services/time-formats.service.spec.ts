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
import { TimeFormatsService } from "../../../src/app/services/time-formats.service";

class FakeSettingsService {
  public readonly values: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map());

  public value(name: string): Signal<JsonValue | undefined> {
    return computed(() => this.values().get(name));
  }
}

describe("TimeFormatsService", () => {
  const at = new Date(2026, 9, 22, 13, 5);
  let settings: FakeSettingsService;
  let service: TimeFormatsService;

  beforeEach(() => {
    settings = new FakeSettingsService();
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: settings }] });
    service = TestBed.inject(TimeFormatsService);
  });

  const write = (): readonly [string | undefined, string | undefined] => [service.formats().clock?.(at), service.formats().full?.(at)];
  const use = (time: JsonValue, dateTime: JsonValue): void => {
    settings.values.set(new Map([["desktop.timeFormat", time], ["desktop.dateTimeFormat", dateTime]]));
  };

  it("writes the kit's times in the 12-hour defaults until the settings load, then in the stored formats, as a 24-hour setting and a change back to 12-hour", () => {
    const before = write();
    use("HH:mm:ss", "d MMM yyyy, HH:mm");
    const twentyFourHour = write();
    use("h:mm:ss a", "MMM d, yyyy, h:mm a");

    expect([before, twentyFourHour, write()]).toEqual([["1:05 PM", "Oct 22, 2026, 1:05 PM"], ["13:05:00", "22 Oct 2026, 13:05"], ["1:05:00 PM", "Oct 22, 2026, 1:05 PM"]]);
  });

  it("keeps a format's default while its stored value is blank or not text, and the other format as stored", () => {
    use(" ", "d MMM yyyy, HH:mm");
    const blank = write();
    use("HH:mm", 12);

    expect([blank, write()]).toEqual([["1:05 PM", "22 Oct 2026, 13:05"], ["13:05", "Oct 22, 2026, 1:05 PM"]]);
  });
});
