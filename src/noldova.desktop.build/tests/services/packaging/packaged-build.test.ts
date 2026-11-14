/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { AngularProject } from "../../../src/services/angular/angular-project.js";
import { GalleryFile } from "../../../src/services/angular/gallery-file.js";
import { PackagedBuild } from "../../../src/services/packaging/packaged-build.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { NpmCommand } from "../../../src/services/toolchain/npm-command.js";

class BuildRunner extends ProcessRunner {
  private readonly exitCode: number | null;

  public readonly calls: string[] = [];

  public constructor(exitCode: number | null) {
    super();
    this.exitCode = exitCode;
  }

  public override runAsync(...call: Parameters<ProcessRunner["runAsync"]>): Promise<number | null> {
    const [command, commandArguments, directory] = call;
    this.calls.push([command === process.execPath ? "node" : command, path.basename(commandArguments[0] ?? String.empty), ...commandArguments.slice(1), directory].join(" "));
    return Promise.resolve(this.exitCode);
  }
}

class FakeGallery extends GalleryFile {
  private readonly isPackaged: boolean;

  public readonly writes: boolean[] = [];

  public constructor(isPackaged: boolean) {
    super(path.resolve("sample-app"));
    this.isPackaged = isPackaged;
  }

  public override writeAsync(isPackaged: boolean): Promise<void> {
    this.writes.push(isPackaged);
    return Promise.resolve();
  }

  public override isPackagedAsync(): Promise<boolean> {
    return Promise.resolve(this.isPackaged);
  }
}

class FakeAngular extends AngularProject {
  public readonly verified: string[] = [];

  public constructor(runner: ProcessRunner) {
    super(path.resolve("sample-app"), runner, new NpmCommand(runner, {}));
  }

  public override verifyWithoutAsync(outputPath: string | null, texts: readonly string[]): Promise<void> {
    this.verified.push(`${String(outputPath)} ${texts.length}`);
    return Promise.resolve();
  }
}

@TestClass
export class PackagedBuildTests {
  private static readonly ROOT: string = path.resolve("sample-app");
  private static readonly FOLDER: string = path.join(PackagedBuildTests.ROOT, "_build", "package", "app", "_build");

  @TestMethod
  public async buildsThePackagedAppWithTheUpdateFeedAndChecksTheWindowLeavesOutTheGallery(): Promise<void> {
    const runner = new BuildRunner(0);
    const gallery = new FakeGallery(true);
    const angular = new FakeAngular(runner);

    await new PackagedBuild(PackagedBuildTests.ROOT, runner, gallery, angular).buildAsync(PackagedBuildTests.FOLDER, "https://updates.example.com/");

    Assert.areEqual(`node build-command-line.js build --packaged --output ${PackagedBuildTests.FOLDER} --update-feed https://updates.example.com/ ${PackagedBuildTests.ROOT}`,
      runner.calls.join("|").replace("build-command-line.ts", "build-command-line.js"));
    Assert.areEqual("false", gallery.writes.join(","));
    Assert.areEqual(`${path.join(PackagedBuildTests.FOLDER, "window")} 4`, angular.verified.join("|"));
  }

  @TestMethod
  public async buildsWithoutAnUpdateFeedWhenGivenNone(): Promise<void> {
    const runner = new BuildRunner(0);

    await new PackagedBuild(PackagedBuildTests.ROOT, runner, new FakeGallery(true), new FakeAngular(runner)).buildAsync(PackagedBuildTests.FOLDER, null);

    Assert.isTrue(runner.calls.join("|").endsWith(`--output ${PackagedBuildTests.FOLDER} ${PackagedBuildTests.ROOT}`), runner.calls.join("|"));
  }

  @TestMethod
  public async refusesAFailedBuildAndStillRestoresTheGallery(): Promise<void> {
    const runner = new BuildRunner(3);
    const gallery = new FakeGallery(true);
    const angular = new FakeAngular(runner);

    const error = await Assert.throwsAsync(() => new PackagedBuild(PackagedBuildTests.ROOT, runner, gallery, angular).buildAsync(PackagedBuildTests.FOLDER, null),
      BuildException);

    Assert.areEqual("The packaged build failed with exit code 3.", error.message);
    Assert.areEqual("false", gallery.writes.join(","));
    Assert.areEqual(0, angular.verified.length);
  }

  @TestMethod
  public async refusesABuildThatLeftTheGalleryIn(): Promise<void> {
    const runner = new BuildRunner(0);
    const gallery = new FakeGallery(false);

    const error = await Assert.throwsAsync(() => new PackagedBuild(PackagedBuildTests.ROOT, runner, gallery, new FakeAngular(runner)).buildAsync(PackagedBuildTests.FOLDER, null),
      BuildException);

    Assert.areEqual("The packaged build's Gallery file still brings in the Gallery.", error.message);
    Assert.areEqual("false", gallery.writes.join(","));
  }
}
