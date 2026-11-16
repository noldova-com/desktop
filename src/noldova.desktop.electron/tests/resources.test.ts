/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ProductInfo } from "@noldova/desktop.runtime";

import { MainProcessStartFixture } from "./fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "./fixtures/fake-main-process-environment.fixture.js";
import { Resources } from "../src/resources.js";

import { FakeElectron } from "./fixtures/fake-electron.fixture.js";

@TestClass
export class ResourcesTests {
  @TestMethod
  public async namesItselfAndItsDevelopmentTaskbarEntryAfterTheProduct(): Promise<void> {
    const product = ProductInfo.current;
    const electron = new FakeElectron();
    await MainProcessStartFixture.startAsync(electron, new FakeMainProcessEnvironment("win32"));
    await MainProcessStartFixture.openAsync(electron);

    Assert.isTrue(electron.app.calls.includes(`setName ${product.name}`), electron.app.calls.join(", "));
    Assert.isTrue(MainProcessStartFixture.firstWindow(electron).appDetails?.appId?.startsWith(`${product.developmentApplicationId}.`) === true);
  }

  @TestMethod
  @TestData(127, 0, 0, 1, "127.0.0.1")
  @TestData(192, 168, 10, 254, "192.168.10.254")
  public formatsTheFourPartsOfAnIpv4AddressWithDots(first: number, second: number, third: number, fourth: number, expected: string): void {
    Assert.areEqual(expected, Resources.formatIpv4(first, second, third, fourth));
  }

  @TestMethod
  public formatsASubdomainSuffixWithALeadingDot(): void {
    Assert.areEqual(".example.org", Resources.formatSubdomainSuffix("example.org"));
  }
}
