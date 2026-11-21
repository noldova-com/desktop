/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RemovalUnclaimedException, RuntimeException } from "@noldova/desktop.runtime";

@TestClass
export class RemovalUnclaimedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFile(): void {
    const exception = new RemovalUnclaimedException("barrier.json");

    Assert.areEqual("The process removing barrier.json is not in the process table, so it cannot claim the removal.", exception.message);
    Assert.areEqual("barrier.json", exception.file);
    Assert.isInstanceOf(exception, RuntimeException);
    Assert.areEqual("RemovalUnclaimedException", exception.name);
  }
}
