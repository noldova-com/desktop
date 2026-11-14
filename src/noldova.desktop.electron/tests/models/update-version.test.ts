/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { UpdateVersion } from "../../src/models/update-version.js";

@TestClass
export class UpdateVersionTests {
  @TestMethod
  @TestData("1.3.0", true)
  @TestData("0.0.3-internal.7", true)
  @TestData("0.0.3-internal.0", true)
  @TestData("1.3.0-beta.1", false)
  @TestData("1.3.0-internal", false)
  @TestData("1.3.0-internal.07", false)
  @TestData("1.3.0-internal.7.1", false)
  @TestData("1.3", false)
  @TestData("01.3.0", false)
  public offersOnlyReleasesAndInternalBuilds(version: string, isOffered: boolean): void {
    Assert.areEqual(isOffered, UpdateVersion.isOffered(version));
  }

  @TestMethod
  @TestData("1.3.0", "1.2.0", true)
  @TestData("1.10.0", "1.9.0", true)
  @TestData("1.2.0", "1.2.0", false)
  @TestData("1.2.0", "1.3.0", false)
  @TestData("0.0.3-internal.7", "0.0.2", true)
  @TestData("0.0.3-internal.8", "0.0.3-internal.7", true)
  @TestData("0.0.3-internal.10", "0.0.3-internal.9", true)
  @TestData("0.0.3", "0.0.3-internal.10", true)
  @TestData("0.0.3-internal.7", "0.0.3-internal.7", false)
  @TestData("0.0.3-internal.7", "0.0.3-internal.8", false)
  @TestData("0.0.3-internal.99", "0.0.3", false)
  @TestData("0.0.2", "0.0.3-internal.1", false)
  @TestData("1.3.0-beta.1", "1.2.0", false)
  @TestData("1.3.0", "unknown", false)
  public ordersInternalBuildsAfterTheReleaseBeforeAndBeforeTheReleaseTheyLeadTo(version: string, current: string, isNewer: boolean): void {
    Assert.areEqual(isNewer, UpdateVersion.isNewer(version, current));
  }
}
