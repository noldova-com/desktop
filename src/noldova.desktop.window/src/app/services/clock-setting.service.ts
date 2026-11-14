/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { DatePattern, QualifiedName, SettingDefinition, SettingLocality, SettingOption, SettingType } from "@noldova/desktop.protocol";

import { ClockChoice } from "../enums/clock-choice.js";
import { Resources } from "../../resources.js";
import { SettingsService } from "./settings.service.js";

@Injectable({ providedIn: "root" })
export class ClockSettingService {
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly timeFormat: Signal<JsonValue | undefined> = computed(() => this.settings.values().get(Resources.timeFormatSetting));
  private readonly isTimeSet: Signal<boolean> = this.settings.isSet(Resources.timeFormatSetting);
  private readonly isDateTimeSet: Signal<boolean> = this.settings.isSet(Resources.dateTimeFormatSetting);

  public readonly definition: SettingDefinition = new SettingDefinition(QualifiedName.parse(Resources.clockSetting), Resources.clockTitle, Resources.clockDescription,
    SettingType.choice(Object.values(ClockChoice).map(t => new SettingOption(t, Resources.clockTitles[t]))), ClockChoice.TwelveHour, SettingLocality.Shared, [],
    Resources.generalPage, Resources.dateTimeGroup);
  public readonly value: Signal<ClockChoice> = computed(() => {
    const pattern = this.timeFormat();
    return Object.isString(pattern) && !DatePattern.isTwelveHour(pattern) ? ClockChoice.TwentyFourHour : ClockChoice.TwelveHour;
  });
  public readonly isSet: Signal<boolean> = computed(() => this.isTimeSet() || this.isDateTimeSet());

  public async chooseAsync(clock: JsonValue): Promise<void> {
    const [time, dateTime] = Resources.clockFormats[clock === ClockChoice.TwentyFourHour ? ClockChoice.TwentyFourHour : ClockChoice.TwelveHour];
    await Promise.all([this.settings.setAsync(Resources.timeFormatSetting, time), this.settings.setAsync(Resources.dateTimeFormatSetting, dateTime)]);
  }

  public async resetAsync(): Promise<void> {
    await Promise.all([this.settings.resetAsync(Resources.timeFormatSetting), this.settings.resetAsync(Resources.dateTimeFormatSetting)]);
  }
}
