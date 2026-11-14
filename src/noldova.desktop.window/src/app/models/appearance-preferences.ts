/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FontChoice, ModePreference, Typography } from "@noldova/ui.components.angular";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";

import { Resources } from "../../resources.js";

export class AppearancePreferences {
  private static readonly SETTINGS: readonly string[] = [Resources.themeSetting, Resources.modeSetting, Resources.panelSizeSetting, Resources.messageSizeSetting, Resources.codeSizeSetting, Resources.interfaceFontSetting, Resources.codeFontSetting];

  public readonly theme: string;
  public readonly mode: ModePreference;
  public readonly typography: Typography;

  public constructor(theme: string, mode: ModePreference, typography: Typography) {
    this.theme = theme;
    this.mode = mode;
    this.typography = typography;
  }

  public static fromSettings(read: (name: string) => JsonValue | undefined): AppearancePreferences | null {
    return AppearancePreferences.fromJson(Object.fromEntries(AppearancePreferences.SETTINGS.map(t => [t, read(t)])));
  }

  public static fromJson(value: unknown): AppearancePreferences | null {
    try {
      return AppearancePreferences.read(JsonReader.fromValue(value));
    }
    catch {
      return null;
    }
  }

  public equals(other: AppearancePreferences | null): boolean {
    return !Object.isNull(other) && JSON.stringify(this.toJson()) === JSON.stringify(other.toJson());
  }

  public toJson(): JsonObject {
    return {
      [Resources.themeSetting]: this.theme,
      [Resources.modeSetting]: this.mode,
      [Resources.interfaceFontSetting]: this.typography.interfaceFont,
      [Resources.codeFontSetting]: this.typography.codeFont,
      [Resources.panelSizeSetting]: this.typography.panelSize,
      [Resources.messageSizeSetting]: this.typography.messageSize,
      [Resources.codeSizeSetting]: this.typography.codeSize
    };
  }

  private static read(json: JsonReader): AppearancePreferences {
    return new AppearancePreferences(
      json.readString(Resources.themeSetting),
      json.readOneOf(Resources.modeSetting, Object.values(ModePreference)),
      new Typography(
        json.readNumber(Resources.panelSizeSetting),
        json.readNumber(Resources.messageSizeSetting),
        json.readNumber(Resources.codeSizeSetting),
        json.readOneOf(Resources.interfaceFontSetting, Object.values(FontChoice)),
        json.readOneOf(Resources.codeFontSetting, Object.values(FontChoice))));
  }
}
