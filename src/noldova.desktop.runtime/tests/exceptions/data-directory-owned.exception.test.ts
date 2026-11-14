/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectoryOwnedException } from "@noldova/desktop.runtime";

@TestClass
export class DataDirectoryOwnedExceptionTests {
  @TestMethod
  public namesTheOwnedDirectoryAndKeepsTheCause(): void {
    const cause = new Error("database is locked");
    const exception = new DataDirectoryOwnedException("/data/noldova-desktop", new ExceptionOptions(cause));

    Assert.areEqual("Another Noldova Desktop Sample runtime owns the data directory /data/noldova-desktop.", exception.message);
    Assert.areEqual("/data/noldova-desktop", exception.root);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.areEqual("DataDirectoryOwnedException", exception.name);
    Assert.isInstanceOf(exception, Exception);
  }
}
