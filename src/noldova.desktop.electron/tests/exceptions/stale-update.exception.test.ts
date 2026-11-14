/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ElectronException, StaleUpdateException, UpdateChangedBeforeHandoffException, UpdateNoLongerOfferedException } from "@noldova/desktop.electron";

@TestClass
export class StaleUpdateExceptionTests {
  @TestMethod
  public isTheCategoryOfEachOfItsConditions(): void {
    const exceptions: readonly StaleUpdateException[] = [
      new UpdateChangedBeforeHandoffException(),
      new UpdateNoLongerOfferedException("1.3.0")
    ];

    for (const exception of exceptions) {
      Assert.isInstanceOf(exception, StaleUpdateException);
      Assert.isInstanceOf(exception, ElectronException);
    }
  }
}
