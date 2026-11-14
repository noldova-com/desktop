/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { ArgumentsFileUnreadableException } from "../../src/exceptions/arguments-file-unreadable.exception.js";

@TestClass
export class ArgumentsFileUnreadableExceptionTests {
  @TestMethod
  public namesTheFileAndKeepsTheCause(): void {
    const cause = new Error("Unexpected end of JSON input");

    const exception = new ArgumentsFileUnreadableException("args.json", cause);

    Assert.areEqual("The arguments file args.json could not be read: Unexpected end of JSON input", exception.message);
    Assert.areEqual("args.json", exception.file);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("ArgumentsFileUnreadableException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
