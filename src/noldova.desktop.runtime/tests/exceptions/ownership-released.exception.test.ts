/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { OwnershipReleasedException } from "@noldova/desktop.runtime";

@TestClass
export class OwnershipReleasedExceptionTests {
  @TestMethod
  public saysTheOwnershipWasReleased(): void {
    const exception = new OwnershipReleasedException();

    Assert.areEqual("The data directory's ownership has been released.", exception.message);
    Assert.areEqual("OwnershipReleasedException", exception.name);
  }
}
