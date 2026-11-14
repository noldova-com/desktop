/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SecretAction } from "@noldova/desktop.protocol";

@TestClass
export class SecretActionTests {
  @TestMethod
  public namesEveryActionByItsMember(): void {
    Assert.areEqual("Device,Encrypt,Decrypt", Object.values(SecretAction).join(","));
  }
}
