/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";

export class DatePattern {
  public static format(date: Date, pattern: string): string {
    return pattern.replace(Resources.datePatternTokens, t => DatePattern.token(date, t));
  }

  public static isTwelveHour(pattern: string): boolean {
    return Array.from(pattern.matchAll(Resources.datePatternTokens), t => t[0]).some(t => Resources.twelveHourTokens.includes(t));
  }

  private static token(date: Date, token: string): string {
    if (token.startsWith(Resources.quoteMark))
      return token.slice(1, -1);
    switch (token) {
      case Resources.fullYearToken:
        return String(date.getFullYear());
      case Resources.shortYearToken:
        return DatePattern.pad(date.getFullYear() % Resources.yearsPerCentury);
      case Resources.longMonthToken:
        return date.toLocaleString(Resources.dateLocale, Resources.longMonthFormat);
      case Resources.shortMonthToken:
        return date.toLocaleString(Resources.dateLocale, Resources.shortMonthFormat);
      case Resources.paddedMonthToken:
        return DatePattern.pad(date.getMonth() + 1);
      case Resources.monthToken:
        return String(date.getMonth() + 1);
      case Resources.paddedDayToken:
        return DatePattern.pad(date.getDate());
      case Resources.dayToken:
        return String(date.getDate());
      case Resources.longWeekdayToken:
        return date.toLocaleString(Resources.dateLocale, Resources.longWeekdayFormat);
      case Resources.shortWeekdayToken:
        return date.toLocaleString(Resources.dateLocale, Resources.shortWeekdayFormat);
      case Resources.paddedHourToken:
        return DatePattern.pad(date.getHours());
      case Resources.hourToken:
        return String(date.getHours());
      case Resources.paddedTwelveHourToken:
        return DatePattern.pad(DatePattern.twelveHour(date));
      case Resources.twelveHourToken:
        return String(DatePattern.twelveHour(date));
      case Resources.paddedMinuteToken:
        return DatePattern.pad(date.getMinutes());
      case Resources.paddedSecondToken:
        return DatePattern.pad(date.getSeconds());
      default:
        return date.getHours() < Resources.hoursPerHalfDay ? Resources.morningMarker : Resources.afternoonMarker;
    }
  }

  private static twelveHour(date: Date): number {
    const hour = date.getHours() % Resources.hoursPerHalfDay;
    return hour === 0 ? Resources.hoursPerHalfDay : hour;
  }

  private static pad(value: number): string {
    return String(value).padStart(Resources.datePadLength, Resources.datePadCharacter);
  }
}
