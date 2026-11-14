/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandFailedException, SystemCommand } from "@noldova/desktop.runtime";

@TestClass
export class SystemCommandTests {
  @TestMethod
  public async returnsTheStandardOutputWithoutAShell(): Promise<void> {
    const output = await new SystemCommand().runAsync(process.execPath, ["-e", "process.stdout.write(process.argv[1])", "a & b | c"]);

    Assert.areEqual("a & b | c", output);
  }

  @TestMethod
  public async reportsANonzeroExitWithTheProgramsError(): Promise<void> {
    const exception = await Assert.throwsAsync(
      () => new SystemCommand().runAsync(process.execPath, ["-e", "process.stderr.write(\"denied\"); process.exitCode = 5"]),
      CommandFailedException);

    Assert.isTrue(exception.message.startsWith(`${process.execPath} failed: `));
    Assert.isTrue(exception.message.includes("denied"));
    Assert.isInstanceOf(exception.cause, Error);
  }

  @TestMethod
  public async stopsAProgramThatOutlivesItsTimeLimit(): Promise<void> {
    const exception = await Assert.throwsAsync(() => new SystemCommand().runAsync(process.execPath, ["-e", "setTimeout(() => {}, 20_000)"], process.env, 200), CommandFailedException);

    const cause = exception.cause;
    Assert.isTrue(cause instanceof Error && "killed" in cause && cause.killed === true, "the command was stopped at its time limit");
  }

  @TestMethod
  public async reportsAProgramThatCannotStart(): Promise<void> {
    await Assert.throwsAsync(() => new SystemCommand().runAsync("noldova-desktop-missing-program", []), CommandFailedException);
  }
}
