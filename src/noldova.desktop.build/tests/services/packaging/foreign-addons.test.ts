/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ForeignAddons } from "../../../src/services/packaging/foreign-addons.js";

@TestClass
export class ForeignAddonsTests {
  private static readonly ADDON_TARGETS: readonly string[] = ["win32-x64", "win32-arm64", "linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"];
  private static readonly RUNTIME: string = "node_modules/@noldova/desktop.runtime";
  private static readonly INNER: string = "node_modules/host/node_modules/@scope/inner";
  private static readonly PTY: string = "node_modules/node-pty";
  private static readonly CONPTY: string = `${ForeignAddonsTests.PTY}/third_party/conpty/1.25.260303002`;
  private static readonly CONPTY_TARGETS: readonly string[] = ["win10-x64", "win10-arm64"];
  private static readonly CONPTY_FILES: readonly string[] = ["OpenConsole.exe", "conpty.dll"];
  private static readonly KEPT: readonly string[] = [
    "native/darwin-x64/root.node",
    "node_modules/loose/lib/native/darwin-x64/loose.node",
    "node_modules/loose/package.json",
    "node_modules/prebuilt/native/common/prebuilt.node",
    "node_modules/prebuilt/package.json"
  ];

  @TestMethod
  @TestData("windows", "x64", "win32-x64")
  @TestData("windows", "arm64", "win32-arm64")
  @TestData("linux", "x64", "linux-x64")
  @TestData("linux", "arm64", "linux-arm64")
  @TestData("macos", "x64", "darwin-x64")
  @TestData("macos", "arm64", "darwin-arm64")
  public async leavesOutEveryPackagesAddonsForTheOtherTargetsAndKeepsTheTargetsOwn(platform: string, architecture: string, own: string): Promise<void> {
    const ownConpty = platform === "windows" ? `win10-${architecture}` : null;
    await using stage = await ForeignAddonsTests.createStageAsync();

    const removed = await ForeignAddons.removeAsync(stage.path, new PackageTarget(platform, architecture));
    const left = await ForeignAddonsTests.listAsync(stage.path);

    Assert.areEqual(own, new PackageTarget(platform, architecture).addonTarget);
    Assert.areEqual(JSON.stringify([
      ...ForeignAddonsTests.ADDON_TARGETS.filter(t => t !== own).map(t => `${ForeignAddonsTests.RUNTIME}/native/${t}`).sort(),
      ...["darwin-arm64", "linux-x64"].filter(t => t !== own).map(t => `${ForeignAddonsTests.INNER}/native/${t}`),
      ...ForeignAddonsTests.ADDON_TARGETS.filter(t => t !== own).map(t => `${ForeignAddonsTests.PTY}/prebuilds/${t}`).sort(),
      ...ForeignAddonsTests.CONPTY_TARGETS.filter(t => t !== ownConpty).map(t => `${ForeignAddonsTests.CONPTY}/${t}`).sort()
    ]), JSON.stringify(removed));
    Assert.areEqual(JSON.stringify([
      ...ForeignAddonsTests.KEPT,
      ...["darwin-arm64", "linux-x64"].includes(own) ? [`${ForeignAddonsTests.INNER}/native/${own}/inner.node`] : [],
      `${ForeignAddonsTests.INNER}/package.json`,
      "node_modules/host/package.json",
      `${ForeignAddonsTests.RUNTIME}/native/${own}/${own.startsWith("win32") ? "windows" : "posix"}-process.node`,
      `${ForeignAddonsTests.RUNTIME}/package.json`,
      `${ForeignAddonsTests.PTY}/package.json`,
      `${ForeignAddonsTests.PTY}/prebuilds/${own}/pty.node`,
      ...Object.isNull(ownConpty) ? [] : ForeignAddonsTests.CONPTY_FILES.map(t => `${ForeignAddonsTests.CONPTY}/${ownConpty}/${t}`)
    ].sort()), JSON.stringify(left));
  }

  @TestMethod
  public async leavesAStageWithoutPackagesAsItIs(): Promise<void> {
    await using stage = await ForeignAddonsTests.createStageAsync({ "native/darwin-x64/root.node": String.empty });

    const removed = await ForeignAddons.removeAsync(stage.path, new PackageTarget("linux", "x64"));

    Assert.areEqual("[]", JSON.stringify(removed));
    Assert.areEqual(JSON.stringify(["native/darwin-x64/root.node"]), JSON.stringify(await ForeignAddonsTests.listAsync(stage.path)));
  }

  @TestMethod
  public async leavesOutAddonsForPlatformsAndProcessorsThatNoTargetBuilds(): Promise<void> {
    await using stage = await ForeignAddonsTests.createStageAsync({
      "node_modules/prebuilt/package.json": "{}",
      "node_modules/prebuilt/native/android-arm64/prebuilt.node": String.empty,
      "node_modules/prebuilt/native/linux-x64/prebuilt.node": String.empty,
      "node_modules/prebuilt/prebuilds/darwin-x64+arm64/prebuilt.node": String.empty,
      "node_modules/prebuilt/prebuilds/linux-arm/prebuilt.node": String.empty,
      "node_modules/prebuilt/prebuilds/linux-x64/prebuilt.node": String.empty,
      "node_modules/prebuilt/prebuilds/win32-ia32/prebuilt.node": String.empty
    });

    const removed = await ForeignAddons.removeAsync(stage.path, new PackageTarget("linux", "x64"));

    Assert.areEqual(JSON.stringify([
      "node_modules/prebuilt/native/android-arm64",
      "node_modules/prebuilt/prebuilds/darwin-x64+arm64",
      "node_modules/prebuilt/prebuilds/linux-arm",
      "node_modules/prebuilt/prebuilds/win32-ia32"
    ]), JSON.stringify(removed));
    Assert.areEqual(JSON.stringify([
      "node_modules/prebuilt/native/linux-x64/prebuilt.node",
      "node_modules/prebuilt/package.json",
      "node_modules/prebuilt/prebuilds/linux-x64/prebuilt.node"
    ]), JSON.stringify(await ForeignAddonsTests.listAsync(stage.path)));
  }

  @TestMethod
  @TestData("prebuilds/win32-ia32/pty.node", "windows", "x64", true)
  @TestData("prebuilds/linux-arm/pty.node", "linux", "arm64", true)
  @TestData("prebuilds/darwin-x64+arm64/pty.node", "macos", "arm64", true)
  @TestData("native/freebsd-x64/pty.node", "linux", "x64", true)
  @TestData("prebuilds/win32-arm64/pty.node", "windows", "x64", true)
  @TestData("prebuilds/win32-x64/pty.node", "windows", "x64", false)
  @TestData("prebuilds/common/pty.node", "windows", "x64", false)
  @TestData("prebuilds/win32-x64-legacy/pty.node", "windows", "x64", false)
  @TestData("native/Linux-x64/pty.node", "windows", "x64", false)
  @TestData("third_party/conpty/1.25.260303002/win10-arm64/OpenConsole.exe", "windows", "x64", true)
  @TestData("third_party/conpty/1.25.260303002/win10-x64/OpenConsole.exe", "windows", "x64", false)
  @TestData("third_party/conpty/1.25.260303002/win10-x64/OpenConsole.exe", "windows", "arm64", true)
  @TestData("third_party/conpty/1.25.260303002/win10-arm64/OpenConsole.exe", "windows", "arm64", false)
  @TestData("third_party/conpty/1.25.260303002/win10-x64/OpenConsole.exe", "linux", "x64", true)
  @TestData("third_party/conpty/1.25.260303002/win10-x64", "windows", "arm64", false)
  @TestData("third_party/conpty/1.25.260303002/common/OpenConsole.exe", "windows", "x64", false)
  @TestData("third_party/other/1.25.260303002/win10-arm64/OpenConsole.exe", "windows", "x64", false)
  @TestData("lib/conpty/1.25.260303002/win10-arm64/OpenConsole.exe", "windows", "x64", false)
  @TestData("OpenConsole.exe", "windows", "x64", false)
  public tellsWhetherAPackagesFileBelongsToAnotherTarget(file: string, platform: string, architecture: string, leftOut: boolean): void {
    Assert.areEqual(leftOut, ForeignAddons.isLeftOut(file, new PackageTarget(platform, architecture)));
  }

  private static async createStageAsync(files: Readonly<Record<string, string>> | null = null): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "foreign-addons-"));
    const written = files ?? {
      ...Object.fromEntries(ForeignAddonsTests.KEPT.map(t => [t, String.empty])),
      [`${ForeignAddonsTests.RUNTIME}/package.json`]: "{}",
      ...Object.fromEntries(ForeignAddonsTests.ADDON_TARGETS.map(t => [`${ForeignAddonsTests.RUNTIME}/native/${t}/${t.startsWith("win32") ? "windows" : "posix"}-process.node`, String.empty])),
      "node_modules/host/package.json": "{}",
      [`${ForeignAddonsTests.INNER}/package.json`]: "{}",
      [`${ForeignAddonsTests.INNER}/native/darwin-arm64/inner.node`]: String.empty,
      [`${ForeignAddonsTests.INNER}/native/linux-x64/inner.node`]: String.empty,
      [`${ForeignAddonsTests.PTY}/package.json`]: "{}",
      ...Object.fromEntries(ForeignAddonsTests.ADDON_TARGETS.map(t => [`${ForeignAddonsTests.PTY}/prebuilds/${t}/pty.node`, String.empty])),
      ...Object.fromEntries(ForeignAddonsTests.CONPTY_TARGETS.flatMap(t => ForeignAddonsTests.CONPTY_FILES.map(file => [`${ForeignAddonsTests.CONPTY}/${t}/${file}`, String.empty])))
    };
    for (const [name, content] of Object.entries(written)) {
      const file = path.join(folder, ...name.split("/"));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
    }
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }

  private static async listAsync(folder: string): Promise<readonly string[]> {
    return (await readdir(folder, { recursive: true, withFileTypes: true })).filter(t => t.isFile())
      .map(t => path.relative(folder, path.join(t.parentPath, t.name)).split(path.sep).join("/")).sort();
  }
}
