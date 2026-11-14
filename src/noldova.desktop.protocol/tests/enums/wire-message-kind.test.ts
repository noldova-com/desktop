/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WireMessageKind } from "@noldova/desktop.protocol";

@TestClass
export class WireMessageKindTests {
  @TestMethod
  public namesEveryKindByItsMember(): void {
    Assert.areEqual("Handshake,Request,Response,Event,Cancel", Object.values(WireMessageKind).join(","));
  }
}
