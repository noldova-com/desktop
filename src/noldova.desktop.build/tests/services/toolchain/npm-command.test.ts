/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { NpmCommand } from "../../../src/services/toolchain/npm-command.js";
import { RecordingRunnerFixture } from "../../fixtures/recording-runner.fixture.js";

@TestClass
export class NpmCommandTests {
  @TestMethod
  public async runsNpmFromItsPathWithNodeInTheFolder(): Promise<void> {
    const runner = new RecordingRunnerFixture();

    const result = await new NpmCommand(runner, { npm_execpath: "/tools/npm-cli.js" }).runAsync(["ci", "--ignore-scripts"], "/app");

    Assert.areEqual("done", result.output);
    Assert.areEqual([process.execPath, "/tools/npm-cli.js", "ci", "--ignore-scripts", "/app", String(Resources.npmCommandTimeout)].join("|"), runner.calls.map(t => t.join("|")).join());
  }

  @TestMethod
  public async refusesToRunWithoutNpmsPath(): Promise<void> {
    for (const environment of [{}, { npm_execpath: "" }]) {
      const error = await Assert.throwsAsync(() => new NpmCommand(new RecordingRunnerFixture(), environment).runAsync(["ci"], "/app"), BuildException);

      Assert.areEqual(Resources.npmUnavailable, error.message);
    }
  }
}
