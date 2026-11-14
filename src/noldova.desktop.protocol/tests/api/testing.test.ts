/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as testing from "@noldova/desktop.protocol/testing";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

@TestClass
export class ProtocolTestingApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    Assert.areEqual(["Fake", "FakeCall", "UnansweredCallException"].join(","), Object.keys(testing).sort().join(","));
  }
}
