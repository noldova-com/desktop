/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SecretFailureReason } from "@noldova/desktop.protocol";

@TestClass
export class SecretFailureReasonTests {
  @TestMethod
  public namesEveryReasonByItsMember(): void {
    Assert.areEqual("NotConnected,NoDevice,Unprotected,Undecryptable", Object.values(SecretFailureReason).join(","));
  }
}
