/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { VersionRange } from "../../../src/models/modules/version-range.js";

@TestClass
export class VersionRangeTests {
  @TestMethod
  public readsARangeFromALowestVersionBelowAFirstRefusedOne(): void {
    const range = VersionRange.parse(">=0.0.7 <0.1.0");

    Assert.areEqual("0.0.7|0.1.0|>=0.0.7 <0.1.0", [range?.minimum, range?.below, String(range)].join("|"));
    Assert.isTrue(range?.isFollowing() ?? false);
    Assert.isFalse(VersionRange.parse(">=0.0.7 <0.2.0")?.isFollowing() ?? true);
  }

  @TestMethod
  @TestData("0.0.7")
  @TestData(">=0.0.7")
  @TestData(">=0.7 <0.8.0")
  @TestData(">=0.0.7 <0.8")
  @TestData(">=0.1.0 <0.1.0")
  @TestData(">=0.2.0 <0.1.0")
  public readsNoRangeOfAnyOtherForm(text: string): void {
    Assert.isNull(VersionRange.parse(text));
  }

  @TestMethod
  public endsTheRangeThatFollowsAVersionAtTheNextMinorBelowOneAndTheNextMajorFromOne(): void {
    Assert.areEqual(">=0.0.7 <0.1.0", String(VersionRange.following("0.0.7")));
    Assert.areEqual(">=1.2.3 <2.0.0", String(VersionRange.following("1.2.3")));
    Assert.isNull(VersionRange.following("1.2"));
  }

  @TestMethod
  public includesTheVersionsFromItsLowestBelowItsFirstRefused(): void {
    const range = VersionRange.parse(">=1.2.3 <2.0.0");

    Assert.areEqual("false,true,true,true,false,false", ["1.2.2", "1.2.3", "1.10.0", "1.99.99", "2.0.0", "1.x.0"].map(t => String(range?.includes(t))).join(","));
    Assert.areEqual("1.10.0", range?.newestOf(["1.2.3", "1.10.0", "1.9.0", "2.0.0"]));
    Assert.isNull(range?.newestOf(["1.0.0", "2.0.0"]) ?? null);
  }

  @TestMethod
  public tellsAVersion(): void {
    Assert.areEqual("true,true,false,false,false", ["0.0.0", "10.20.30", "01.0.0", "1.0", "1.0.0-rc.1"].map(t => String(VersionRange.isVersion(t))).join(","));
  }
}
