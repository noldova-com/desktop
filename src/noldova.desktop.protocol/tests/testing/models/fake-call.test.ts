/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FakeCall } from "@noldova/desktop.protocol/testing";

interface ILog {
  write(message: string): void;
}

@TestClass
export class FakeCallTests {
  @TestMethod
  public keepsTheMemberAndTheArguments(): void {
    const call = new FakeCall<ILog>("write", ["Started."]);

    Assert.areEqual("write Started.", [call.member, ...call.args].join(" "));
  }
}
