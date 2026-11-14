/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallerNotStartedException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class InstallerNotStartedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const installer = "/tmp/setup.exe";
    const cause = new Error("EACCES: permission denied");

    const failure = new InstallerNotStartedException(installer, cause);

    Assert.areEqual("The update's installer /tmp/setup.exe could not be started: Error: EACCES: permission denied", failure.message);
    Assert.areEqual(installer, failure.installer);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("InstallerNotStartedException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
