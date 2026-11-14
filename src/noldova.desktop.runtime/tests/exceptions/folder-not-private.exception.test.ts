/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FolderNotPrivateException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class FolderNotPrivateExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new FolderNotPrivateException("/home/person/.noldova", "drwxr-xr-x");

    Assert.areEqual("The folder /home/person/.noldova is still open to others: drwxr-xr-x", exception.message);
    Assert.areEqual("/home/person/.noldova", exception.folder);
    Assert.areEqual("drwxr-xr-x", exception.access);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("FolderNotPrivateException", exception.name);
  }
}
