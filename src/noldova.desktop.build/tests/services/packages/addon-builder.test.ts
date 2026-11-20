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
import { Writable } from "node:stream";

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

      await new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, runner), "linux", "x64", String.empty, "x64", path.join(root, "node")).buildAsync(AddonBuilderTests.MANIFEST, output);

      const work = layout.locateAddonWork(AddonBuilderTests.MANIFEST, "pty-unix");
      Assert.areEqual("built", await readFile(path.join(output, "native", "linux-x64", "pty-unix.node"), "utf8"));
      Assert.areEqual("unix source", await readFile(path.join(work, "pty-unix.c"), "utf8"));
      Assert.areEqual(Resources.formatJsonFile({ targets: [{ target_name: "pty_unix", sources: ["pty-unix.c"], defines: ["NAPI_VERSION=8"] }] }), await readFile(path.join(work, "binding.gyp"), "utf8"));
      const script = path.join(root, "npm", "..", "node_modules", "node-gyp", "bin", "node-gyp.js");
      Assert.areEqual(
        [
          [process.execPath, script, "install", "--loglevel=error", "--devdir", layout.nodeGypFolder, layout.nodeGypFolder, "600000"].join("\n"),
          [process.execPath, script, ...Resources.addonRebuildArguments, "--devdir", layout.nodeGypFolder, work, "600000"].join("\n")
        ].join("\n\n"),
        runner.calls.map(t => t.join("\n")).join("\n\n"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async buildsThePosixAddonsAgainstTheRunningNodesOwnHeadersWhenItHasThemAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const node = path.join(root, "node");
      await AddonBuilderTests.writeAsync(path.join(node, "include", "node", "common.gypi"), "{}");
      const runner = AddonBuilderTests.createBuildingRunner(new ProcessResult(0, "done", String.empty));

      await new AddonBuilder(new BuildLayout(root), AddonBuilderTests.createNodeGyp(root, runner), "darwin", "x64", String.empty, "x64", node).buildAsync(AddonBuilderTests.MANIFEST, path.join(root, "out"));

      Assert.areEqual(["--nodedir", node].join(" "), runner.calls.map(t => t.slice(-4, -2).join(" ")).join("\n"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async downloadsTheHeadersForTheWindowsAddonsEvenWhenTheRunningNodeHasItsOwnAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const node = path.join(root, "node");
      await AddonBuilderTests.writeAsync(path.join(node, "include", "node", "common.gypi"), "{}");
      const layout = new BuildLayout(root);
      const runner = AddonBuilderTests.createBuildingRunner(new ProcessResult(0, "done", String.empty));

      await new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, runner), "win32", "x64", String.empty, "x64", node).buildAsync(AddonBuilderTests.MANIFEST, path.join(root, "out"));

      Assert.areEqual(["install --devdir", "rebuild --devdir"].map(t => `${t} ${layout.nodeGypFolder}`).join("\n"), runner.calls.map(t => [t[2], ...t.slice(-4, -2)].join(" ")).join("\n"));
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

      await new AddonBuilder(new BuildLayout(root), AddonBuilderTests.createNodeGyp(root, runner), "win32", "arm64", String.empty, "arm64").buildAsync(AddonBuilderTests.MANIFEST, output);

      Assert.isTrue(existsSync(path.join(output, "native", "win32-arm64", "pty-win.node")));
      Assert.isFalse(existsSync(path.join(output, "native", "win32-arm64", "pty-unix.node")));
      Assert.areEqual("install rebuild", runner.calls.map(t => t[2]).join(" "));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async namesTheMissingWindowsToolchainForTheArchitectureAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const missing = [new ProcessResult(0, "installed", String.empty), new ProcessResult(1, `gyp ERR! ${Resources.addonNoToolchainText}`, String.empty)];
      const layout = new BuildLayout(root);
      const output = path.join(root, "out");

      const x64 = await Assert.throwsAsync(() => new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, new RecordingRunnerFixture(missing)), "win32", "x64", String.empty, "x64").buildAsync(AddonBuilderTests.MANIFEST, output), BuildException);
      const arm64 = await Assert.throwsAsync(() => new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, new RecordingRunnerFixture(missing)), "win32", "arm64", String.empty, "arm64").buildAsync(AddonBuilderTests.MANIFEST, output), BuildException);

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
      const failed = [new ProcessResult(0, "installed", String.empty), new ProcessResult(2, "out", "err")];
      const layout = new BuildLayout(root);
      const output = path.join(root, "out");

      const posix = await Assert.throwsAsync(() => new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, new RecordingRunnerFixture(failed)), "darwin", "arm64", String.empty, "arm64", path.join(root, "node")).buildAsync(AddonBuilderTests.MANIFEST, output), BuildException);
      const windows = await Assert.throwsAsync(() => new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, new RecordingRunnerFixture(failed)), "win32", "x64", String.empty, "x64").buildAsync(AddonBuilderTests.MANIFEST, output), BuildException);

      Assert.areEqual(Resources.formatAddonBuildFailed(AddonBuilderTests.NAME, "POSIX", "pty-unix", 2, "outerr"), posix.message);
      Assert.areEqual(Resources.formatAddonBuildFailed(AddonBuilderTests.NAME, "Windows", "pty-win", 2, "outerr"), windows.message);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async triesTheHeadersDownloadAgainAndSaysSoWhenATryFailsAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const layout = new BuildLayout(root);
      const stalled = new ProcessResult(6, "gyp ERR! Completion callback never invoked!", String.empty);
      const runner = AddonBuilderTests.createBuildingRunner([stalled, new ProcessResult(0, "installed", String.empty), new ProcessResult(0, "done", String.empty)]);
      const written: string[] = [];
      const output = path.join(root, "out");

      await new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, runner), "win32", "x64", String.empty, "x64", path.join(root, "node"), AddonBuilderTests.createLog(written))
        .buildAsync(AddonBuilderTests.MANIFEST, output);

      Assert.areEqual("install install rebuild", runner.calls.map(t => t[2]).join(" "));
      Assert.areEqual(Resources.formatAddonHeadersRetried(layout.nodeGypFolder, 1, 6, "gyp ERR! Completion callback never invoked!"), written.join(String.empty));
      Assert.areEqual("built", await readFile(path.join(output, "native", "win32-x64", "pty-win.node"), "utf8"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async namesTheHeadersDownloadWhenItsLastTryFailsAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const layout = new BuildLayout(root);
      const runner = new RecordingRunnerFixture(new ProcessResult(6, "gyp ERR! Completion callback never invoked!", String.empty));
      const written: string[] = [];

      const error = await Assert.throwsAsync(() => new AddonBuilder(layout, AddonBuilderTests.createNodeGyp(root, runner), "linux", "x64", String.empty, "x64", path.join(root, "node"),
        AddonBuilderTests.createLog(written)).buildAsync(AddonBuilderTests.MANIFEST, path.join(root, "out")), BuildException);

      Assert.areEqual(Resources.formatAddonHeadersFailed(layout.nodeGypFolder, 3, 6, "gyp ERR! Completion callback never invoked!"), error.message);
      Assert.areEqual("install install install", runner.calls.map(t => t[2]).join(" "));
      Assert.areEqual(2, written.length);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async refusesToBuildForAProcessorOtherThanTheMachinesAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const runner = new RecordingRunnerFixture();
      const output = path.join(root, "out");

      const error = await Assert.throwsAsync(() => new AddonBuilder(new BuildLayout(root), AddonBuilderTests.createNodeGyp(root, runner), "win32", "arm64", String.empty, "x64")
        .buildAsync(AddonBuilderTests.MANIFEST, output), BuildException);

      Assert.areEqual(Resources.formatAddonArchitectureRefused(AddonBuilderTests.NAME, "arm64", "x64"), error.message);
      Assert.areEqual(0, runner.calls.length);
      Assert.isFalse(existsSync(output));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async buildsNothingForAProcessorOtherThanTheMachinesWhenThePlatformHasNoAddonsAsync(): Promise<void> {
    const root = await AddonBuilderTests.createRootAsync();
    try {
      const runner = new RecordingRunnerFixture();
      const output = path.join(root, "out");
      const posixOnly = new PackageManifest(AddonBuilderTests.DIRECTORY, AddonBuilderTests.NAME, [], undefined, [], [], ["pty-unix"]);

      await new AddonBuilder(new BuildLayout(root), AddonBuilderTests.createNodeGyp(root, runner), "win32", "arm64", String.empty, "x64").buildAsync(posixOnly, output);

      Assert.areEqual(0, runner.calls.length);
      Assert.isFalse(existsSync(output));
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

  private static createBuildingRunner(result: ProcessResult | readonly ProcessResult[]): RecordingRunnerFixture {
    return new RecordingRunnerFixture(result, async directory => {
      const addon = path.basename(directory).replaceAll("-", "_");
      await AddonBuilderTests.writeAsync(path.join(directory, "build", "Release", `${addon}.node`), "built");
    });
  }

  private static createLog(written: string[]): Writable {
    return new Writable({
      write: (chunk: Buffer, _: BufferEncoding, done: () => void): void => {
        written.push(String(chunk));
        done();
      }
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
