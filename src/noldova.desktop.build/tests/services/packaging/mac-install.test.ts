/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { Resources } from "../../../src/resources.js";
import { MacInstall } from "../../../src/services/packaging/mac-install.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";

@TestClass
export class MacInstallTests {
  private static readonly FIELDS: Readonly<Record<string, unknown>> = {
    name: "Sample App",
    publisher: "Sample",
    slug: "sample-app",
    applicationId: "com.example.sample",
    developmentApplicationId: "com.example.sample.development",
    dataFolder: ".sample/app",
    deviceFolders: { windows: "Sample/App", macos: "Sample/App", linux: "sample/app" },
    dataDirectoryVariable: "SAMPLE_APP_DATA_DIR",
    icons: "assets/icons",
    releaseRepository: "example/sample-app",
    installFolder: "Sample Makers"
  };
  private static readonly FILE: string = "/work/out/Sample App-1.2.3-macos-arm64.pkg";
  private static readonly FOLDER: string = "/work";
  private static readonly APPLICATION: string = "/Applications/Sample Makers/Sample App.app";
  private static readonly NEIGHBOUR: string = "/Applications/Sample Makers/Smoke Neighbour.app";
  private static readonly PROGRAM: string = `${MacInstallTests.APPLICATION}/Contents/MacOS/Sample App`;
  private static readonly PROBES: string = `test ! -e ${MacInstallTests.APPLICATION}\npkgutil --pkgs`;
  private static readonly PLACE: string = `sudo --non-interactive mkdir -p ${MacInstallTests.NEIGHBOUR}`;
  private static readonly INSTALL: string = `sudo --non-interactive installer -pkg ${MacInstallTests.FILE} -target /`;
  private static readonly REMOVAL: string = [`sudo --non-interactive rm -rf ${MacInstallTests.APPLICATION} ${MacInstallTests.NEIGHBOUR}`,
    "sudo --non-interactive pkgutil --forget com.example.sample"].join("\n");
  private static readonly FAILURE: ProcessResult = new ProcessResult(1, String.empty, "missing");

  @TestMethod
  public async installsThePackageBesideAnotherAppInTheFolderAndLeavesThatAppAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture();

    const install = await MacInstall.installAsync(runner, MacInstallTests.FILE, MacInstallTests.product(), MacInstallTests.FOLDER);
    const report = await install.verifyAsync();

    Assert.areEqual("com.example.sample", install.packageName);
    Assert.areEqual(`${MacInstallTests.PROGRAM}|${MacInstallTests.PROGRAM}|${MacInstallTests.APPLICATION}/Contents/Resources`,
      [install.installed.program, install.installed.mainProcess, install.installed.resources].join("|"));
    Assert.isNull(install.installed.command);
    Assert.areEqual([MacInstallTests.PROBES, MacInstallTests.PLACE, MacInstallTests.INSTALL, `test -e ${MacInstallTests.PROGRAM}`, `test -e ${MacInstallTests.NEIGHBOUR}`].join("\n"),
      runner.captured.join("\n"));
    Assert.areEqual(`${MacInstallTests.FILE} installed ${MacInstallTests.APPLICATION} and left ${MacInstallTests.NEIGHBOUR} beside it.`, report);
  }

  @TestMethod
  public async removesTheAppItsNeighbourAndThePackagesReceiptAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture();
    const install = await MacInstall.installAsync(runner, MacInstallTests.FILE, MacInstallTests.product(), MacInstallTests.FOLDER);

    const report = await install.removeAsync();

    Assert.areEqual(MacInstallTests.REMOVAL, runner.captured.slice(-2).join("\n"));
    Assert.areEqual(`Removed ${MacInstallTests.APPLICATION} and ${MacInstallTests.NEIGHBOUR}.`, report);
  }

  @TestMethod
  public async removesWhatItPlacedWhenTheInstallerFailsAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture((command, commandArguments) =>
      ScriptedRunnerFixture.format(command, commandArguments) === MacInstallTests.INSTALL ? MacInstallTests.FAILURE : ScriptedRunnerFixture.SUCCESS);

    const error = await Assert.throwsAsync(() => MacInstall.installAsync(runner, MacInstallTests.FILE, MacInstallTests.product(), MacInstallTests.FOLDER), BuildException);

    Assert.isTrue(error.message.includes("missing"), error.message);
    Assert.areEqual([MacInstallTests.PROBES, MacInstallTests.PLACE, MacInstallTests.INSTALL, MacInstallTests.REMOVAL].join("\n"), runner.captured.join("\n"));
  }

  @TestMethod
  public async keepsTheInstallersFailureWhenTheRemovalAfterItFailsTooAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture((command, commandArguments) => {
      const line = ScriptedRunnerFixture.format(command, commandArguments);
      if (line === MacInstallTests.INSTALL)
        return MacInstallTests.FAILURE;
      return line.startsWith("sudo --non-interactive rm ") ? Promise.reject(new Error("rm stalled.")) : ScriptedRunnerFixture.SUCCESS;
    });

    const error = await Assert.throwsAsync(() => MacInstall.installAsync(runner, MacInstallTests.FILE, MacInstallTests.product(), MacInstallTests.FOLDER), BuildException);

    Assert.areEqual(Resources.formatSystemInstallNotUndone(Resources.formatProcessFailed("sudo", ["--non-interactive", "installer", "-pkg", MacInstallTests.FILE, "-target", "/"], 1, "missing"),
      "rm stalled."), error.message);
  }

  @TestMethod
  public async refusesAnAppOrReceiptThisMachineAlreadyHoldsBeforePlacingAnythingAsync(): Promise<void> {
    const bundled = new ScriptedRunnerFixture((command, commandArguments) =>
      ScriptedRunnerFixture.format(command, commandArguments) === `test ! -e ${MacInstallTests.APPLICATION}` ? MacInstallTests.FAILURE : ScriptedRunnerFixture.SUCCESS);
    const received = new ScriptedRunnerFixture((command, commandArguments) => {
      const line = ScriptedRunnerFixture.format(command, commandArguments);
      return line === "pkgutil --pkgs" ? new ProcessResult(0, "com.apple.pkg.Core\ncom.example.sample\n", String.empty) : ScriptedRunnerFixture.SUCCESS;
    });

    const app = await Assert.throwsAsync(() => MacInstall.installAsync(bundled, MacInstallTests.FILE, MacInstallTests.product(), MacInstallTests.FOLDER), BuildException);
    const receipt = await Assert.throwsAsync(() => MacInstall.installAsync(received, MacInstallTests.FILE, MacInstallTests.product(), MacInstallTests.FOLDER), BuildException);

    Assert.areEqual(Resources.formatMacAlreadyInstalled(MacInstallTests.APPLICATION), app.message);
    Assert.areEqual(Resources.formatMacAlreadyInstalled("com.example.sample"), receipt.message);
    Assert.areEqual(`test ! -e ${MacInstallTests.APPLICATION}`, bundled.captured.join("\n"));
    Assert.areEqual(MacInstallTests.PROBES, received.captured.join("\n"));
  }

  @TestMethod
  public async refusesAnInstallWithoutTheProgramOrThatRemovedTheNeighbourAsync(): Promise<void> {
    const missing = new ScriptedRunnerFixture((command, commandArguments) =>
      ScriptedRunnerFixture.format(command, commandArguments) === `test -e ${MacInstallTests.PROGRAM}` ? MacInstallTests.FAILURE : ScriptedRunnerFixture.SUCCESS);
    const touched = new ScriptedRunnerFixture((command, commandArguments) =>
      ScriptedRunnerFixture.format(command, commandArguments) === `test -e ${MacInstallTests.NEIGHBOUR}` ? MacInstallTests.FAILURE : ScriptedRunnerFixture.SUCCESS);

    const unfound = await Assert.throwsAsync(() => MacInstall.installAsync(missing, MacInstallTests.FILE, MacInstallTests.product(), MacInstallTests.FOLDER), BuildException);
    const install = await MacInstall.installAsync(touched, MacInstallTests.FILE, MacInstallTests.product(), MacInstallTests.FOLDER);
    const replaced = await Assert.throwsAsync(() => install.verifyAsync(), BuildException);

    Assert.isTrue(unfound.message.includes(MacInstallTests.PROGRAM), unfound.message);
    Assert.areEqual(MacInstallTests.REMOVAL, missing.captured.slice(-2).join("\n"));
    Assert.areEqual(`Installing the installer package removed or replaced ${MacInstallTests.NEIGHBOUR}, which it must leave beside the app.`, replaced.message);
  }

  @TestMethod
  public async refusesAnAppThatNamesNoFolderBeforeRunningAnythingAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture();

    const refusal = await Assert.throwsAsync(() => MacInstall.installAsync(runner, MacInstallTests.FILE, MacInstallTests.product(null), MacInstallTests.FOLDER), BuildException);

    Assert.areEqual("Only an app that names an install folder makes a macOS installer package, so --pkg smokes it on macOS alone.", refusal.message);
    Assert.areEqual(0, runner.captured.length);
  }

  private static product(installFolder: string | null = "Sample Makers"): ProductIdentity {
    const fields = Object.fromEntries(Object.entries(MacInstallTests.FIELDS).filter(([name]) => name !== "installFolder" || !Object.isNull(installFolder)));
    return ProductIdentity.fromManifest(JsonReader.fromValue({ desktop: { product: fields } }));
  }
}
