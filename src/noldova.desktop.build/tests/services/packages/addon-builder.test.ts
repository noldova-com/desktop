/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageManifest } from "../../../src/models/packages/package-manifest.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { Resources } from "../../../src/resources.js";
import { AddonBuilder } from "../../../src/services/packages/addon-builder.js";
import { BuildLayout } from "../../../src/services/packages/build-layout.js";
import { NodeGyp } from "../../../src/services/toolchain/node-gyp.js";
import { RecordingRunnerFixture } from "../../fixtures/recording-runner.fixture.js";

@TestClass
export class AddonBuilderTests {
  private static readonly NAME: string = "@noldova/desktop.protocol";
  private static readonly DIRECTORY: string = "src/noldova.desktop.protocol";
  private static readonly MANIFEST: PackageManifest = new PackageManifest(AddonBuilderTests.DIRECTORY, AddonBuilderTests.NAME, [], undefined, [], ["pty-win"], ["pty-unix"]);

  @TestMethod
  public listsTheReleaseBuildsOfEveryTarget(): void {
    Assert.areEqual(
      "win32-x64/pty-win.node win32-arm64/pty-win.node linux-x64/pty-unix.node linux-arm64/pty-unix.node darwin-x64/pty-unix.node darwin-arm64/pty-unix.node",
      AddonBuilder.listReleaseBuilds(AddonBuilderTests.MANIFEST).join(" "));
  }

  @TestMethod
  public async buildsThePosixAddonsWithNodeGypAndCopiesThemOutAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const layout = new BuildLayout(root);
      const runner = AddonBuilderTests.createBuildingRunner(new ProcessResult(0, "done", String.empty));
      const output = path.join(root, "out");

      await new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, runner), "linux", "x64").buildAsync(AddonBuilderTests.MANIFEST, output);

      const work = layout.locateAddonWork(AddonBuilderTests.MANIFEST, "pty-unix");
      Assert.areEqual("built", await readFile(path.join(output, "native", "linux-x64", "pty-unix.node"), "utf8"));
      Assert.areEqual("unix source", await readFile(path.join(work, "pty-unix.c"), "utf8"));
      Assert.areEqual(Resources.formatJsonFile({ targets: [{ target_name: "pty_unix", sources: ["pty-unix.c"], defines: ["NAPI_VERSION=8"] }] }), await readFile(path.join(work, "binding.gyp"), "utf8"));
      Assert.areEqual(
        [process.execPath, path.join(root, "npm", "..", "node_modules", "node-gyp", "bin", "node-gyp.js"), ...Resources.addonRebuildArguments, layout.nodeGypFolder, work, "600000"].join("\n"),
        runner.calls.map(t => t.join("\n")).join("\n\n"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async buildsTheWindowsAddonsOnWindowsAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const runner = AddonBuilderTests.createBuildingRunner(new ProcessResult(0, "done", String.empty));
      const output = path.join(root, "out");

      await new AddonBuilder(new BuildLayout(root), AddonBuilderTests.createNodeGyp(root, runner), "win32", "arm64").buildAsync(AddonBuilderTests.MANIFEST, output);

      Assert.isTrue(existsSync(path.join(output, "native", "win32-arm64", "pty-win.node")));
      Assert.isFalse(existsSync(path.join(output, "native", "win32-arm64", "pty-unix.node")));
      Assert.areEqual(1, runner.calls.length);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async namesTheMissingWindowsToolchainForTheArchitectureAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const missing = new ProcessResult(1, `gyp ERR! ${Resources.addonNoToolchainText}`, String.empty);
      const layout = new BuildLayout(root);
      const output = path.join(root, "out");

      const x64 = await Assert.throwsAsync(() => new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, new RecordingRunnerFixture(missing)), "win32", "x64").buildAsync(AddonBuilderTests.MANIFEST, output), BuildException);
      const arm64 = await Assert.throwsAsync(() => new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, new RecordingRunnerFixture(missing)), "win32", "arm64").buildAsync(AddonBuilderTests.MANIFEST, output), BuildException);

      Assert.areEqual(Resources.formatAddonToolchainMissing(AddonBuilderTests.NAME, "pty-win", Resources.addonToolchainWorkload), x64.message);
      Assert.areEqual(Resources.formatAddonToolchainMissing(AddonBuilderTests.NAME, "pty-win", Resources.addonToolchainWorkloadArm64), arm64.message);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async passesOnTheOutputOfAFailedBuildAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const failed = new ProcessResult(2, "out", "err");
      const layout = new BuildLayout(root);
      const output = path.join(root, "out");

      const posix = await Assert.throwsAsync(() => new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, new RecordingRunnerFixture(failed)), "darwin", "arm64").buildAsync(AddonBuilderTests.MANIFEST, output), BuildException);
      const windows = await Assert.throwsAsync(() => new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, new RecordingRunnerFixture(failed)), "win32", "x64").buildAsync(AddonBuilderTests.MANIFEST, output), BuildException);

      Assert.areEqual(Resources.formatAddonBuildFailed(AddonBuilderTests.NAME, "POSIX", "pty-unix", 2, "outerr"), posix.message);
      Assert.areEqual(Resources.formatAddonBuildFailed(AddonBuilderTests.NAME, "Windows", "pty-win", 2, "outerr"), windows.message);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async copiesTheReleaseBuildsInsteadOfBuildingAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const releases = path.join(root, "releases");
      for (const build of AddonBuilder.listReleaseBuilds(AddonBuilderTests.MANIFEST))
        await AddonBuilderTests.writeAsync(path.join(releases, "src", "noldova.desktop.protocol", ...build.split("/")), build);
      const runner = new RecordingRunnerFixture();
      const output = path.join(root, "out");

      await new AddonBuilder(new BuildLayout(root), AddonBuilderTests.createNodeGyp(root, runner), "linux", "x64", releases).buildAsync(AddonBuilderTests.MANIFEST, output);

      Assert.areEqual("darwin-arm64/pty-unix.node", await readFile(path.join(output, "native", "darwin-arm64", "pty-unix.node"), "utf8"));
      Assert.areEqual("win32-x64/pty-win.node", await readFile(path.join(output, "native", "win32-x64", "pty-win.node"), "utf8"));
      Assert.areEqual(0, runner.calls.length);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async namesEachReleaseBuildThatIsMissingAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const releases = path.join(root, "releases");
      for (const build of AddonBuilder.listReleaseBuilds(AddonBuilderTests.MANIFEST).slice(0, -2))
        await AddonBuilderTests.writeAsync(path.join(releases, "src", "noldova.desktop.protocol", ...build.split("/")), build);

      const error = await Assert.throwsAsync(() => new AddonBuilder(new BuildLayout(root), AddonBuilderTests.createNodeGyp(root, new RecordingRunnerFixture()), "linux", "x64", releases)
        .buildAsync(AddonBuilderTests.MANIFEST, path.join(root, "out")), BuildException);

      Assert.areEqual(Resources.formatLines([
        Resources.formatReleaseAddonMissing("darwin-x64", AddonBuilderTests.NAME, "pty-unix", AddonBuilderTests.DIRECTORY, "darwin-x64/pty-unix.node"),
        Resources.formatReleaseAddonMissing("darwin-arm64", AddonBuilderTests.NAME, "pty-unix", AddonBuilderTests.DIRECTORY, "darwin-arm64/pty-unix.node")
      ]), error.message);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  private static createBuildingRunner(result: ProcessResult): RecordingRunnerFixture {
    return new RecordingRunnerFixture(result, async directory => {
      const addon = path.basename(directory).replaceAll("-", "_");
      await AddonBuilderTests.writeAsync(path.join(directory, "build", "Release", `${addon}.node`), "built");
    });
  }

  private static createNodeGyp(root: string, runner: RecordingRunnerFixture): NodeGyp {
    return new NodeGyp(runner, { npm_execpath: path.join(root, "npm", "npm-cli.js") });
  }

  private static async createRootAsync(): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "addon-builder-"));
    await AddonBuilderTests.writeAsync(path.join(root, "src", "noldova.desktop.protocol", "src", "native", "pty-unix.c"), "unix source");
    await AddonBuilderTests.writeAsync(path.join(root, "src", "noldova.desktop.protocol", "src", "native", "pty-win.c"), "windows source");
    return root;
  }

  private static async writeAsync(file: string, text: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
}
