/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { Git } from "../../../src/services/repository/git.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";

@TestClass
export class GitTests {
  @TestMethod
  public async readsTheOutputOfASuccessfulCommandInItsFolderAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture(() => new ProcessResult(0, "abc\n", String.empty));

    const output = await new Git("/work", runner).readOutputAsync(["rev-parse", "HEAD"]);

    Assert.areEqual("abc\n", output);
    Assert.areEqual("git rev-parse HEAD", runner.captured.join("|"));
    Assert.areEqual("/work", runner.folders.join());
  }

  @TestMethod
  public async takesTheExitCodesTheCallerAllowsAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture(() => new ProcessResult(1, "changed\n", String.empty));

    const output = await new Git("/work", runner).readOutputAsync(["diff", "--quiet"], [0, 1]);

    Assert.areEqual("changed\n", output);
  }

  @TestMethod
  public async throwsAFailureWithItsArgumentsExitCodeAndErrorOutputAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture(() => new ProcessResult(128, String.empty, "fatal: not a git repository\n"));

    const error = await Assert.throwsAsync(() => new Git("/work", runner).readOutputAsync(["status"]), BuildException);

    Assert.areEqual("\"git status\" failed with exit code 128: fatal: not a git repository", error.message);
  }
}
