/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DatePattern } from "@noldova/desktop.protocol";

@TestClass
export class DatePatternTests {
  private static readonly MORNING: Date = new Date(2026, 8, 3, 9, 5, 7);
  private static readonly AFTERNOON: Date = new Date(2026, 8, 10, 13, 5, 0);

  @TestMethod
  public formatsEveryNumberToken(): void {
    Assert.areEqual("2026-09-03 09:05:07", DatePattern.format(DatePatternTests.MORNING, "yyyy-MM-dd HH:mm:ss"));
    Assert.areEqual("26/9/3 9", DatePattern.format(DatePatternTests.MORNING, "yy/M/d H"));
    Assert.areEqual("10 13:05", DatePattern.format(DatePatternTests.AFTERNOON, "dd HH:mm"));
  }

  @TestMethod
  public formatsMonthAndWeekdayNamesInBritishEnglish(): void {
    Assert.areEqual(`10 ${DatePatternTests.AFTERNOON.toLocaleString("en-GB", { month: "short" })} 2026, 13:05`, DatePattern.format(DatePatternTests.AFTERNOON, "d MMM yyyy, HH:mm"));
    Assert.areEqual("September 10, 2026", DatePattern.format(DatePatternTests.AFTERNOON, "MMMM d, yyyy"));
    Assert.areEqual("Thu Thursday", DatePattern.format(DatePatternTests.MORNING, "EEE EEEE"));
  }

  @TestMethod
  public formatsATwelveHourClockWithTwelveForMidnightAndNoon(): void {
    Assert.areEqual("09:05 AM", DatePattern.format(DatePatternTests.MORNING, "hh:mm a"));
    Assert.areEqual("1:05 PM", DatePattern.format(DatePatternTests.AFTERNOON, "h:mm a"));
    Assert.areEqual("12:30 AM", DatePattern.format(new Date(2026, 0, 1, 0, 30), "h:mm a"));
    Assert.areEqual("12:00 PM", DatePattern.format(new Date(2026, 0, 1, 12, 0), "h:mm a"));
  }

  @TestMethod
  public keepsQuotedTextPunctuationAndOtherLettersAsTheyAre(): void {
    Assert.areEqual("at 13 sharp", DatePattern.format(DatePatternTests.AFTERNOON, "'at' HH 'sharp'"));
    Assert.areEqual("today at 1:05 PM, day 10", DatePattern.format(DatePatternTests.AFTERNOON, "'today at' h:mm a, 'day' d"));
    Assert.areEqual("13 o'clock", DatePattern.format(DatePatternTests.AFTERNOON, "H o'clock"));
    Assert.areEqual("Q3 W 26y", DatePattern.format(DatePatternTests.AFTERNOON, "Q3 W yyy"));
    Assert.areEqual(String.empty, DatePattern.format(DatePatternTests.AFTERNOON, String.empty));
  }

  @TestMethod
  public tellsATwelveHourPatternByItsTokensOutsideQuotes(): void {
    for (const pattern of ["h:mm a", "hh:mm", "HH:mm a", "MMM d, yyyy, h:mm a"])
      Assert.isTrue(DatePattern.isTwelveHour(pattern), pattern);
    for (const pattern of ["HH:mm", "d MMM yyyy, HH:mm", "'at' HH:mm", "'h a' H", String.empty])
      Assert.isFalse(DatePattern.isTwelveHour(pattern), pattern);
  }
}
