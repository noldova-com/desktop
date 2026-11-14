/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { NodeGyp } from "../../../src/services/toolchain/node-gyp.js";
import { RecordingRunnerFixture } from "../../fixtures/recording-runner.fixture.js";

@TestClass
export class NodeGypTests {
  @TestMethod
  public async runsTheNodeGypThatNpmBundlesWithNodeInTheFolder(): Promise<void> {
    const runner = new RecordingRunnerFixture();
    const npm = path.join("tools", "npm", "bin", "npm-cli.js");

    await new NodeGyp(runner, { npm_execpath: npm }).runAsync(["rebuild"], "/addon");

    Assert.areEqual([process.execPath, path.join(path.dirname(npm), ...Resources.nodeGypScriptSegments), "rebuild", "/addon", String(Resources.nodeGypTimeout)].join("|"),
      runner.calls.map(t => t.join("|")).join());
  }

  @TestMethod
  public async refusesToRunWithoutNpmsPath(): Promise<void> {
    for (const environment of [{}, { npm_execpath: "" }]) {
      const error = await Assert.throwsAsync(() => new NodeGyp(new RecordingRunnerFixture(), environment).runAsync(["rebuild"], "/addon"), BuildException);

      Assert.areEqual(Resources.npmUnavailable, error.message);
    }
  }
}
