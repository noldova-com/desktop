/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { NoRuntimeException } from "@noldova/desktop.runtime";

@TestClass
export class NoRuntimeExceptionTests {
  @TestMethod
  public namesTheDataDirectory(): void {
    const exception = new NoRuntimeException("/home/person/.noldova/desktop");

    Assert.areEqual("No runtime is running for /home/person/.noldova/desktop.", exception.message);
    Assert.areEqual("/home/person/.noldova/desktop", exception.root);
    Assert.areEqual("NoRuntimeException", exception.name);
  }
}
