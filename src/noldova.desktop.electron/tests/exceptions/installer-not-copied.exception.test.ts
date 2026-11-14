/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallerNotCopiedException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class InstallerNotCopiedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("EACCES: permission denied");

    const failure = new InstallerNotCopiedException(new ExceptionOptions(cause));

    Assert.areEqual("Noldova Desktop Sample couldn't make a protected copy of the update's installer.", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("InstallerNotCopiedException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
