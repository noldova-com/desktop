/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { CliCommand } from "../../src/enums/cli-command.js";

@TestClass
export class CliCommandTests {
  @TestMethod
  public namesEveryCommandByItsMember(): void {
    Assert.areEqual("Status,Commands,Run,Open,Quit,Help,Module", Object.values(CliCommand).join(","));
  }
}
