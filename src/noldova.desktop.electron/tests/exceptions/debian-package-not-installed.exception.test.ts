/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DebianPackageNotInstalledException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class DebianPackageNotInstalledExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const file = "/tmp/Sample-linux-x64.deb";
    const cause = new Error("Command failed: pkexec");

    const failure = new DebianPackageNotInstalledException(file, cause);

    Assert.areEqual("The Debian package /tmp/Sample-linux-x64.deb could not be installed, so the installed version was left as it was: Error: Command failed: pkexec", failure.message);
    Assert.areEqual(file, failure.file);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("DebianPackageNotInstalledException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
