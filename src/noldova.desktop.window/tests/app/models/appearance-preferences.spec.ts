/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FontChoice, ModePreference } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";

import { AppearancePreferences } from "../../../src/app/models/appearance-preferences";

describe("AppearancePreferences", () => {
  const values: Record<string, JsonValue> = {
    "desktop.theme": "desktop.default",
    "desktop.mode": "Dark",
    "desktop.interfaceFont": "System",
    "desktop.codeFont": "Noldova",
    "desktop.panelSize": 15,
    "desktop.messageSize": 16,
    "desktop.codeSize": 12
  };

  it("reads the appearance settings, writes them under their names and reads them back", () => {
    const preferences = AppearancePreferences.fromSettings(name => values[name]);
    const again = AppearancePreferences.fromJson(preferences?.toJson());

    expect([preferences?.theme, preferences?.mode, preferences?.typography.interfaceFont, preferences?.typography.panelSize, preferences?.typography.codeSize])
      .toEqual(["desktop.default", ModePreference.Dark, FontChoice.System, 15, 12]);
    expect(preferences?.toJson()).toEqual(values);
    expect(preferences?.equals(again ?? null)).toBe(true);
    expect(preferences?.equals(null)).toBe(false);
    expect(preferences?.equals(AppearancePreferences.fromSettings(name => name === "desktop.mode" ? "Light" : values[name]))).toBe(false);
  });

  it("reads nothing from values that are missing, of another type, not a choice, out of range or not an object", () => {
    const without = (name: string, value?: JsonValue): AppearancePreferences | null => AppearancePreferences.fromSettings(t => t === name ? value : values[t]);

    expect([
      without("desktop.theme"),
      without("desktop.theme", 1),
      without("desktop.mode", "Sepia"),
      without("desktop.codeFont", "Comic"),
      without("desktop.panelSize", "15"),
      without("desktop.messageSize", 30),
      AppearancePreferences.fromJson(["Dark"]),
      AppearancePreferences.fromJson(null)
    ]).toEqual([null, null, null, null, null, null, null, null]);
  });
});
