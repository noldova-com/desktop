/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ElectronException, WindowStateNotConnectedException, WindowStateRuntimeUnreachableException, WindowStateUnavailableException } from "@noldova/desktop.electron";
import { CallUnansweredException } from "@noldova/desktop.runtime";

@TestClass
export class WindowStateUnavailableExceptionTests {
  @TestMethod
  public isTheCategoryOfEachOfItsConditions(): void {
    const exceptions: readonly WindowStateUnavailableException[] = [
      new WindowStateNotConnectedException(),
      new WindowStateRuntimeUnreachableException(new CallUnansweredException("desktop.writeWindowBounds"))
    ];

    for (const exception of exceptions) {
      Assert.isInstanceOf(exception, WindowStateUnavailableException);
      Assert.isInstanceOf(exception, ElectronException);
    }
  }
}
