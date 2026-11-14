/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PreShellData } from "@noldova/desktop.protocol";
import { PreShellDataFoundException } from "@noldova/desktop.runtime";

@TestClass
export class PreShellDataFoundExceptionTests {
  @TestMethod
  public namesWhereTheOldDataIs(): void {
    const data = new PreShellData("/home/person/.noldova/desktop");

    const exception = new PreShellDataFoundException(data);

    Assert.areEqual("The data directory /home/person/.noldova/desktop holds data from a Noldova Desktop Sample release that predates the shell.", exception.message);
    Assert.areEqual(data, exception.data);
    Assert.areEqual("PreShellDataFoundException", exception.name);
  }
}
