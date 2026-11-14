/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ModuleLoadException } from "@noldova/desktop.runtime";

@TestClass
export class ModuleLoadExceptionTests {
  @TestMethod
  public saysThatThePackageExportsNoRuntimePart(): void {
    const exception = new ModuleLoadException();

    Assert.areEqual("The package does not export a RuntimePart class whose instances can activate and deactivate.", exception.message);
    Assert.areEqual("ModuleLoadException", exception.name);
  }
}
