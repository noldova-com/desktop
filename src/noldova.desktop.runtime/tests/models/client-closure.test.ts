/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ClientClosure } from "@noldova/desktop.runtime";

@TestClass
export class ClientClosureTests {
  @TestMethod
  public keepsTheConnectionAndTheWindow(): void {
    const closure = new ClientClosure(3, 7);

    Assert.areEqual(3, closure.connection);
    Assert.areEqual(7, closure.window);
  }

  @TestMethod
  public keepsAClosureWithoutAWindow(): void {
    const closure = new ClientClosure(4, null);

    Assert.areEqual(4, closure.connection);
    Assert.isNull(closure.window);
  }
}
