/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { DevelopmentBinary } from "../../../src/services/desktop/development-binary.js";
import { DevelopmentFolderFixture } from "../../fixtures/development-folder.fixture.js";
import { ProgramRunFixture } from "../../fixtures/program-run.fixture.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";

@TestClass
export class DevelopmentBinaryTests {
  private static readonly PREPARING: string = "Preparing the Sample App development binary...\n";

  @TestMethod
  public async preparesTheLinuxBinaryOnlyWhenItsInputsChangeOrItIsGoneAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeLinuxDistributionAsync();
    const binary = new DevelopmentBinary(folder.path, new ScriptedRunnerFixture(), "linux", "x64");

    const first = await DevelopmentBinaryTests.prepareAsync(binary);
    const unchanged = await DevelopmentBinaryTests.prepareAsync(binary);
    await writeFile(path.join(folder.output, "development-app.sha256"), "stale");
    const stale = await DevelopmentBinaryTests.prepareAsync(binary);
    await rm(path.join(folder.output, "sample-app"));
    const removed = await DevelopmentBinaryTests.prepareAsync(binary);

    const expected = path.join(folder.output, "sample-app");
    Assert.areEqual(`${expected} ${DevelopmentBinaryTests.PREPARING}`, first);
    Assert.areEqual(`${expected} `, unchanged);
    Assert.areEqual(first, stale);
    Assert.areEqual(first, removed);
    Assert.areEqual(expected, await readFile(path.join(folder.output, "path.txt"), "utf8"));
    Assert.areEqual(folder.output, binary.output);
  }

  @TestMethod
  public async writesThePackageThatStartsTheMainScriptWithTheProductsNameAndVersionAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeLinuxDistributionAsync();
    const binary = new DevelopmentBinary(folder.path, new ScriptedRunnerFixture(), "linux", "x64");

    await DevelopmentBinaryTests.prepareAsync(binary);
    await writeFile(path.join(binary.packageFolder, "package.json"), "stale");
    await DevelopmentBinaryTests.prepareAsync(binary);

    Assert.areEqual(path.join(folder.path, "_build", "development-package"), binary.packageFolder);
    Assert.areEqual(`${JSON.stringify({
      name: "sample-app",
      productName: "Sample App",
      version: "1.2.3",
      private: true,
      main: "../../node_modules/@noldova/desktop.electron/main.js"
    }, null, 2)}
`, await readFile(path.join(binary.packageFolder, "package.json"), "utf8"));
  }

  @TestMethod
  public async installsElectronsBinaryWhenItsDistributionIsMissingAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    const runner = new ScriptedRunnerFixture(async () => {
      await folder.writeLinuxDistributionAsync();
      return ScriptedRunnerFixture.SUCCESS;
    });

    const result = await DevelopmentBinaryTests.prepareAsync(new DevelopmentBinary(folder.path, runner, "linux", "x64"));

    Assert.areEqual(`${path.join(folder.output, "sample-app")} ${DevelopmentBinaryTests.PREPARING}`, result);
    Assert.areEqual(`${path.basename(process.execPath)} ${path.join(folder.path, "node_modules", "electron", "install.js")}`, runner.captured.join("|"));
  }

  @TestMethod
  public async stopsWhenElectronsInstallerFailsAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    const installer = path.join(folder.path, "node_modules", "electron", "install.js");
    const runner = new ScriptedRunnerFixture(() => new ProcessResult(1, String.empty, "no network\n"));

    const error = await Assert.throwsAsync(() => new DevelopmentBinary(folder.path, runner, "linux", "x64").prepareAsync(new PassThrough()), BuildException);

    Assert.areEqual(`"${process.execPath} ${installer}" failed with 1: no network`, error.message);
  }

  @TestMethod
  public async relabelsTheWindowsExecutableWithTheProductAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeWindowsDistributionAsync(true);

    const result = await DevelopmentBinaryTests.prepareAsync(new DevelopmentBinary(folder.path, new ScriptedRunnerFixture(), "win32", "x64"));

    const binary = path.join(folder.output, "Sample App.exe");
    const strings = DevelopmentFolderFixture.readWindowsStrings(await readFile(binary));
    Assert.areEqual(`${binary} ${DevelopmentBinaryTests.PREPARING}`, result);
    Assert.areEqual("Sample|Sample App|Sample App|Sample App.exe|Sample App.exe|1.2.3|1.2.3", [
      strings["CompanyName"], strings["FileDescription"], strings["ProductName"], strings["InternalName"], strings["OriginalFilename"], strings["FileVersion"], strings["ProductVersion"]
    ].join("|"));
    Assert.isFalse(existsSync(path.join(folder.output, "electron.exe")));
  }

  @TestMethod
  public async refusesAWindowsExecutableWithoutVersionInformationAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeWindowsDistributionAsync(false);

    const error = await Assert.throwsAsync(() => new DevelopmentBinary(folder.path, new ScriptedRunnerFixture(), "win32", "x64").prepareAsync(new PassThrough()), BuildException);

    Assert.areEqual("Electron's executable carries no version information to relabel.", error.message);
  }

  @TestMethod
  public async relabelsTheMacBundleItsHelpersAndItsIconThenSignsItAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeMacDistributionAsync();
    const runner = new ScriptedRunnerFixture();

    const result = await DevelopmentBinaryTests.prepareAsync(new DevelopmentBinary(folder.path, runner, "darwin", "arm64"));

    const bundle = path.join(folder.output, "Sample App.app");
    const frameworks = path.join(bundle, "Contents", "Frameworks");
    Assert.areEqual(`${path.join(bundle, "Contents", "MacOS", "Sample App")} ${DevelopmentBinaryTests.PREPARING}`, result);
    Assert.isTrue(existsSync(path.join(frameworks, "Sample App Helper.app", "Contents", "MacOS", "Sample App Helper")));
    Assert.isTrue(existsSync(path.join(frameworks, "Sample App Helper (GPU).app", "Contents", "MacOS", "Sample App Helper (GPU)")));
    Assert.isTrue(existsSync(path.join(frameworks, "Electron Framework.framework")));
    Assert.isFalse(existsSync(path.join(bundle, "Contents", "Resources", "electron.icns")));
    Assert.isFalse(existsSync(path.join(folder.output, "Sample App.iconset")));
    const identifiers = runner.captured.filter(t => t.startsWith("plutil -replace CFBundleIdentifier -string ")).map(t => t.split(" ")[4] ?? String.empty);
    const [main] = identifiers;
    Assert.areEqual(3, identifiers.length);
    Assert.isTrue(Object.isString(main) && main.startsWith("com.example.sample.development."), identifiers.join(","));
    Assert.areEqual(`${main}.helper,${main}.helper.gpu`, identifiers.slice(1).toSorted().join(","));
    Assert.areEqual(9, runner.captured.filter(t => t.startsWith("sips -z ")).length);
    Assert.isTrue(runner.captured.includes(`iconutil --convert icns --output ${path.join(bundle, "Contents", "Resources", "sample-app.icns")} ${path.join(folder.output, "Sample App.iconset")}`));
    Assert.isTrue(runner.captured.includes(`plutil -replace CFBundleIconFile -string sample-app.icns ${path.join(bundle, "Contents", "Info.plist")}`), runner.captured.join("\n"));
    Assert.areEqual(`codesign --force --deep --sign - ${bundle}`, runner.captured.at(-1));
  }

  @TestMethod
  public async stopsWhenAMacCommandFailsAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeMacDistributionAsync();
    const runner = new ScriptedRunnerFixture(t => t === "codesign" ? new ProcessResult(1, String.empty, "refused\n") : ScriptedRunnerFixture.SUCCESS);

    const error = await Assert.throwsAsync(() => new DevelopmentBinary(folder.path, runner, "darwin", "arm64").prepareAsync(new PassThrough()), BuildException);

    Assert.areEqual(`"codesign --force --deep --sign - ${path.join(folder.output, "Sample App.app")}" failed with 1: refused`, error.message);
  }

  @TestMethod
  public async refusesAPlatformItCannotPrepareAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();

    const error = await Assert.throwsAsync(() => new DevelopmentBinary(folder.path, new ScriptedRunnerFixture(), "aix", "ppc64").prepareAsync(new PassThrough()), BuildException);

    Assert.areEqual("The development binary is supported on Windows, macOS and Linux only.", error.message);
  }

  @TestMethod
  public async failsAsAProgramInAFolderWithoutAnAppAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-development-program-"));
    try {
      const run = await ProgramRunFixture.runAsync(import.meta.resolve("../../../src/services/desktop/development-binary.js"), [], folder);

      Assert.areEqual(1, run.exitCode);
      Assert.isTrue(run.output.includes("The root package.json must declare a version of the form major.minor.patch"), run.output);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  private static async prepareAsync(binary: DevelopmentBinary): Promise<string> {
    const report = new PassThrough();
    const executable = await binary.prepareAsync(report);
    return `${executable} ${String(report.read(report.readableLength) ?? String.empty)}`;
  }
}
