/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { PassThrough } from "node:stream";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";
import { ProductInfo } from "@noldova/desktop.runtime";

import { DesktopToolsCommand } from "../../../src/services/commands/desktop-tools-command.js";
import { DevelopmentBinary } from "../../../src/services/desktop/development-binary.js";
import { DevelopmentAppFixture } from "../../fixtures/development-app.fixture.js";
import { DevelopmentFolderFixture } from "../../fixtures/development-folder.fixture.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";

@TestClass
export class DesktopToolsCommandTests {
  @TestMethod
  public async runsTheCommandLineWithTheCheckoutInTheVariableOfTheAppsOwnProduct(): Promise<void> {
    await using app = await DevelopmentAppFixture.createAsync("Team Run", "team-run");

    const result = await DesktopToolsCommandTests.runAsync(app);

    Assert.areEqual(`0 ${JSON.stringify([[["TEAM_RUN_CHECKOUT", app.path]], ["quit"]])} Preparing the Team Run development binary...\n`, result);
  }

  @TestMethod
  public async namesTheCheckoutVariableAsTheCommandLineReadsIt(): Promise<void> {
    await using app = await DevelopmentAppFixture.createAsync(null, null);

    const result = await DesktopToolsCommandTests.runAsync(app);

    Assert.areEqual(`0 ${JSON.stringify([[[ProductInfo.current.checkoutVariable, app.path]], ["quit"]])} Preparing the ${app.name} development binary...\n`, result);
  }

  @TestMethod
  public async runsInTheFolderNpmStartedInAsNodeAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeLinuxDistributionAsync();
    const runner = new ScriptedRunnerFixture(undefined, 4);
    const command = new DesktopToolsCommand(folder.path, runner, new DevelopmentBinary(folder.path, runner, "linux", "x64"));

    const exitCode = await command.runAsync(["status"], { INIT_CWD: "/work" }, new PassThrough());

    const entry = path.join(folder.path, "node_modules", "@noldova", "desktop.cli", "services", "cli-entry.js");
    Assert.areEqual(4, exitCode);
    Assert.areEqual(`sample-app ${entry} status`, runner.ran.join("|"));
    Assert.areEqual("/work", runner.folders.at(-1));
    Assert.areEqual(JSON.stringify({ INIT_CWD: "/work", ELECTRON_RUN_AS_NODE: "1", SAMPLE_APP_CHECKOUT: folder.path }), JSON.stringify(runner.environments.at(-1)));
  }

  @TestMethod
  public async failsWhenTheCommandLineEndsWithoutAnExitCodeAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeLinuxDistributionAsync();
    const runner = new ScriptedRunnerFixture(undefined, null);

    const exitCode = await new DesktopToolsCommand(folder.path, runner, new DevelopmentBinary(folder.path, runner, "linux", "x64")).runAsync([], {}, new PassThrough());

    Assert.areEqual(1, exitCode);
    Assert.areEqual(folder.path, runner.folders.at(-1));
  }

  private static async runAsync(app: DevelopmentAppFixture): Promise<string> {
    const errors = new PassThrough();
    const exitCode = await new BuildCommandLine(app.path, {}, app.platform, process.arch, new PassThrough(), errors).runAsync(["desktop-tools", "quit"]);
    return `${exitCode} ${await app.readLaunchAsync()} ${String(errors.read(errors.readableLength))}`;
  }
}
