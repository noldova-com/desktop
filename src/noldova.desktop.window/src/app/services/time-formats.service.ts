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
import { DatePattern } from "@noldova/desktop.protocol";
import { TimeFormats } from "@noldova/ui.components.angular";

import { ClockChoice } from "../enums/clock-choice.js";
import { Resources } from "../../resources.js";
import { SettingsService } from "./settings.service.js";

@Injectable({ providedIn: "root" })
export class TimeFormatsService {
  private readonly settings: SettingsService = inject(SettingsService);
  public readonly time: Signal<string> = this.patternOf(Resources.timeFormatSetting, Resources.clockFormats[ClockChoice.TwelveHour][0]);
  public readonly dateTime: Signal<string> = this.patternOf(Resources.dateTimeFormatSetting, Resources.clockFormats[ClockChoice.TwelveHour][1]);

  public readonly formats: Signal<TimeFormats> = computed(() => {
    const time = this.time();
    const dateTime = this.dateTime();
    return new TimeFormats(t => DatePattern.format(t, time), t => DatePattern.format(t, dateTime));
  });

  private patternOf(name: string, fallback: string): Signal<string> {
    const value: Signal<JsonValue | undefined> = this.settings.value(name);
    return computed(() => {
      const pattern = value();
      return Object.isString(pattern) && pattern.trim().length > 0 ? pattern : fallback;
    });
  }
}
