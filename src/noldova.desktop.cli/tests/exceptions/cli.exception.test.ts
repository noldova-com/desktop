/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CliCommandException, CliException, UsageException } from "@noldova/desktop.cli";

import { CliCommandsUnreadableException } from "../../src/exceptions/cli-commands-unreadable.exception.js";
import { CommandRequiredException } from "../../src/exceptions/command-required.exception.js";
import { MainProcessNotStartedException } from "../../src/exceptions/main-process-not-started.exception.js";
import { ModuleNotActiveException } from "../../src/exceptions/module-not-active.exception.js";

@TestClass
export class CliExceptionTests {
  @TestMethod
  public isTheBaseOfEveryExceptionThePackageOwns(): void {
    const exceptions = [
      new UsageException("Wrong."),
      new CliCommandException("Failed", "It failed."),
      new ModuleNotActiveException("probe", "It is off."),
      new CommandRequiredException(),
      new CliCommandsUnreadableException("modules.json", new Error("Broken.")),
      new MainProcessNotStartedException(new Error("Gone."))
    ];
    for (const exception of exceptions) {
      Assert.isInstanceOf(exception, CliException);
      Assert.isInstanceOf(exception, Exception);
    }
  }
}
