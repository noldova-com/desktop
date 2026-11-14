/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as testing from "@noldova/desktop.runtime/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

@TestClass
export class RuntimeTestingApiTests {
  @TestMethod
  public exportsAFakeOfEachInterfaceTheRuntimeHandsAModule(): void {
    const exportNames = [
      "FakeAppShortcuts",
      "FakeAppWindows",
      "FakeModuleDatabase",
      "FakeModuleLog",
      "FakeModuleSecrets",
      "FakeModuleSettings",
      "FakePermissionsContext",
      "FakeRuntimeFiles",
      "FakeRuntimePartContext",
      "FakeRuntimeWebViews",
      "FakeToolsContext",
      "FakeWebViewRelay"
    ];

    Assert.areEqual(exportNames.join(","), Object.keys(testing).sort().join(","));
  }
}
