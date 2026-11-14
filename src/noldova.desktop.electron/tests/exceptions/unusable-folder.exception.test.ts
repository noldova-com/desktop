/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UnusableFolderException } from "@noldova/desktop.electron";

@TestClass
export class UnusableFolderExceptionTests {
  @TestMethod
  public namesTheFolderAndKeepsTheCause(): void {
    const cause = new Error("Failed to set path");

    const failure = new UnusableFolderException("/home/person/data", cause);

    Assert.areEqual("Noldova Desktop Sample cannot use the data folder /home/person/data: Error: Failed to set path", failure.message);
    Assert.areEqual("/home/person/data", failure.folder);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("UnusableFolderException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
