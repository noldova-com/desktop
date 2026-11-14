/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { CliCommandsUnreadableException } from "../../src/exceptions/cli-commands-unreadable.exception.js";

@TestClass
export class CliCommandsUnreadableExceptionTests {
  @TestMethod
  public namesTheFileAndKeepsTheFailureThatCausedIt(): void {
    const cause = new Error("A command has no word.");

    const exception = new CliCommandsUnreadableException("modules.json", cause);

    Assert.areEqual("The module declarations modules.json hold command-line commands that are not valid: A command has no word.", exception.message);
    Assert.areEqual("modules.json", exception.file);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("CliCommandsUnreadableException", exception.name);
  }
}
