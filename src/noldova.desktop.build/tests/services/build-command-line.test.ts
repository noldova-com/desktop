/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";

import { ProgramRunFixture } from "../fixtures/program-run.fixture.js";

@TestClass
export class BuildCommandLineTests {
  private static readonly USAGE: string = "Usage: noldova-desktop-build <command> [<argument>...], where the command is one of install, build, start, desktop-tools, package, "
    + "package-smoke, list-targets, release-check, release-assets, release-publish.\n";

  @TestMethod
  public async printsTheUsageWithoutACommandAsync(): Promise<void> {
    const errors = new PassThrough();

    const exitCode = await BuildCommandLineTests.create(errors).runAsync([]);

    Assert.areEqual(`2 ${BuildCommandLineTests.USAGE}`, `${exitCode} ${String(errors.read(errors.readableLength))}`);
  }

  @TestMethod
  public async printsTheUsageForAnUnknownCommandAsync(): Promise<void> {
    const errors = new PassThrough();

    const exitCode = await BuildCommandLineTests.create(errors).runAsync(["frobnicate", "--test"]);

    Assert.areEqual(`2 ${BuildCommandLineTests.USAGE}`, `${exitCode} ${String(errors.read(errors.readableLength))}`);
  }

  @TestMethod
  public async namesItsOwnBinInEachReleaseCommandsUsageAsync(): Promise<void> {
    const results: string[] = [];

    for (const command of ["list-targets", "release-check", "release-publish"]) {
      const output = new PassThrough();
      const exitCode = await BuildCommandLineTests.create(new PassThrough(), output).runAsync([command, "extra", "more"]);
      const usage = String(output.read(output.readableLength));
      results.push(`${exitCode} ${usage.slice(usage.indexOf("noldova-desktop-build"))}`);
    }

    Assert.areEqual("2 noldova-desktop-build list-targets [<app folder>]\n2 noldova-desktop-build release-check\n2 noldova-desktop-build release-publish\n", results.join(String.empty));
  }

  @TestMethod
  public async handsEachAppCommandItsArgumentsAsync(): Promise<void> {
    await using folder = await BuildCommandLineTests.createFolderAsync();
    const results: string[] = [];

    for (const commandArguments of [["install", "--quick"], ["build", "--output"], ["package", "--quick"], ["package-smoke", "--quick"], ["release-assets", "--quick"]]) {
      const output = new PassThrough();
      const exitCode = await new BuildCommandLine(folder.path, {}, "linux", "x64", output, new PassThrough()).runAsync(commandArguments);
      const usage = String(output.read(output.readableLength));
      results.push(`${exitCode} ${usage.slice(0, usage.indexOf(" ", "Usage: noldova-desktop-build ".length))}`);
    }

    Assert.areEqual(JSON.stringify(["install", "build", "package", "package-smoke", "release-assets"].map(t => `2 Usage: noldova-desktop-build ${t}`)), JSON.stringify(results));
  }

  @TestMethod
  public async preparesTheDevelopmentBinaryOfTheFolderToStartOrRunItsToolsAsync(): Promise<void> {
    await using folder = await BuildCommandLineTests.createFolderAsync();

    for (const command of ["start", "desktop-tools"]) {
      const error = await Assert.throwsAsync(() => new BuildCommandLine(folder.path, {}, "linux", "x64", new PassThrough(), new PassThrough()).runAsync([command]), Error);

      Assert.isTrue(error.message.startsWith("The root package.json must declare a version of the form major.minor.patch"), error.message);
    }
  }

  @TestMethod
  public async runsAsAProgramWithTheProcessArgumentsAsync(): Promise<void> {
    await using folder = await BuildCommandLineTests.createFolderAsync();

    const run = await ProgramRunFixture.runAsync(import.meta.resolve("../../src/services/build-command-line.js"), ["frobnicate"], folder.path);

    Assert.areEqual(2, run.exitCode);
    Assert.areEqual(BuildCommandLineTests.USAGE, run.output);
  }

  private static create(errors: PassThrough, output: PassThrough = new PassThrough()): BuildCommandLine {
    return new BuildCommandLine(process.cwd(), {}, process.platform, process.arch, output, errors);
  }

  private static async createFolderAsync(): Promise<{ readonly path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-build-command-line-"));
    return {
      path: folder,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    };
  }
}
