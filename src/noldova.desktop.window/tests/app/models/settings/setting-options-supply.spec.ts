/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";

import type { JsonObject, JsonValue } from "@noldova/context.json";
import { SettingOption } from "@noldova/desktop.protocol";

import { SettingOptionsFailedException } from "../../../../src/app/exceptions/setting-options-failed.exception";
import { SettingOptionsRepeatedException } from "../../../../src/app/exceptions/setting-options-repeated.exception";
import { SettingOptionsSupply } from "../../../../src/app/models/settings/setting-options-supply";

describe("SettingOptionsSupply", () => {
  const options = [new SettingOption("small", "Small"), new SettingOption("large", "Large")];

  function values(entries: readonly (readonly [string, JsonValue])[]): ReadonlyMap<string, JsonValue> {
    return new Map(entries);
  }

  it("supplies the provider's options for its module's own values", () => {
    const asked: JsonObject[] = [];
    const supply = new SettingOptionsSupply("notes.size", t => {
      asked.push(t);
      return options;
    }, signal(values([["notes.size", "small"], ["notes.font", "serif"], ["tasks.size", "large"], ["notesx.size", "large"]])), () => undefined);

    expect(supply.options()).toEqual(options);
    expect(asked).toEqual([{ "notes.size": "small", "notes.font": "serif" }]);
  });

  it("asks again when its module's values change, and not when only another module's change or the same values come again", () => {
    const current = signal(values([["notes.size", "small"], ["notes.font", "serif"]]));
    let asked = 0;
    const supply = new SettingOptionsSupply("notes.size", () => {
      asked += 1;
      return options;
    }, current, () => undefined);
    const counts: number[] = [];
    const read = (): void => {
      supply.options();
      counts.push(asked);
    };

    read();
    current.set(values([["notes.size", "small"], ["notes.font", "serif"], ["tasks.size", "large"]]));
    read();
    current.set(values([["notes.font", "serif"], ["notes.size", "small"]]));
    read();
    current.set(values([["notes.size", "large"], ["notes.font", "serif"]]));
    read();
    current.set(values([["notes.size", "large"], ["notes.theme", "serif"]]));
    read();
    current.set(values([["notes.size", "large"]]));
    read();

    expect(counts).toEqual([1, 1, 1, 2, 3, 4]);
  });

  it("asks again when refreshed, but not when something the provider reads changes", () => {
    const extra = signal("one");
    const seen: string[] = [];
    const supply = new SettingOptionsSupply("notes.size", () => {
      seen.push(extra());
      return options;
    }, signal(values([])), () => undefined);

    supply.options();
    extra.set("two");
    supply.options();
    supply.refresh();
    supply.options();

    expect(seen).toEqual(["one", "two"]);
  });

  it("supplies no options, and reports nothing, when the provider has none", () => {
    const reports: unknown[] = [];
    const supply = new SettingOptionsSupply("notes.size", () => null, signal(values([])), t => reports.push(t));

    expect([supply.options(), reports]).toEqual([null, []]);
  });

  it("supplies no options and reports the module's failure when two options share a value", () => {
    const reports: unknown[] = [];
    const supply = new SettingOptionsSupply("notes.size", () => [new SettingOption("small", "Small"), new SettingOption("small", "Tiny")], signal(values([])), t => reports.push(t));

    expect(supply.options()).toBeNull();
    expect(reports).toHaveLength(1);
    const [report] = reports;
    expect(report).toBeInstanceOf(SettingOptionsRepeatedException);
    expect(report).toMatchObject({
      moduleId: "notes",
      setting: "notes.size",
      message: "The options supplied for the setting notes.size share a value; Settings shows its value alone until they are supplied again."
    });
    expect(report).not.toHaveProperty("cause");
  });

  it("supplies no options and reports the module's failure, with the cause, when the provider throws", () => {
    const failure = new Error("The fonts are not loaded.");
    const reports: unknown[] = [];
    const supply = new SettingOptionsSupply("notes.size", () => {
      throw failure;
    }, signal(values([])), t => reports.push(t));

    expect(supply.options()).toBeNull();
    expect(reports).toHaveLength(1);
    const [report] = reports;
    expect(report).toBeInstanceOf(SettingOptionsFailedException);
    expect(report).toMatchObject({
      moduleId: "notes",
      setting: "notes.size",
      message: "Supplying the options of the setting notes.size failed; Settings shows its value alone until they are supplied again.",
      cause: failure
    });
  });
});
