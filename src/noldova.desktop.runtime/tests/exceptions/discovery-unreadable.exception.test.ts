/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DiscoveryFormatException, DiscoveryUnreadableException } from "@noldova/desktop.runtime";

@TestClass
export class DiscoveryUnreadableExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new SyntaxError("Unexpected token");

    const exception = new DiscoveryUnreadableException("/data/runtime.json", cause);

    Assert.areEqual("The discovery file /data/runtime.json is not valid: SyntaxError: Unexpected token", exception.message);
    Assert.areEqual("/data/runtime.json", exception.file);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, DiscoveryFormatException);
    Assert.areEqual("DiscoveryUnreadableException", exception.name);
  }
}
