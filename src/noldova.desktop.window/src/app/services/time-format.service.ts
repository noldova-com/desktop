/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import "@noldova/context.core";
import { DatePattern } from "@noldova/desktop.protocol";

import type { IDatePatternPart } from "../interfaces/i-date-pattern-part.js";
import { Resources } from "../../resources.js";
import { TimeFormatsService } from "./time-formats.service.js";

@Injectable({ providedIn: "root" })
export class TimeFormatService {
  private readonly formats: TimeFormatsService = inject(TimeFormatsService);
  private readonly shortDateTimePattern: Signal<string> = computed(() => TimeFormatService.shorten(this.formats.dateTime(), Resources.yearAndWeekdayTokens,
    Resources.defaultShortDateFormat));
  private readonly shortDatePattern: Signal<string> = computed(() => TimeFormatService.shorten(this.formats.dateTime(),
    [...Resources.yearAndWeekdayTokens, ...Resources.timeTokens], Resources.defaultShortDateFormat));
  private readonly datePattern: Signal<string> = computed(() => TimeFormatService.shorten(this.formats.dateTime(), Resources.timeTokens,
    Resources.defaultDateFormat));
  private readonly weekdayTimePattern: Signal<string> = computed(() => Resources.formatWeekdayTimePattern(this.formats.time()));

  public time(at: string | number): string {
    return DatePattern.format(new Date(at), this.formats.time());
  }

  public dateTime(at: string | number): string {
    return DatePattern.format(new Date(at), this.formats.dateTime());
  }

  public shortDateTime(at: string | number): string {
    return DatePattern.format(new Date(at), this.shortDateTimePattern());
  }

  public date(at: string | number): string {
    return DatePattern.format(new Date(at), this.datePattern());
  }

  public shortDate(at: string | number): string {
    return DatePattern.format(new Date(at), this.shortDatePattern());
  }

  public weekdayTime(at: string | number): string {
    return DatePattern.format(new Date(at), this.weekdayTimePattern());
  }

  private static shorten(pattern: string, dropped: readonly string[], fallback: string): string {
    const parts: IDatePatternPart[] = [];
    pattern.split(Resources.datePatternToken).forEach((text, index) => {
      const isToken = index % 2 === 1 && !text.startsWith(Resources.datePatternQuote);
      const last = parts.at(-1);
      if (!isToken && !Object.isUndefined(last) && !last.isToken)
        parts.splice(-1, 1, { text: last.text + text, isToken: false });
      else if (isToken || text.length > 0)
        parts.push({ text, isToken });
    });
    for (let at = TimeFormatService.findDropped(parts, dropped); at >= 0; at = TimeFormatService.findDropped(parts, dropped)) {
      const before = parts[at - 1]?.isToken === false;
      const after = parts[at + 1]?.isToken === false;
      parts.splice(before ? at - 1 : at, before || after ? 2 : 1);
    }
    return parts.some(t => t.isToken) ? parts.map(t => t.text).join(String.empty) : fallback;
  }

  private static findDropped(parts: readonly IDatePatternPart[], dropped: readonly string[]): number {
    return parts.findIndex(t => t.isToken && dropped.includes(t.text));
  }
}
