/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DebianInstallerMissingException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class DebianInstallerMissingExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new DebianInstallerMissingException();

    Assert.areEqual("This copy of Noldova Desktop Sample is a Debian package, but this system has no pkexec to ask for an administrator's permission, so it can't install the update.",
      failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("DebianInstallerMissingException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
