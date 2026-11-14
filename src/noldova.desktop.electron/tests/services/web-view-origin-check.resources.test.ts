/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { WebViewOriginCheckResources } from "../../src/services/web-view-origin-check.resources.js";

@TestClass
export class WebViewOriginCheckResourcesTests {
  @TestMethod
  @TestData(127, 0, 0, 1, "127.0.0.1")
  @TestData(192, 168, 10, 254, "192.168.10.254")
  public formatsTheFourPartsOfAnIpv4AddressWithDots(first: number, second: number, third: number, fourth: number, expected: string): void {
    Assert.areEqual(expected, WebViewOriginCheckResources.formatIpv4(first, second, third, fourth));
  }

  @TestMethod
  public formatsASubdomainSuffixWithALeadingDot(): void {
    Assert.areEqual(".example.org", WebViewOriginCheckResources.formatSubdomainSuffix("example.org"));
  }
}
