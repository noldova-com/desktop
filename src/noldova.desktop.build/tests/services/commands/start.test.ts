/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { Start } from "../../../src/services/commands/start.js";
import { DevelopmentBinary } from "../../../src/services/desktop/development-binary.js";
import { SandboxValidator } from "../../../src/services/desktop/sandbox.validator.js";
import { DevelopmentFolderFixture } from "../../fixtures/development-folder.fixture.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";

@TestClass
export class StartTests {
  private static readonly RESTRICTED: Readonly<Record<string, string>> = { "/proc/sys/kernel/apparmor_restrict_unprivileged_userns": "1\n" };

  @TestMethod
  public async startsTheDevelopmentAppOnItsPackageFolderWithTheArgumentsAndWithoutRunAsNodeAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeLinuxDistributionAsync();
    const runner = new ScriptedRunnerFixture(undefined, 3);
    const report = new PassThrough();

    const exitCode = await StartTests.create(folder, runner, {}).runAsync(["--inspect", "notes"], { ELECTRON_RUN_AS_NODE: "1", SAMPLE: "kept" }, report);

    const app = path.join(folder.path, "_build", "development-package");
    Assert.areEqual(3, exitCode);
    Assert.areEqual(`sample-app ${app} --inspect notes`, runner.ran.join("|"));
    Assert.areEqual(folder.path, runner.folders.at(-1));
    Assert.areEqual(JSON.stringify({ SAMPLE: "kept" }), JSON.stringify(runner.environments.at(-1)));
    Assert.areEqual("Preparing the Sample App development binary...\n", String(report.read(report.readableLength)));
  }

  @TestMethod
  public async failsWhenTheAppEndsWithoutAnExitCodeAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeLinuxDistributionAsync();

    const exitCode = await StartTests.create(folder, new ScriptedRunnerFixture(undefined, null), {}).runAsync([], {}, new PassThrough());

    Assert.areEqual(1, exitCode);
  }

  @TestMethod
  public async startsNothingAndSaysHowToSetUpTheSandboxWhenItCannotRunAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeLinuxDistributionAsync();
    const runner = new ScriptedRunnerFixture();
    const report = new PassThrough();
    const chunks: string[] = [];
    report.on("data", (t: Buffer) => chunks.push(t.toString()));

    const exitCode = await StartTests.create(folder, runner, StartTests.RESTRICTED).runAsync([], {}, report);

    Assert.areEqual(1, exitCode);
    Assert.areEqual(0, runner.ran.length);
    Assert.isTrue(chunks.join(String.empty).includes("sudo chmod 4755"), chunks.join(String.empty));
  }

  private static create(folder: DevelopmentFolderFixture, runner: ScriptedRunnerFixture, settings: Readonly<Record<string, string>>): Start {
    const sandbox = new SandboxValidator("linux", t => Promise.resolve(settings[t] ?? null), () => Promise.resolve({ uid: 1000, mode: 0o100755 }));
    return new Start(folder.path, runner, new DevelopmentBinary(folder.path, runner, "linux", "x64"), sandbox);
  }
}
