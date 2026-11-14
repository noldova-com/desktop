/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import * as api from "@noldova/desktop.cli";

@TestClass
export class CliApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const exportNames = ["Cli", "CliCommandException", "CliException", "CliCommandResult", "CliContext", "CliEntry", "MainProcessOpener", "ExitCode", "UsageException"];

    Assert.areEqual(exportNames.sort().join(","), Object.keys(api).sort().join(","));
  }
}
