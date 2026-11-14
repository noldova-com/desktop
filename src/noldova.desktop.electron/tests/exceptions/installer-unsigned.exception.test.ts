/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallerUnsignedException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class InstallerUnsignedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const installer = "/tmp/setup.exe";
    const problem = "the signature is not trusted";

    const failure = new InstallerUnsignedException(installer, problem);

    Assert.areEqual("The update's installer /tmp/setup.exe is not signed by the publisher, so it was not started: the signature is not trusted", failure.message);
    Assert.areEqual(installer, failure.installer);
    Assert.areEqual(problem, failure.problem);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("InstallerUnsignedException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
