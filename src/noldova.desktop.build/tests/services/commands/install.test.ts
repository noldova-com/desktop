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
    Assert.areEqual("angular-install", steps.steps.join());
    Assert.isNull(output.read(output.readableLength));
  }

  @TestMethod
  public async answersAnArgumentWithItsUsageAsync(): Promise<void> {
    const steps = new BuildStepsFixture();
    const output = new PassThrough();

    const exitCode = await steps.createInstall(tmpdir(), output).runAsync(["--quick"]);

    Assert.areEqual(2, exitCode);
    Assert.areEqual("Usage: noldova-desktop-build install\n", output.read(output.readableLength)?.toString() ?? String.empty);
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
