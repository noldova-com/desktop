/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProductInfo } from "@noldova/desktop.runtime";

import { MainProcessNotStartedException } from "../../src/exceptions/main-process-not-started.exception.js";

@TestClass
export class MainProcessNotStartedExceptionTests {
  @TestMethod
  public namesTheProductAndKeepsTheFailureThatCausedIt(): void {
    const cause = new Error("spawn ENOENT");

    const exception = new MainProcessNotStartedException(cause);

    Assert.areEqual(`${ProductInfo.current.name} could not be started.`, exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("MainProcessNotStartedException", exception.name);
  }
}
