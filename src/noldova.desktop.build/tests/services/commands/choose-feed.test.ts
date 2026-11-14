/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ChooseFeed } from "../../../src/services/commands/choose-feed.js";

@TestClass
export class ChooseFeedTests {
  private static readonly INTERNAL_FEED_URL: string = "https://updates.example.test/app/";
  private static readonly ONLY_INTERNAL: string = "::error::Only the app's release repository, which signs Windows and macOS, builds for the internal update feed.\n";

  @TestMethod
  public async keepsAnEmptyFeedAndVersionForAnOrdinaryReleaseAsync(): Promise<void> {
    const result = await ChooseFeedTests.runAsync({ RELEASE_VERSION: "1.2.3", RUN_NUMBER: "40", RUN_ATTEMPT: "2", SIGNING: String.empty });

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual(String.empty, result.output);
    Assert.areEqual("update-feed=\npackage-version=\n", result.written);
  }

  @TestMethod
  public async keepsATestOfUpdatingsFeedAndVersionAsync(): Promise<void> {
    const result = await ChooseFeedTests.runAsync({ UPDATE_FEED: "http://127.0.0.1:47325/", PACKAGE_VERSION: "9.0.0", RUN_ATTEMPT: "3" });

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual(String.empty, result.output);
    Assert.areEqual("update-feed=http://127.0.0.1:47325/\npackage-version=9.0.0\n", result.written);
  }

  @TestMethod
  public async keepsAnEmptyFeedForACopyToTheInternalFeedWhateverItSignsAsync(): Promise<void> {
    const result = await ChooseFeedTests.runAsync({ INTERNAL_FEED: "copy", SIGNING: String.empty, RUN_ATTEMPT: "2" });

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual(String.empty, result.output);
    Assert.areEqual("update-feed=\npackage-version=\n", result.written);
  }

  @TestMethod
  public async buildsForTheInternalFeedWhenWindowsAndMacosAreSignedInEitherOrderAsync(): Promise<void> {
    for (const signing of ["windows macos", "macos windows", "linux macos windows"]) {
      const result = await ChooseFeedTests.runAsync(ChooseFeedTests.internalBuild(signing));

      Assert.areEqual(0, result.exitCode, signing);
      Assert.areEqual("The packages check the internal update feed as version 1.2.3-internal.40.\n", result.output, signing);
      Assert.areEqual(`update-feed=${ChooseFeedTests.INTERNAL_FEED_URL}\npackage-version=1.2.3-internal.40\n`, result.written, signing);
    }
  }

  @TestMethod
  public async refusesToBuildForTheInternalFeedUnlessBothWindowsAndMacosAreSignedAsync(): Promise<void> {
    for (const signing of [String.empty, "windows", "macos", "linux", "windowsmacos", "windows-arm64 macos-arm64"]) {
      const result = await ChooseFeedTests.runAsync(ChooseFeedTests.internalBuild(signing));

      Assert.areEqual(1, result.exitCode, signing);
      Assert.areEqual(ChooseFeedTests.ONLY_INTERNAL, result.output, signing);
      Assert.areEqual(String.empty, result.written, signing);
    }
  }

  @TestMethod
  public async refusesAnInternalFeedOtherThanEmptyBuildOrCopyAsync(): Promise<void> {
    const result = await ChooseFeedTests.runAsync({ INTERNAL_FEED: "Build" });

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual("::error::internal-feed must be empty, build or copy, not Build.\n", result.output);
  }

  @TestMethod
  public async refusesATestOfUpdatingsFeedOrVersionForTheInternalFeedAsync(): Promise<void> {
    const inputs: readonly Readonly<Record<string, string>>[] = [
      { ...ChooseFeedTests.internalBuild("windows macos"), UPDATE_FEED: "http://127.0.0.1:47325/" },
      { ...ChooseFeedTests.internalBuild("windows macos"), PACKAGE_VERSION: "9.0.0" },
      { INTERNAL_FEED: "copy", UPDATE_FEED: "http://127.0.0.1:47325/" }
    ];

    for (const environment of inputs) {
      const result = await ChooseFeedTests.runAsync(environment);

      Assert.areEqual(1, result.exitCode);
      Assert.areEqual("::error::A release for the internal update feed takes no update-feed or package-version of a test of updating.\n", result.output);
    }
  }

  @TestMethod
  public async refusesToBuildForTheInternalFeedWithoutItsUrlAsync(): Promise<void> {
    const result = await ChooseFeedTests.runAsync({ ...ChooseFeedTests.internalBuild("windows macos"), INTERNAL_FEED_URL: String.empty });

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual("::error::The variable INTERNAL_FEED_URL names no internal update feed.\n", result.output);
  }

  @TestMethod
  public async refusesARerunOfABuildForTheInternalFeedAsync(): Promise<void> {
    const result = await ChooseFeedTests.runAsync({ ...ChooseFeedTests.internalBuild("windows macos"), RUN_ATTEMPT: "2" });

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(
      "::error::A build for the internal update feed runs once, since a re-run would build other packages as the same 1.2.3-internal.40; start a new run.\n",
      result.output);
  }

  @TestMethod
  public async appendsTheFeedAndVersionAfterTheStepsEarlierOutputsAsync(): Promise<void> {
    const result = await ChooseFeedTests.runAsync(ChooseFeedTests.internalBuild("windows macos"), [], "signed=windows macos\n");

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual(`signed=windows macos\nupdate-feed=${ChooseFeedTests.INTERNAL_FEED_URL}\npackage-version=1.2.3-internal.40\n`, result.written);
  }

  @TestMethod
  public async refusesToChooseWithoutAStepOutputFileAsync(): Promise<void> {
    for (const environment of [ChooseFeedTests.internalBuild("windows macos"), { ...ChooseFeedTests.internalBuild("windows macos"), GITHUB_OUTPUT: String.empty }]) {
      const output = new PassThrough();

      const exitCode = await new ChooseFeed(environment, output, "noldova-desktop-release").runAsync([]);

      Assert.areEqual(1, exitCode);
      Assert.areEqual("::error::GITHUB_OUTPUT names no file for the step's update-feed and package-version outputs.\n", output.read()?.toString() ?? String.empty);
    }
  }

  @TestMethod
  public async answersAnArgumentWithItsUsageAsync(): Promise<void> {
    const result = await ChooseFeedTests.runAsync(ChooseFeedTests.internalBuild("windows macos"), ["build"]);

    Assert.areEqual(2, result.exitCode);
    Assert.areEqual(
      "Usage: INTERNAL_FEED=<empty, build or copy> INTERNAL_FEED_URL=<URL> UPDATE_FEED=<URL> PACKAGE_VERSION=<version> "
        + "RELEASE_VERSION=<N.N.N> RUN_NUMBER=<number> RUN_ATTEMPT=<number> SIGNING=<signed platforms> noldova-desktop-release choose-feed\n",
      result.output);
  }

  private static internalBuild(signing: string): Readonly<Record<string, string>> {
    return { INTERNAL_FEED: "build", INTERNAL_FEED_URL: ChooseFeedTests.INTERNAL_FEED_URL, RELEASE_VERSION: "1.2.3", RUN_NUMBER: "40", RUN_ATTEMPT: "1", SIGNING: signing };
  }

  private static async runAsync(environment: Readonly<Record<string, string>>, commandArguments: readonly string[] = [], earlier: string = String.empty): Promise<{ readonly exitCode: number; readonly output: string; readonly written: string }> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-choose-feed-"));
    try {
      const file = path.join(folder, "output");
      await writeFile(file, earlier);
      const output = new PassThrough();
      const exitCode = await new ChooseFeed({ ...environment, GITHUB_OUTPUT: file }, output, "noldova-desktop-release").runAsync(commandArguments);
      return { exitCode, output: output.read()?.toString() ?? String.empty, written: await readFile(file, "utf8") };
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}
