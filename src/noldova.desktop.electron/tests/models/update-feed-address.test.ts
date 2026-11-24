/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { UpdateFeedAddress } from "../../src/models/update-feed-address.js";

@TestClass
export class UpdateFeedAddressTests {
  @TestMethod
  @TestData("https://updates.example.com/desktop/")
  @TestData("http://192.168.1.20:47324/")
  @TestData("not an address")
  public refusesAFeedOffThisMachineToABuildThatIsNotPackaged(address: string): void {
    Assert.isFalse(new UpdateFeedAddress(address).isAllowed(false));
  }

  @TestMethod
  @TestData("http://127.0.0.1:47324/")
  @TestData("http://localhost:47324/")
  @TestData("http://[::1]:47324/")
  public allowsAFeedOnThisMachineToABuildThatIsNotPackaged(address: string): void {
    Assert.isTrue(new UpdateFeedAddress(address).isAllowed(false));
  }

  @TestMethod
  public allowsAnyFeedToAPackagedBuild(): void {
    Assert.isTrue(new UpdateFeedAddress("https://updates.example.com/desktop/").isAllowed(true));
  }

  @TestMethod
  public namesTheFeedsHostAndAnInvalidAddressAsSuch(): void {
    Assert.areEqual("updates.example.com:8443", new UpdateFeedAddress("https://updates.example.com:8443/desktop/").host);
    Assert.areEqual("an invalid address", new UpdateFeedAddress("not an address").host);
  }

  @TestMethod
  public refusesByNamingTheFeedsHostAlone(): void {
    Assert.areEqual("This development build doesn't check for updates at updates.example.com; a build that isn't packaged checks only a feed on this machine.",
      new UpdateFeedAddress("https://updates.example.com/desktop/?token=x").refusal);
  }
}
