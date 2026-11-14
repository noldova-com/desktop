/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, UpdatePreparingException } from "@noldova/desktop.runtime";

@TestClass
export class UpdatePreparingExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new UpdatePreparingException("notes", "git");

    Assert.areEqual("git was not started for the module notes, because the runtime is preparing for an update.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("git", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("UpdatePreparingException", exception.name);
  }
}
