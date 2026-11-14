/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { Resources } from "../../../src/resources.js";
import { ShippedFiles } from "../../../src/services/packaging/shipped-files.js";

@TestClass
export class ShippedFilesTests {
  private static readonly NODE_PTY_PROGRAMS: readonly string[] = [
    "node_modules/node-pty/prebuilds/win32-arm64/conpty/OpenConsole.exe",
    "node_modules/node-pty/prebuilds/win32-arm64/conpty/conpty.dll",
    "node_modules/node-pty/prebuilds/win32-x64/conpty/OpenConsole.exe",
    "node_modules/node-pty/prebuilds/win32-x64/conpty/conpty.dll",
    "node_modules/node-pty/third_party/conpty/1.25.260303002/win10-arm64/OpenConsole.exe",
    "node_modules/node-pty/third_party/conpty/1.25.260303002/win10-arm64/conpty.dll",
    "node_modules/node-pty/third_party/conpty/1.25.260303002/win10-x64/OpenConsole.exe",
    "node_modules/node-pty/third_party/conpty/1.25.260303002/win10-x64/conpty.dll"
  ];
  private static readonly NODE_PTY_ADDONS: readonly string[] = [
    "node_modules/node-pty/prebuilds/darwin-arm64/pty.node",
    "node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper",
    "node_modules/node-pty/prebuilds/darwin-x64/pty.node",
    "node_modules/node-pty/prebuilds/darwin-x64/spawn-helper",
    "node_modules/node-pty/prebuilds/linux-arm64/pty.node",
    "node_modules/node-pty/prebuilds/linux-x64/pty.node",
    "node_modules/node-pty/prebuilds/win32-arm64/conpty.node",
    "node_modules/node-pty/prebuilds/win32-arm64/conpty_console_list.node",
    "node_modules/node-pty/prebuilds/win32-x64/conpty.node",
    "node_modules/node-pty/prebuilds/win32-x64/conpty_console_list.node"
  ];

  @TestMethod
  public keepsEachOfNodePtysNativeFilesForWindowsAndLeavesItsProgramsAndLibrariesOutOfOtherTargets(): void {
    const files = [...ShippedFilesTests.NODE_PTY_ADDONS, ...ShippedFilesTests.NODE_PTY_PROGRAMS];

    for (const target of PackageTarget.listAll())
      Assert.areEqual(
        JSON.stringify(target.platform === Resources.windowsTarget ? files : ShippedFilesTests.NODE_PTY_ADDONS),
        JSON.stringify(ShippedFiles.filter(files, target)),
        target.id);
  }

  @TestMethod
  public keepsAProgramOrLibraryOutsideAPackageOnEveryTarget(): void {
    const files = ["resources/helper.exe", "resources/helper.dll", "native/linux-x64/posix-process.node"];

    for (const target of PackageTarget.listAll())
      Assert.areEqual(JSON.stringify(files), JSON.stringify(ShippedFiles.filter(files, target)), target.id);
  }

  @TestMethod
  public keepsAPathThatEndsAtAPackagesFolderOnEveryTarget(): void {
    const files = ["node_modules", "resources/node_modules"];

    for (const target of PackageTarget.listAll())
      Assert.areEqual(JSON.stringify(files), JSON.stringify(ShippedFiles.filter(files, target)), target.id);
  }

  @TestMethod
  public leavesOutWhatElectronBuilderLeavesOutOfThePackageAndKeepsTheRest(): void {
    const kept = [
      "node_modules/sample/lib/test/helper.node",
      "node_modules/sample/prebuild/helper.node",
      "node_modules/sample/build/Release/helper.node",
      "node_modules/@scope/sample/lib/helper.node",
      "node_modules/keytar/build/Release/keytar.node",
      "node_modules/keytar-prebuild/src/helper.node",
      "node_modules/libui-node/lib/build/helper.node",
      "node_modules/@scope/libui-node/build/helper.node",
      "resources/.yarn/helper.node",
      "resources/.editorconfig",
      "node_modules/sample/lib/electron-builder.yml"
    ];
    const left = [
      "helper.pdb",
      "main.o",
      ".git/hooks/helper",
      "resources/._helper.node",
      "resources/electron-builder.json",
      ".editorconfig",
      ".yarn/helper.node",
      ".yarnrc.yml",
      "node_modules/sample/test/helper.node",
      "node_modules/sample/examples/helper.node",
      "node_modules/@scope/sample/test/helper.node",
      "node_modules/sample/node_modules/inner/__tests__/helper.node",
      "node_modules/sample/build/Release/obj.target/helper.node",
      "node_modules/sample/build/Release/.deps/helper.node",
      "node_modules/sample/build/Makefile",
      "node_modules/sample/build/helper.target.mk",
      "node_modules/sample/build/config.gypi",
      "node_modules/sample/node_gyp_bins/python3",
      "node_modules/sample/lib/._helper.node",
      "node_modules/sample/lib/helper.o",
      "node_modules/keytar/src/helper.node",
      "node_modules/lzma-native/deps/helper.node",
      "node_modules/libui-node/build/helper.node"
    ];

    Assert.areEqual(JSON.stringify(kept), JSON.stringify(ShippedFiles.filter([...kept, ...left], new PackageTarget(Resources.linuxTarget, "x64"))));
  }
}
