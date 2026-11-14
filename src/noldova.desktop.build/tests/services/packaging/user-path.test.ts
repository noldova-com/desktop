/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { tmpdir } from "node:os";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { UserPath } from "../../../src/services/packaging/user-path.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";

class RegistryRunner extends ProcessRunner {
  private readonly query: ProcessResult;

  public readonly calls: string[] = [];

  public constructor(query: ProcessResult) {
    super();
    this.query = query;
  }

  public override captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    const [command, commandArguments] = call;
    this.calls.push([command, ...commandArguments].join(" "));
    return Promise.resolve(commandArguments[0] === "query" ? this.query : new ProcessResult(0, "The operation completed successfully.", String.empty));
  }
}

@TestClass
export class UserPathTests {
  private static readonly ENTRY: string = "C:\\Users\\sample\\AppData\\Local\\Programs\\sample-app\\bin";

  @TestMethod
  public countsAnEntryWhateverItsCase(): void {
    const value = `C:\\other;${UserPathTests.ENTRY.toUpperCase()};${UserPathTests.ENTRY}`;

    Assert.areEqual(2, UserPath.count(value, UserPathTests.ENTRY));
    Assert.areEqual(0, UserPath.count(null, UserPathTests.ENTRY));
    Assert.areEqual(0, UserPath.count("C:\\other", UserPathTests.ENTRY));
  }

  @TestMethod
  public async readsTheUsersPath(): Promise<void> {
    const runner = new RegistryRunner(UserPathTests.answer("REG_EXPAND_SZ", `%USERPROFILE%\\tools;${UserPathTests.ENTRY}`));

    const value = await new UserPath(runner, tmpdir()).readAsync();

    Assert.areEqual(`%USERPROFILE%\\tools;${UserPathTests.ENTRY}`, value);
    Assert.areEqual("reg.exe query HKCU\\Environment /v Path", runner.calls.join("|"));
  }

  @TestMethod
  public async readsNoPathWhenTheUserHasNone(): Promise<void> {
    const runner = new RegistryRunner(new ProcessResult(1, String.empty, "ERROR: The system was unable to find the specified registry key or value."));

    const value = await new UserPath(runner, tmpdir()).readAsync();
    const removed = await new UserPath(runner, tmpdir()).removeAsync(UserPathTests.ENTRY);

    Assert.isNull(value);
    Assert.isFalse(removed);
    Assert.areEqual(2, runner.calls.length);
  }

  @TestMethod
  public async removesNothingFromAPathWithoutTheEntry(): Promise<void> {
    const runner = new RegistryRunner(UserPathTests.answer("REG_SZ", "C:\\other"));

    const removed = await new UserPath(runner, tmpdir()).removeAsync(UserPathTests.ENTRY);

    Assert.isFalse(removed);
    Assert.areEqual(1, runner.calls.length);
  }

  @TestMethod
  public async writesThePathBackWithoutTheEntryInItsOwnType(): Promise<void> {
    const runner = new RegistryRunner(UserPathTests.answer("REG_SZ", `${UserPathTests.ENTRY};C:\\other`));

    const removed = await new UserPath(runner, tmpdir()).removeAsync(UserPathTests.ENTRY);

    Assert.isTrue(removed);
    Assert.areEqual("reg.exe add HKCU\\Environment /v Path /t REG_SZ /d C:\\other /f", runner.calls.at(-1));
  }

  @TestMethod
  public async deletesAPathThatHeldOnlyTheEntry(): Promise<void> {
    const runner = new RegistryRunner(UserPathTests.answer("REG_EXPAND_SZ", UserPathTests.ENTRY));

    const removed = await new UserPath(runner, tmpdir()).removeAsync(UserPathTests.ENTRY);

    Assert.isTrue(removed);
    Assert.areEqual("reg.exe delete HKCU\\Environment /v Path /f", runner.calls.at(-1));
  }

  @TestMethod
  public async refusesAnAnswerWithoutThePathOrFromAFailedQuery(): Promise<void> {
    const unnamed = new UserPath(new RegistryRunner(new ProcessResult(0, "HKEY_CURRENT_USER\\Environment\r\n", String.empty)), tmpdir());
    const failed = new UserPath(new RegistryRunner(new ProcessResult(5, "    Path    REG_SZ    C:\\other\r\n", "ERROR: Access is denied.")), tmpdir());

    const unnamedError = await Assert.throwsAsync(() => unnamed.readAsync(), BuildException);
    const failedError = await Assert.throwsAsync(() => failed.readAsync(), BuildException);

    Assert.areEqual("reg.exe query HKCU\\Environment /v Path did not answer with the user's Path; it exited with 0:\nHKEY_CURRENT_USER\\Environment", unnamedError.message);
    Assert.isTrue(failedError.message.startsWith("reg.exe query HKCU\\Environment /v Path did not answer with the user's Path; it exited with 5:\n"), failedError.message);
  }

  private static answer(type: string, value: string): ProcessResult {
    return new ProcessResult(0, `\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    ${type}    ${value}\r\n\r\n`, String.empty);
  }
}
