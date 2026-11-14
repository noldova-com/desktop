/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProductInfo } from "@noldova/desktop.runtime";

import { MainProcessStartFixture } from "./fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "./fixtures/fake-main-process-environment.fixture.js";
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
}
