/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { BuildStepsFixture } from "../../fixtures/build-steps.fixture.js";

@TestClass
export class InstallTests {
  @TestMethod
  public async installsTheAppsWindowProjectAsync(): Promise<void> {
    const steps = new BuildStepsFixture();
    const output = new PassThrough();

    const exitCode = await steps.createInstall(tmpdir(), output).runAsync([]);

    Assert.areEqual(0, exitCode);
    Assert.areEqual("angular-install null", steps.steps.join());
    Assert.isNull(output.read(output.readableLength));
  }

  @TestMethod
  public async installsForTheBuildPartItIsGivenAsync(): Promise<void> {
    const steps = new BuildStepsFixture();

    const exitCodes = [await steps.createInstall(tmpdir(), new PassThrough()).runAsync(["--shard=1/2"]), await steps.createInstall(tmpdir(), new PassThrough()).runAsync(["--shard=2/2"])];

    Assert.areEqual("0,0", exitCodes.join());
    Assert.areEqual("angular-install 1,angular-install 2", steps.steps.join());
  }

  @TestMethod
  public async answersAnArgumentWithItsUsageAsync(): Promise<void> {
    const steps = new BuildStepsFixture();
    const output = new PassThrough();

    const exitCodes: number[] = [];
    const outputs: string[] = [];
    for (const installArguments of [["--quick"], ["--shard=3/2"], ["--shard=1/3"], ["--shard=1/2", "--shard=2/2"]]) {
      exitCodes.push(await steps.createInstall(tmpdir(), output).runAsync(installArguments));
      outputs.push(output.read(output.readableLength)?.toString() ?? String.empty);
    }

    Assert.areEqual("2,2,2,2", exitCodes.join());
    Assert.areEqual(Array(4).fill("Usage: noldova-desktop-build install [--shard=<1 or 2>/2]\n").join("|"), outputs.join("|"));
    Assert.areEqual(0, steps.steps.length);
  }

  @TestMethod
  public async reportsAFailureOfTheInstallOrOfAPackageAsync(): Promise<void> {
    for (const failure of [new BuildException("npm ci failed."), new BuildException("The root package.json is unreadable.")]) {
      const output = new PassThrough();

      const exitCode = await new BuildStepsFixture("angular-install", failure).createInstall(tmpdir(), output).runAsync([]);

      Assert.areEqual(1, exitCode);
      Assert.areEqual(`${failure.message}\n`, output.read(output.readableLength)?.toString() ?? String.empty);
    }
  }

  @TestMethod
  public async throwsAFailureThatIsNotTheInstallsOwnAsync(): Promise<void> {
    const failure = new Error("out of memory");

    const error = await Assert.throwsAsync(() => new BuildStepsFixture("angular-install", failure).createInstall(tmpdir(), new PassThrough()).runAsync([]), Error);

    Assert.areEqual(failure, error);
  }
}
