/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm, symlink } from "node:fs/promises";
import path from "node:path";

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { UnpackedFiles } from "../../../src/services/packaging/unpacked-files.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";
import { Resources } from "../../../src/resources.js";

@TestClass
export class UnpackedFilesTests {
  private static readonly PACKAGE: string = "@sample/runtime";
  private static readonly TARGET: PackageTarget = new PackageTarget(Resources.linuxTarget, "x64");
  private static readonly SCRIPT: string = "console.log(\"sample\");\n";
  private static readonly PACKAGE_SEGMENTS: readonly string[] = ["node_modules", "@sample", "runtime"];
  private static readonly OUTSIDE: string = "a symbolic link on its path leads outside the package's own files; name a file the package holds itself.";

  @TestMethod
  public async listsTheFilesEachInstalledPackageNamesFromItsOwnFolderPassingOverAManifestThatIsNotJson(): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ name: "sample-app", version: "1.0.0" }),
      "node_modules/@sample/runtime/package.json": UnpackedFilesTests.manifest(UnpackedFilesTests.PACKAGE, ["jxa/script.js", "bin/tool.sh"]),
      "node_modules/@sample/runtime/jxa/script.js": UnpackedFilesTests.SCRIPT,
      "node_modules/@sample/runtime/jxa/other.js": UnpackedFilesTests.SCRIPT,
      "node_modules/@sample/runtime/bin/tool.sh": "#!/bin/sh\n",
      "node_modules/@sample/runtime/lib/package.json": UnpackedFilesTests.manifest("lib", ["index.js"]),
      "node_modules/@sample/runtime/lib/index.js": UnpackedFilesTests.SCRIPT,
      "node_modules/outer/package.json": JSON.stringify({ name: "outer", version: "1.0.0" }),
      "node_modules/outer/node_modules/inner/package.json": UnpackedFilesTests.manifest("inner", ["data/table.txt"]),
      "node_modules/outer/node_modules/inner/data/table.txt": "1 2 3\n",
      "node_modules/outer/test/fixtures/node_modules/broken/package.json": "{ \"name\": "
    });

    const files = await UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET);

    Assert.areEqual(JSON.stringify([
      "node_modules/@sample/runtime/jxa/script.js",
      "node_modules/@sample/runtime/bin/tool.sh",
      "node_modules/outer/node_modules/inner/data/table.txt"
    ]), JSON.stringify(files));
  }

  @TestMethod
  @TestData("linux", "x64", "native/linux-x64/helper")
  @TestData("macos", "arm64", "prebuilds/darwin-arm64/helper")
  public async passesOverTheFilesNamedInAddonFoldersTheStageLeftOutForOtherTargets(platform: string, architecture: string, own: string): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": UnpackedFilesTests.manifest(UnpackedFilesTests.PACKAGE,
        ["native/linux-x64/helper", "native/win32-x64/helper.exe", "prebuilds/darwin-arm64/helper", "native/common/helper"]),
      [`node_modules/@sample/runtime/${own}`]: "helper",
      "node_modules/@sample/runtime/native/common/helper": "helper"
    });

    const files = await UnpackedFiles.listAsync(folder.path, new PackageTarget(platform, architecture));

    Assert.areEqual(JSON.stringify([`node_modules/@sample/runtime/${own}`, "node_modules/@sample/runtime/native/common/helper"]), JSON.stringify(files));
  }

  @TestMethod
  @TestData("jxa/script.j?", "its path holds a character a file pattern reads as a wildcard; name the file with / between folders.")
  @TestData("jxa\\script.js", "its path holds a character a file pattern reads as a wildcard; name the file with / between folders.")
  @TestData("!jxa/script.js", "its path holds a character a file pattern reads as a wildcard; name the file with / between folders.")
  @TestData("/jxa/script.js", "it is an absolute path; name the file from the package's folder.")
  @TestData("C:/jxa/script.js", "it is an absolute path; name the file from the package's folder.")
  @TestData("../other/script.js", "its path has an empty, . or .. segment; name the file from the package's folder without one.")
  @TestData("jxa/./script.js", "its path has an empty, . or .. segment; name the file from the package's folder without one.")
  @TestData("jxa//script.js", "its path has an empty, . or .. segment; name the file from the package's folder without one.")
  @TestData("node_modules/inner/data.txt", "its path goes into node_modules, which holds other packages; each package names only its own files.")
  @TestData("jxa/Script.js", "the package holds script.js, not Script.js; name each folder and file in its own case.")
  @TestData("JXA/script.js", "the package holds jxa, not JXA; name each folder and file in its own case.")
  @TestData("jxa/missing.js", "the package holds no file there.")
  @TestData("jxa/script.js/more.js", "the package holds no file there.")
  @TestData("jxa", "the package holds no file there.")
  public async refusesAFileThatIsNotOneOfThePackagesOwnNamingThePackageAndThePath(file: string, reason: string): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": UnpackedFilesTests.manifest(UnpackedFilesTests.PACKAGE, [file]),
      "node_modules/@sample/runtime/jxa/script.js": UnpackedFilesTests.SCRIPT,
      "node_modules/@sample/runtime/node_modules/inner/data.txt": UnpackedFilesTests.SCRIPT,
      "node_modules/@sample/other/script.js": UnpackedFilesTests.SCRIPT
    });

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual(`@sample/runtime names ${file} to keep outside app.asar, but ${reason}`, error.message);
  }

  @TestMethod
  @TestData("outside", "lib/script.js")
  @TestData("node_modules/@sample/runtime/node_modules/inner", "lib/data.txt")
  public async refusesAFileAFolderLinkTakesOutsideThePackagesOwnFiles(linked: string, file: string): Promise<void> {
    await using folder = await UnpackedFilesTests.createLinkedFolderAsync(file);
    await symlink(path.join(folder.path, ...linked.split("/")), path.join(folder.path, ...UnpackedFilesTests.PACKAGE_SEGMENTS, "lib"), "junction");

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual(`@sample/runtime names ${file} to keep outside app.asar, but ${UnpackedFilesTests.OUTSIDE}`, error.message);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async refusesAFileLinkToAFileOutsideThePackage(): Promise<void> {
    await using folder = await UnpackedFilesTests.createLinkedFolderAsync("lib");
    await symlink(path.join(folder.path, "outside", "script.js"), path.join(folder.path, ...UnpackedFilesTests.PACKAGE_SEGMENTS, "lib"));

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual(`@sample/runtime names lib to keep outside app.asar, but ${UnpackedFilesTests.OUTSIDE}`, error.message);
  }

  @TestMethod
  public async refusesALinkThatLeadsNowhere(): Promise<void> {
    await using folder = await UnpackedFilesTests.createLinkedFolderAsync("lib");
    await mkdir(path.join(folder.path, "missing"));
    await symlink(path.join(folder.path, "missing"), path.join(folder.path, ...UnpackedFilesTests.PACKAGE_SEGMENTS, "lib"), "junction");
    await rm(path.join(folder.path, "missing"), { recursive: true });

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual("@sample/runtime names lib to keep outside app.asar, but the package holds no file there.", error.message);
  }

  @TestMethod
  public async passesOnAFailureToResolveALinkOtherThanAMissingFile(): Promise<void> {
    await using folder = await UnpackedFilesTests.createLinkedFolderAsync("lib");
    const link = path.join(folder.path, ...UnpackedFilesTests.PACKAGE_SEGMENTS, "lib");
    await symlink(link, link, "junction");

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), Error);

    Assert.isTrue("code" in error && error.code === "ELOOP", String(error));
  }

  @TestMethod
  public async refusesAFileNamedTwice(): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": UnpackedFilesTests.manifest(UnpackedFilesTests.PACKAGE, ["jxa/script.js", "jxa/script.js"]),
      "node_modules/@sample/runtime/jxa/script.js": UnpackedFilesTests.SCRIPT
    });

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual("@sample/runtime names jxa/script.js to keep outside app.asar, but it names that file twice; name each file once.", error.message);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async refusesAFileNamedTwiceThroughALinkInThePackage(): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": UnpackedFilesTests.manifest(UnpackedFilesTests.PACKAGE, ["jxa/script.js", "jxa/alias.js"]),
      "node_modules/@sample/runtime/jxa/script.js": UnpackedFilesTests.SCRIPT
    });
    await symlink("script.js", path.join(folder.path, ...UnpackedFilesTests.PACKAGE_SEGMENTS, "jxa", "alias.js"));

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual("@sample/runtime names jxa/alias.js to keep outside app.asar, but it names that file twice; name each file once.", error.message);
  }

  @TestMethod
  @TestData("{ \"unpacked\": \"jxa/script.js\" }")
  @TestData("[\"jxa/script.js\"]")
  @TestData("{ \"unpacked\": [7] }")
  @TestData("{}")
  @TestData("null")
  public async refusesAFieldThatIsNotAListOfPaths(field: string): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": JSON.stringify({ name: UnpackedFilesTests.PACKAGE, version: "1.0.0", noldovaDesktop: JsonReader.parseValue(field) }),
      "node_modules/@sample/runtime/jxa/script.js": UnpackedFilesTests.SCRIPT
    });

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual("@sample/runtime's package.json must give noldovaDesktop.unpacked as a list of paths of the package's own files, with / between folders.", error.message);
  }

  @TestMethod
  public async listsNoFilesOfAPackageWhoseNoldovaDesktopNamesOnlyItsUpstreamSource(): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": JSON.stringify({ name: UnpackedFilesTests.PACKAGE, version: "1.0.0",
        noldovaDesktop: { sourcePages: ["https://example.com/sample"], sources: [{ url: "https://example.com/sources/sample-1.0.0.tar.gz", size: 10, sha256: "ab".repeat(32) }] } })
    });

    const files = await UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET);

    Assert.areEqual(0, files.length);
  }

  @TestMethod
  public async namesAPackageWithoutANameByItsFolder(): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": JSON.stringify({ version: "1.0.0", noldovaDesktop: { unpacked: "jxa/script.js" } })
    });

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual("node_modules/@sample/runtime's package.json must give noldovaDesktop.unpacked as a list of paths of the package's own files, with / between folders.",
      error.message);
  }

  @TestMethod
  @TestData("README.md", "it leaves out a package's top-level README.md.")
  @TestData("examples/run.js", "it leaves out a package's top-level examples.")
  @TestData("test/run.js", "it leaves out a package's top-level test.")
  @TestData("CHANGELOG.md", "it leaves out every file and folder named CHANGELOG.md in a package.")
  @TestData("binding.gyp", "it leaves out every file and folder named binding.gyp in a package.")
  @TestData("src/addon.cc", "it leaves out every .cc file.")
  @TestData("lib/index.d.ts", "it leaves out every .d.ts file.")
  @TestData("lib/._script.js", "it leaves out every file and folder whose name starts with ._.")
  @TestData("lib/.gitignore", "it leaves out every file and folder named .gitignore.")
  @TestData("build/Makefile", "it leaves out gyp's Makefile in a package's folders whose names end in build.")
  public async refusesANamedFileElectronBuilderNeverShipsNamingThePackageThePathAndTheRule(file: string, reason: string): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": UnpackedFilesTests.manifest(UnpackedFilesTests.PACKAGE, [file]),
      [`node_modules/@sample/runtime/${file}`]: UnpackedFilesTests.SCRIPT
    });

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual(`${UnpackedFilesTests.PACKAGE} names ${file} to keep outside app.asar, but electron-builder never ships it, since ${reason}`, error.message);
  }

  @TestMethod
  public async keepsANamedProgramOrLibraryForWindowsAndLeavesItOutOfOtherTargetsWhereElectronBuilderDoesNotShipIt(): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": UnpackedFilesTests.manifest(UnpackedFilesTests.PACKAGE, ["bin/helper.exe", "bin/helper.dll", "bin/helper.sh"]),
      "node_modules/@sample/runtime/bin/helper.exe": UnpackedFilesTests.SCRIPT,
      "node_modules/@sample/runtime/bin/helper.dll": UnpackedFilesTests.SCRIPT,
      "node_modules/@sample/runtime/bin/helper.sh": UnpackedFilesTests.SCRIPT
    });
    const all = ["bin/helper.exe", "bin/helper.dll", "bin/helper.sh"].map(t => `node_modules/@sample/runtime/${t}`);

    for (const target of PackageTarget.listAll())
      Assert.areEqual(JSON.stringify(target.platform === Resources.windowsTarget ? all : all.slice(2)), JSON.stringify(await UnpackedFiles.listAsync(folder.path, target)), target.id);
  }

  @TestMethod
  public async namesAMissingFileOfAPackageWithoutANameByItsFolder(): Promise<void> {
    await using folder = await SourceTreeFixture.createAsync({
      "node_modules/nameless/package.json": JSON.stringify({ version: "1.0.0", noldovaDesktop: { unpacked: ["missing.js"] } })
    });

    const error = await Assert.throwsAsync(() => UnpackedFiles.listAsync(folder.path, UnpackedFilesTests.TARGET), BuildException);

    Assert.areEqual("node_modules/nameless names missing.js to keep outside app.asar, but the package holds no file there.", error.message);
  }

  private static createLinkedFolderAsync(file: string): Promise<SourceTreeFixture> {
    return SourceTreeFixture.createAsync({
      "node_modules/@sample/runtime/package.json": UnpackedFilesTests.manifest(UnpackedFilesTests.PACKAGE, [file]),
      "node_modules/@sample/runtime/node_modules/inner/data.txt": UnpackedFilesTests.SCRIPT,
      "outside/script.js": UnpackedFilesTests.SCRIPT
    });
  }

  private static manifest(name: string, unpacked: readonly string[]): string {
    return JSON.stringify({ name, version: "1.0.0", noldovaDesktop: { unpacked } });
  }
}
