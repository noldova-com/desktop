/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  ElectronException, WindowStateException, WindowStateNotConnectedException, WindowStateRefusedException, WindowStateRuntimeUnreachableException
} from "@noldova/desktop.electron";
import { Failure, FailureCode, QualifiedName } from "@noldova/desktop.protocol";
import { CallUnansweredException } from "@noldova/desktop.runtime";

@TestClass
export class WindowStateExceptionTests {
  @TestMethod
  public isTheCategoryOfEachOfItsConditions(): void {
    const exceptions: readonly WindowStateException[] = [
      new WindowStateRefusedException(new QualifiedName("desktop", "writeWindowBounds"), new Failure(FailureCode.Internal, "The database is busy.")),
      new WindowStateNotConnectedException(),
      new WindowStateRuntimeUnreachableException(new CallUnansweredException("desktop.writeWindowBounds"))
    ];

    for (const exception of exceptions) {
      Assert.isInstanceOf(exception, WindowStateException);
      Assert.isInstanceOf(exception, ElectronException);
    }
  }
}
