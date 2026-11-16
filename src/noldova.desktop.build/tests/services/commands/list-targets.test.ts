/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ListTargets } from "../../../src/services/commands/list-targets.js";

@TestClass
export class ListTargetsTests {
  private static readonly LINUX: string = JSON.stringify({ group: "Example", labels: ["example", "Linux", "X64"] });
  private static readonly WINDOWS: string = JSON.stringify({ group: "Example", labels: ["example", "Windows", "X64"] });
  private static readonly MACOS: string = JSON.stringify({ group: "Example", labels: ["example", "macOS", "X64"] });
  private static readonly LINUX_ARM64: string = JSON.stringify({ group: "Example", labels: ["example", "Linux", "ARM64"] });
  private static readonly WINDOWS_ARM64: string = JSON.stringify({ group: "Example", labels: ["example", "Windows", "ARM64"] });
  private static readonly MACOS_ARM64: string = JSON.stringify({ group: "Example", labels: ["example", "macOS", "ARM64"] });

  @TestMethod
  public async listsAnArm64TargetOnlyWhenItsOwnRunnerVariableIsSetAsync(): Promise<void> {
    const result = await ListTargetsTests.runAsync({ ...ListTargetsTests.ownX64(), RUNS_ON_MACOS_ARM64: ListTargetsTests.MACOS_ARM64 });

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual(
      [
        `Linux x64|${JSON.stringify(ListTargetsTests.LINUX)}|x64|linux|nightly`,
        `Windows x64|${JSON.stringify(ListTargetsTests.WINDOWS)}|x64|windows|nightly`,
        `macOS x64|${JSON.stringify(ListTargetsTests.MACOS)}|x64|macos|manual`,
        `macOS ARM64|${JSON.stringify(ListTargetsTests.MACOS_ARM64)}|arm64|macos|manual`,
        String.empty
      ].join("\n"),
      result.output);
  }

  @TestMethod
  public async listsEveryArm64TargetOnceEachRunnerVariableIsSetAsync(): Promise<void> {
    const result = await ListTargetsTests.runAsync({
      ...ListTargetsTests.ownX64(),
      RUNS_ON_LINUX_ARM64: ListTargetsTests.LINUX_ARM64,
      RUNS_ON_WINDOWS_ARM64: ListTargetsTests.WINDOWS_ARM64,
      RUNS_ON_MACOS_ARM64: ListTargetsTests.MACOS_ARM64
    });

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual("Linux x64,Linux ARM64,Windows x64,Windows ARM64,macOS x64,macOS ARM64", result.output.trim().split("\n").map(t => t.split("|")[0]).join(","));
  }

  @TestMethod
  public async namesEachRowsPlatformAndArchitectureAsAPackageTargetIdAsync(): Promise<void> {
    const result = await ListTargetsTests.runAsync({
      ...ListTargetsTests.ownX64(),
      RUNS_ON_LINUX_ARM64: ListTargetsTests.LINUX_ARM64,
      RUNS_ON_WINDOWS_ARM64: ListTargetsTests.WINDOWS_ARM64,
      RUNS_ON_MACOS_ARM64: ListTargetsTests.MACOS_ARM64
    });

    const ids = result.output.trim().split("\n").map(t => t.split("|")).map(t => `${t[3]}-${t[2]}`);
    Assert.areEqual(PackageTarget.listAll().map(t => t.id).sort().join(","), ids.sort().join(","));
  }

  @TestMethod
  public async leavesOutEveryArm64TargetWhenNoArm64RunnerVariableIsSetAsync(): Promise<void> {
    const result = await ListTargetsTests.runAsync(ListTargetsTests.ownX64());

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual("Linux x64,Windows x64,macOS x64", result.output.trim().split("\n").map(t => t.split("|")[0]).join(","));
  }

  @TestMethod
  public async refusesAnX64TargetWhoseRunnerVariableIsNotSetAsync(): Promise<void> {
    const result = await ListTargetsTests.runAsync({ RUNS_ON_LINUX: ListTargetsTests.LINUX });

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(String.empty, result.output);
    Assert.isTrue(result.errors.startsWith("The variable RUNS_ON_WINDOWS names no runner for Windows x64,"), result.errors);
  }

  @TestMethod
  public async refusesAnArm64RunnerVariableThatIsNotJsonAsync(): Promise<void> {
    const result = await ListTargetsTests.runAsync({ ...ListTargetsTests.ownX64(), RUNS_ON_WINDOWS_ARM64: "windows-11-arm" });

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.errors.startsWith("The variable RUNS_ON_WINDOWS_ARM64 names no runner for Windows ARM64,"), result.errors);
  }

  @TestMethod
  public async leavesOutAnX64TargetTheAppDoesNotSupportAsync(): Promise<void> {
    await using folder = await ListTargetsTests.createAppAsync({ desktop: { supportedTargets: ["linux-x64", "windows-x64", "macos-arm64"] } });

    const result = await ListTargetsTests.runAsync(
      { RUNS_ON_LINUX: ListTargetsTests.LINUX, RUNS_ON_WINDOWS: ListTargetsTests.WINDOWS, RUNS_ON_MACOS_ARM64: ListTargetsTests.MACOS_ARM64 },
      [folder.path]);

    Assert.areEqual(0, result.exitCode, result.errors);
    Assert.areEqual("Linux x64,Windows x64,macOS ARM64", ListTargetsTests.names(result.output));
  }

  @TestMethod
  public async keepsLinuxAndWindowsX64WhenTheAppLeavesThemOutAsync(): Promise<void> {
    await using folder = await ListTargetsTests.createAppAsync({ desktop: { supportedTargets: [] } });

    const result = await ListTargetsTests.runAsync(ListTargetsTests.ownX64(), [folder.path]);

    Assert.areEqual(0, result.exitCode, result.errors);
    Assert.areEqual("Linux x64,Windows x64", ListTargetsTests.names(result.output));
  }

  @TestMethod
  public async listsEveryX64TargetWhenTheAppListsNoSupportedTargetsAsync(): Promise<void> {
    await using folder = await ListTargetsTests.createAppAsync({ desktop: {} });

    const result = await ListTargetsTests.runAsync(ListTargetsTests.ownX64(), [folder.path]);

    Assert.areEqual(0, result.exitCode, result.errors);
    Assert.areEqual("Linux x64,Windows x64,macOS x64", ListTargetsTests.names(result.output));
  }

  @TestMethod
  public async refusesAnAppWhoseSupportedTargetsAreInvalidAsync(): Promise<void> {
    await using folder = await ListTargetsTests.createAppAsync({ desktop: { supportedTargets: ["macos-x86"] } });

    const result = await ListTargetsTests.runAsync(ListTargetsTests.ownX64(), [folder.path]);

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(String.empty, result.output);
    Assert.isTrue(result.errors.startsWith("The root package.json's desktop.supportedTargets must list distinct targets among "), result.errors);
  }

  @TestMethod
  public async printsItsUsageForASecondOrEmptyArgumentAsync(): Promise<void> {
    for (const commandArguments of [[".", "now"], [String.empty]]) {
      const result = await ListTargetsTests.runAsync({}, commandArguments);

      Assert.areEqual(2, result.exitCode);
      Assert.isTrue(result.output.endsWith(" list-targets [<app folder>]\n"), result.output);
    }
  }

  private static names(output: string): string {
    return output.trim().split("\n").map(t => t.split("|")[0]).join(",");
  }

  private static async createAppAsync(manifest: object): Promise<{ readonly path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-list-targets-"));
    await writeFile(path.join(folder, "package.json"), JSON.stringify(manifest));
    return {
      path: folder,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    };
  }

  private static ownX64(): Readonly<Record<string, string>> {
    return { RUNS_ON_LINUX: ListTargetsTests.LINUX, RUNS_ON_WINDOWS: ListTargetsTests.WINDOWS, RUNS_ON_MACOS: ListTargetsTests.MACOS };
  }

  private static async runAsync(environment: Readonly<Record<string, string>>, commandArguments: readonly string[] = []): Promise<{ readonly exitCode: number; readonly output: string; readonly errors: string }> {
    const output = new PassThrough();
    const errors = new PassThrough();
    const exitCode = await new ListTargets(output, errors, environment).runAsync(commandArguments);
    return { exitCode, output: output.read(output.readableLength)?.toString() ?? String.empty, errors: errors.read(errors.readableLength)?.toString() ?? String.empty };
  }
}
