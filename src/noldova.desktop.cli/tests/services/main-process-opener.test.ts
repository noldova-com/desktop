/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MainProcessOpener } from "@noldova/desktop.cli";

@TestClass
export class MainProcessOpenerTests {
  @TestMethod
  public async startsAProgramDetached(): Promise<void> {
    await new MainProcessOpener().openAsync(process.execPath, ["-e", "process.exit(0)"], process.env);
  }

  @TestMethod
  public async rejectsAProgramThatCannotStart(): Promise<void> {
    await Assert.throwsAsync(() => new MainProcessOpener().openAsync(path.join(process.cwd(), "missing-program"), [], process.env), Error);
  }
}
