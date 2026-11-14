/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { sign, signWindowsFile } from "../../../src/services/packaging/windows-sign-hook.js";

@TestClass
export class WindowsSignHookTests {
  @TestMethod
  public exportsTheHookUnderTheNameElectronBuilderCalls(): void {
    Assert.areEqual(signWindowsFile, sign);
  }

  @TestMethod
  public async refusesToSignOutsideAPackagingRunThatPreparedTheModule(): Promise<void> {
    const error = await Assert.throwsAsync(() => sign({ path: "Sample.exe" }), BuildException);

    Assert.isTrue(error.message.startsWith("NOLDOVA_DESKTOP_SIGNING_FOLDER must name the folder that holds the prepared "), error.message);
  }
}
