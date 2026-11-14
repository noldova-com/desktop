/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SecretFailureKind } from "@noldova/desktop.protocol";

@TestClass
export class SecretFailureKindTests {
  @TestMethod
  public namesEveryKindByItsMember(): void {
    Assert.areEqual("NoDevice,Unprotected,Undecryptable", Object.values(SecretFailureKind).join(","));
  }
}
