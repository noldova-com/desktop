/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { WindowsDeviceNames } from "@noldova/desktop.runtime";

@TestClass
export class WindowsDeviceNamesTests {
  @TestMethod
  public holdsTheTwentyFourNamesWindowsReservesForDevices(): void {
    Assert.areEqual(
      "con,prn,aux,nul,com0,com1,com2,com3,com4,com5,com6,com7,com8,com9,lpt0,lpt1,lpt2,lpt3,lpt4,lpt5,lpt6,lpt7,lpt8,lpt9",
      WindowsDeviceNames.all.join(","));
    Assert.isTrue(WindowsDeviceNames.all.every(t => WindowsDeviceNames.includes(t)));
  }

  @TestMethod
  @TestData("com10")
  @TestData("console")
  @TestData("nul-tools")
  @TestData("lpt")
  @TestData("CON")
  @TestData(String.empty)
  public refusesANameThatOnlyLooksLikeADeviceName(name: string): void {
    Assert.isFalse(WindowsDeviceNames.includes(name));
  }
}
