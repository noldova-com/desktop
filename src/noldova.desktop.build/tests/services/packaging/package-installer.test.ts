/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessTimeoutException } from "../../../src/exceptions/process-timeout.exception.js";
import { InstalledPackage } from "../../../src/models/packaging/installed-package.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { PackageInstaller } from "../../../src/services/packaging/package-installer.js";
import { UserPath } from "../../../src/services/packaging/user-path.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";

class ScriptedRunner extends ProcessRunner {
  private readonly answer: (command: string, commandArguments: readonly string[]) => Promise<ProcessResult>;

  public readonly calls: string[] = [];
  public environment: NodeJS.ProcessEnv | undefined;

  public constructor(answer: (command: string, commandArguments: readonly string[]) => Promise<ProcessResult>) {
    super();
    this.answer = answer;
    this.environment = undefined;
  }

  public override captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    const [command, commandArguments, , , environment] = call;
    this.calls.push([path.basename(command), ...commandArguments].join(" "));
    this.environment = environment;
    return this.answer(command, commandArguments);
  }
}

class WindowsRunner extends ProcessRunner {
  private readonly uninstaller: string;

  public registry: { readonly type: string; readonly value: string } | null;
  public readonly calls: string[] = [];

  public constructor(uninstaller: string, registry: { readonly type: string; readonly value: string } | null) {
    super();
    this.uninstaller = uninstaller;
    this.registry = registry;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    this.calls.push([path.basename(command), ...commandArguments].join(" "));
    if (command === this.uninstaller) {
      const folder = path.dirname(this.uninstaller);
      for (const entry of await readdir(folder))
        if (path.join(folder, entry) !== this.uninstaller)
          await rm(path.join(folder, entry), { recursive: true });
      return new ProcessResult(0, String.empty, String.empty);
    }
    switch (commandArguments[0]) {
      case "query":
        return Object.isNull(this.registry) ? new ProcessResult(1, String.empty, "ERROR: The system was unable to find the specified registry key or value.")
          : new ProcessResult(0, `\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    ${this.registry.type}    ${this.registry.value}\r\n\r\n`, String.empty);
      case "add":
        this.registry = { type: commandArguments[commandArguments.indexOf("/t") + 1] ?? String.empty, value: commandArguments[commandArguments.indexOf("/d") + 1] ?? String.empty };
        return new ProcessResult(0, "The operation completed successfully.", String.empty);
      case "delete":
        this.registry = null;
        return new ProcessResult(0, "The operation completed successfully.", String.empty);
      default:
        return new ProcessResult(9, String.empty, `Unexpected ${command}`);
    }
  }
}

@TestClass
export class PackageInstallerTests {
  private static readonly PRODUCT: ProductIdentity = new ProductIdentity("Sample App", "Sample", "sample-app", "com.example.sample", "com.example.sample.development",
    ".sample/app", ["Sample/App", "Sample/App", "sample/app"], "SAMPLE_APP_DATA_DIR", "assets/icons", "example/sample-app");

  @TestMethod
  public async uninstallsALeftoverInstallAndTakesOnlyItsCommandOffTheUsersPathKeepingTheValuesType(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder, installer) => {
      const uninstaller = path.join(installFolder, "Uninstall Sample App.exe");
      const command = path.join(installFolder, "bin");
      await mkdir(command, { recursive: true });
      await writeFile(path.join(command, "sample-app.cmd"), String.empty);
      await writeFile(uninstaller, String.empty);
      const runner = new WindowsRunner(uninstaller, { type: "REG_EXPAND_SZ", value: `%USERPROFILE%\\tools;${command.toUpperCase()};C:\\other` });

      const removed = await installer(runner).removeWindowsLeftoverAsync(PackageInstallerTests.PRODUCT, folder, new UserPath(runner, folder));

      Assert.areEqual(`Removed what an earlier run left installed: ${installFolder} and ${command} on the user's Path.`, removed);
      Assert.areEqual(JSON.stringify({ type: "REG_EXPAND_SZ", value: "%USERPROFILE%\\tools;C:\\other" }), JSON.stringify(runner.registry));
      Assert.areEqual(`Uninstall Sample App.exe /S _?=${installFolder}`, runner.calls.find(t => t.startsWith("Uninstall")));
      Assert.isFalse(existsSync(installFolder));
    });
  }

  @TestMethod
  public async removesALeftoverFolderWithoutAnUninstallerAndDeletesAPathThatHeldOnlyItsCommand(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder, installer) => {
      const command = path.join(installFolder, "bin");
      await mkdir(command, { recursive: true });
      await writeFile(path.join(installFolder, "Sample App.exe"), String.empty);
      const runner = new WindowsRunner(path.join(installFolder, "Uninstall Sample App.exe"), { type: "REG_SZ", value: command });

      const removed = await installer(runner).removeWindowsLeftoverAsync(PackageInstallerTests.PRODUCT, folder, new UserPath(runner, folder));

      Assert.areEqual(`Removed what an earlier run left installed: ${installFolder} and ${command} on the user's Path.`, removed);
      Assert.isNull(runner.registry);
      Assert.isFalse(runner.calls.some(t => t.startsWith("Uninstall")));
      Assert.isFalse(existsSync(installFolder));
    });
  }

  @TestMethod
  public async leavesTheUsersPathAndRunsNoUninstallerWhenNothingWasLeft(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder, installer) => {
      const runner = new WindowsRunner(path.join(installFolder, "Uninstall Sample App.exe"), { type: "REG_EXPAND_SZ", value: "C:\\other" });

      const removed = await installer(runner).removeWindowsLeftoverAsync(PackageInstallerTests.PRODUCT, folder, new UserPath(runner, folder));

      Assert.isNull(removed);
      Assert.areEqual(JSON.stringify(["reg.exe query HKCU\\Environment /v Path"]), JSON.stringify(runner.calls));
      Assert.areEqual(JSON.stringify({ type: "REG_EXPAND_SZ", value: "C:\\other" }), JSON.stringify(runner.registry));
    });
  }

  @TestMethod
  public async refusesAnUninstallThatLeavesFilesAndSaysWhatHoldsThem(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder, installer) => {
      const uninstaller = path.join(installFolder, "Uninstall Sample App.exe");
      await PackageInstallerTests.writeAsync(uninstaller, String.empty);
      await PackageInstallerTests.writeAsync(path.join(installFolder, "Sample App.exe"), "app");
      await PackageInstallerTests.writeAsync(path.join(installFolder, "bin", "sample-app.cmd"), "cmd");
      const runner = new ScriptedRunner(command => Promise.resolve(path.basename(command) === "powershell.exe"
        ? new ProcessResult(0, "Sample App.exe: explorer.exe (1234)\n", String.empty) : new ProcessResult(0, String.empty, String.empty)));

      const error = await Assert.throwsAsync(() => installer(runner).uninstallWindowsAsync(PackageInstallerTests.PRODUCT, folder), BuildException);

      Assert.areEqual(`The uninstaller left Sample App.exe, bin, ${path.join("bin", "sample-app.cmd")} in ${installFolder}.\nWhat holds them now:\n`
        + "Sample App.exe: explorer.exe (1234)", error.message);
      Assert.areEqual(`${path.join(installFolder, "Sample App.exe")}\n${path.join(installFolder, "bin", "sample-app.cmd")}`, runner.environment?.["NOLDOVA_DESKTOP_LEFT_FILES"]);
      Assert.isFalse(existsSync(uninstaller));
    });
  }

  @TestMethod
  public async refusesAnUninstallThatLeavesOnlyFoldersWithoutAskingWhatHoldsThem(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder, installer) => {
      await PackageInstallerTests.writeAsync(path.join(installFolder, "Uninstall Sample App.exe"), String.empty);
      await mkdir(path.join(installFolder, "bin"));
      const runner = new ScriptedRunner(() => Promise.resolve(new ProcessResult(0, String.empty, String.empty)));

      const error = await Assert.throwsAsync(() => installer(runner).uninstallWindowsAsync(PackageInstallerTests.PRODUCT, folder), BuildException);

      Assert.areEqual(`The uninstaller left bin in ${installFolder}.`, error.message);
      Assert.areEqual(1, runner.calls.length);
    });
  }

  @TestMethod
  public async refusesAnUninstallerThatCannotBeRemovedAfterItRan(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder, installer) => {
      const uninstaller = path.join(installFolder, "Uninstall Sample App.exe");
      await mkdir(uninstaller, { recursive: true });
      const runner = new ScriptedRunner(() => Promise.resolve(new ProcessResult(0, String.empty, String.empty)));

      const error = await Assert.throwsAsync(() => installer(runner).uninstallWindowsAsync(PackageInstallerTests.PRODUCT, folder), BuildException);

      Assert.isTrue(error.message.startsWith(`The uninstaller ${uninstaller} could not be removed after it ran: `), error.message);
      Assert.isDefined(error.cause);
    });
  }

  @TestMethod
  public async installsTheWindowsPackageWithTheWindowsPowerShellModulesFirst(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder) => {
      await PackageInstallerTests.writeAsync(path.join(folder, "_build", "package", "electron", "ffmpeg.dll"), "library");
      await PackageInstallerTests.writeAsync(path.join(folder, "_build", "package", "electron", "LICENSE"), "license");
      const runner = new ScriptedRunner(async () => {
        await PackageInstallerTests.writeAsync(path.join(installFolder, "Sample App.exe"), "app");
        await PackageInstallerTests.writeAsync(path.join(installFolder, "ffmpeg.dll"), "library");
        await PackageInstallerTests.writeAsync(path.join(installFolder, "bin", "sample-app.cmd"), "cmd");
        return new ProcessResult(0, String.empty, String.empty);
      });
      const installer = new PackageInstaller(folder, runner, { LOCALAPPDATA: path.dirname(path.dirname(installFolder)), systemroot: "C:\\Windows", psmodulepath: "D:\\Modules" });

      const installed = await installer.installAsync(new PackageTarget("windows", "x64"), PackageInstallerTests.PRODUCT, "1.2.3", folder);

      const program = path.join(installFolder, "Sample App.exe");
      Assert.areEqual(JSON.stringify(new InstalledPackage(program, program, path.join(installFolder, "resources"), path.join(installFolder, "bin", "sample-app.cmd"))),
        JSON.stringify(installed));
      Assert.areEqual("Sample App-1.2.3-windows-x64.exe /S", runner.calls.join("|"));
      Assert.areEqual("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules;D:\\Modules", runner.environment?.["PSModulePath"]);
      Assert.isUndefined(runner.environment?.["psmodulepath"]);
    });
  }

  @TestMethod
  public async installsAnAppThatNamesAFolderInItBesideANeighbourTheUninstallLeaves(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder) => {
      const product = PackageInstallerTests.foldered("Sample Makers");
      const makers = path.join(path.dirname(installFolder), "Sample Makers");
      const app = path.join(makers, "Sample App");
      const neighbour = path.join(makers, "Smoke Neighbour", "Smoke Neighbour.exe");
      const uninstaller = path.join(app, "Uninstall Sample App.exe");
      await PackageInstallerTests.writeAsync(path.join(folder, "_build", "package", "electron", "ffmpeg.dll"), "library");
      const installing = new ScriptedRunner(async () => {
        Assert.isTrue(existsSync(neighbour));
        for (const file of ["Sample App.exe", "ffmpeg.dll", path.join("bin", "sample-app.cmd"), "Uninstall Sample App.exe"])
          await PackageInstallerTests.writeAsync(path.join(app, file), file);
        return new ProcessResult(0, String.empty, String.empty);
      });
      const local = { LOCALAPPDATA: path.dirname(path.dirname(installFolder)), SystemRoot: "C:\\Windows" };

      const installed = await new PackageInstaller(folder, installing, local).installAsync(new PackageTarget("windows", "x64"), product, "1.2.3", folder);
      await new PackageInstaller(folder, new WindowsRunner(uninstaller, null), local).uninstallWindowsAsync(product, folder);

      Assert.areEqual(path.join(app, "Sample App.exe"), installed.program);
      Assert.isFalse(existsSync(makers));
    });
  }

  @TestMethod
  public async refusesAnUninstallThatRemovedTheNeighbourInItsFolder(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder) => {
      const product = PackageInstallerTests.foldered("Sample Makers");
      const makers = path.join(path.dirname(installFolder), "Sample Makers");
      const uninstaller = path.join(makers, "Sample App", "Uninstall Sample App.exe");
      await PackageInstallerTests.writeAsync(uninstaller, String.empty);
      const local = { LOCALAPPDATA: path.dirname(path.dirname(installFolder)), SystemRoot: "C:\\Windows" };

      const error = await Assert.throwsAsync(() => new PackageInstaller(folder, new WindowsRunner(uninstaller, null), local).uninstallWindowsAsync(product, folder),
        BuildException);

      Assert.areEqual(`Uninstalling the app removed ${path.join(makers, "Smoke Neighbour", "Smoke Neighbour.exe")}, which belongs to another app in its install folder.`,
        error.message);
    });
  }

  @TestMethod
  public async removesALeftoverNeighbourAndItsFolderOnlyWhenNoOtherAppIsThere(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder) => {
      const product = PackageInstallerTests.foldered("Sample Makers");
      const makers = path.join(path.dirname(installFolder), "Sample Makers");
      const other = path.join(makers, "Other App", "Other App.exe");
      const local = { LOCALAPPDATA: path.dirname(path.dirname(installFolder)), SystemRoot: "C:\\Windows" };
      const runner = new WindowsRunner(path.join(makers, "Sample App", "Uninstall Sample App.exe"), null);
      const remove = (): Promise<string | null> => new PackageInstaller(folder, runner, local).removeWindowsLeftoverAsync(product, folder, new UserPath(runner, folder));
      await PackageInstallerTests.writeAsync(path.join(makers, "Sample App", "Sample App.exe"), String.empty);
      await PackageInstallerTests.writeAsync(path.join(makers, "Smoke Neighbour", "Smoke Neighbour.exe"), String.empty);
      await PackageInstallerTests.writeAsync(other, String.empty);

      const shared = await remove();
      await rm(path.dirname(other), { recursive: true });
      await PackageInstallerTests.writeAsync(path.join(makers, "Smoke Neighbour", "Smoke Neighbour.exe"), String.empty);
      const alone = await remove();

      Assert.areEqual(`Removed what an earlier run left installed: ${path.join(makers, "Sample App")} and ${path.join(makers, "Smoke Neighbour")}.`, shared);
      Assert.areEqual(`Removed what an earlier run left installed: ${path.join(makers, "Smoke Neighbour")}.`, alone);
      Assert.isFalse(existsSync(makers));
    });
  }

  @TestMethod
  public async refusesAWindowsInstallWithoutAnElectronLibrary(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder, installer) => {
      await PackageInstallerTests.writeAsync(path.join(folder, "_build", "package", "electron", "ffmpeg.dll"), "library");
      const runner = new ScriptedRunner(async () => {
        await PackageInstallerTests.writeAsync(path.join(installFolder, "Sample App.exe"), "app");
        return new ProcessResult(0, String.empty, String.empty);
      });

      const error = await Assert.throwsAsync(() => installer(runner).installAsync(new PackageTarget("windows", "x64"), PackageInstallerTests.PRODUCT, "1.2.3", folder),
        BuildException);

      Assert.areEqual(`The installed package has no ${path.join(installFolder, "bin", "sample-app.cmd")}, ${path.join(installFolder, "ffmpeg.dll")}.`, error.message);
      Assert.areEqual("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules", runner.environment?.["PSModulePath"]);
    });
  }

  @TestMethod
  public async describesWhatAnInstallerThatTimedOutLeft(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder, installer) => {
      const timeout = new ProcessTimeoutException("Sample App-1.2.3-windows-x64.exe", 120000);
      const runner = new ScriptedRunner(async () => {
        await PackageInstallerTests.writeAsync(path.join(installFolder, "resources", "app.asar"), "asar");
        await PackageInstallerTests.writeAsync(path.join(installFolder, "Sample App.exe"), "app");
        throw timeout;
      });

      const error = await Assert.throwsAsync(() => installer(runner).installAsync(new PackageTarget("windows", "x64"), PackageInstallerTests.PRODUCT, "1.2.3", folder),
        BuildException);

      Assert.areEqual(`${timeout.message}\n${installFolder} held 2 files when the installer was stopped:\nSample App.exe: 3 bytes\n${path.join("resources", "app.asar")}: 4 bytes`,
        error.message);
      Assert.areEqual(timeout, error.cause);
    });
  }

  @TestMethod
  public async saysWhenAnInstallerThatTimedOutCreatedNothing(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder, installer) => {
      const timeout = new ProcessTimeoutException("Sample App-1.2.3-windows-x64.exe", 120000);
      const runner = new ScriptedRunner(() => Promise.reject(timeout));

      const error = await Assert.throwsAsync(() => installer(runner).installAsync(new PackageTarget("windows", "x64"), PackageInstallerTests.PRODUCT, "1.2.3", folder),
        BuildException);

      Assert.areEqual(`${timeout.message}\nThe installer had not created ${installFolder}.`, error.message);
    });
  }

  @TestMethod
  public async passesOnAnInstallerFailureThatIsNoTimeout(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, _installFolder, installer) => {
      const runner = new ScriptedRunner(() => Promise.resolve(new ProcessResult(2, String.empty, "The installer failed.")));

      const error = await Assert.throwsAsync(() => installer(runner).installAsync(new PackageTarget("windows", "arm64"), PackageInstallerTests.PRODUCT, "1.2.3", folder),
        BuildException);

      Assert.areEqual("Sample App-1.2.3-windows-arm64.exe /S failed with exit code 2:\nThe installer failed.", error.message);
    });
  }

  @TestMethod
  public async refusesAWindowsInstallWithoutTheWindowsOrUserFolder(): Promise<void> {
    const runner = new ScriptedRunner(() => Promise.resolve(new ProcessResult(0, String.empty, String.empty)));
    const target = new PackageTarget("windows", "x64");

    const system = await Assert.throwsAsync(() => new PackageInstaller(tmpdir(), runner, { LOCALAPPDATA: tmpdir(), SystemRoot: String.empty })
      .installAsync(target, PackageInstallerTests.PRODUCT, "1.2.3", tmpdir()), BuildException);
    const absent = await Assert.throwsAsync(() => new PackageInstaller(tmpdir(), runner, { LOCALAPPDATA: tmpdir() })
      .installAsync(target, PackageInstallerTests.PRODUCT, "1.2.3", tmpdir()), BuildException);
    const local = await Assert.throwsAsync(() => new PackageInstaller(tmpdir(), runner, { SystemRoot: "C:\\Windows" })
      .installAsync(target, PackageInstallerTests.PRODUCT, "1.2.3", tmpdir()), BuildException);

    Assert.areEqual("SystemRoot must name the Windows folder, whose PowerShell modules the installer's checks search first.", system.message);
    Assert.areEqual(system.message, absent.message);
    Assert.areEqual("LOCALAPPDATA must name the folder the installer installs into for the user.", local.message);
    Assert.areEqual(0, runner.calls.length);
  }

  @TestMethod
  public async copiesTheMacAppOutOfItsDiskImage(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async folder => {
      const application = path.join(folder, "Sample App.app");
      const runner = new ScriptedRunner(async command => {
        if (command === "ditto")
          await PackageInstallerTests.writeAsync(path.join(application, "Contents", "MacOS", "Sample App"), "app");
        return new ProcessResult(0, String.empty, String.empty);
      });
      const image = path.join(folder, "_build", "package", "out", "Sample App-1.2.3-macos-arm64.dmg");
      const mount = path.join(folder, "mount");

      const installed = await new PackageInstaller(folder, runner, {}).installAsync(new PackageTarget("macos", "arm64"), PackageInstallerTests.PRODUCT, "1.2.3", folder);

      const program = path.join(application, "Contents", "MacOS", "Sample App");
      Assert.areEqual(JSON.stringify(new InstalledPackage(program, program, path.join(application, "Contents", "Resources"), null)), JSON.stringify(installed));
      Assert.areEqual([`hdiutil attach ${image} -nobrowse -readonly -mountpoint ${mount}`, `ditto ${path.join(mount, "Sample App.app")} ${application}`,
        `hdiutil detach -force ${mount}`].join("|"), runner.calls.join("|"));
    });
  }

  @TestMethod
  public async runsTheMacAppFromThePayloadOfItsInstallerPackageOnceThePackageInstallsItInItsFolder(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async folder => {
      const expanded = path.join(folder, "expanded");
      const component = path.join(expanded, "Sample App.pkg");
      const runner = PackageInstallerTests.createExpandingRunner(component, "<pkg-info format-version=\"2\" install-location=\"/Applications/Sample &amp; Makers\" auth=\"root\"/>");
      const installer = path.join(folder, "_build", "package", "out", "Sample App-1.2.3-macos-arm64.pkg");

      const installed = await new PackageInstaller(folder, runner, {}).installAsync(new PackageTarget("macos", "arm64", true), PackageInstallerTests.foldered("Sample & Makers"),
        "1.2.3", folder);

      const application = path.join(component, "Payload", "Sample App.app");
      const program = path.join(application, "Contents", "MacOS", "Sample App");
      Assert.areEqual(JSON.stringify(new InstalledPackage(program, program, path.join(application, "Contents", "Resources"), null)), JSON.stringify(installed));
      Assert.areEqual(`pkgutil --expand-full ${installer} ${expanded}`, runner.calls.join("|"));
    });
  }

  @TestMethod
  public async refusesAnInstallerPackageThatInstallsOutsideTheFolder(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async folder => {
      const information = "<pkg-info format-version=\"2\" install-location=\"/Applications\" auth=\"root\"/>";
      const runner = PackageInstallerTests.createExpandingRunner(path.join(folder, "expanded", "Sample App.pkg"), information);

      const error = await Assert.throwsAsync(() => new PackageInstaller(folder, runner, {}).installAsync(new PackageTarget("macos", "arm64", true),
        PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder), BuildException);

      Assert.areEqual(`The installer package ${path.join(folder, "_build", "package", "out", "Sample App-1.2.3-macos-arm64.pkg")} installs elsewhere than `
        + `/Applications/Sample Makers:\n${information}`, error.message);
    });
  }

  @TestMethod
  public async detachesTheDiskImageAndPassesOnAFailedCopy(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async folder => {
      const runner = new ScriptedRunner(command => Promise.resolve(new ProcessResult(command === "ditto" ? 1 : 0, String.empty, "ditto: No space left on device")));

      const error = await Assert.throwsAsync(() => new PackageInstaller(folder, runner, {}).installAsync(new PackageTarget("macos", "x64"), PackageInstallerTests.PRODUCT, "1.2.3", folder),
        BuildException);

      Assert.isTrue(error.message.startsWith("ditto "), error.message);
      Assert.areEqual(`hdiutil detach -force ${path.join(folder, "mount")}`, runner.calls.at(-1));
    });
  }

  @TestMethod
  public async reportsBothFailuresWhenTheDiskImageCannotBeDetachedAfterAFailedCopy(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async folder => {
      const runner = new ScriptedRunner((command, commandArguments) => Promise.resolve(new ProcessResult(command === "ditto" || commandArguments[0] === "detach" ? 1 : 0,
        String.empty, `${command} failed`)));

      const error = await Assert.throwsAsync(() => new PackageInstaller(folder, runner, {}).installAsync(new PackageTarget("macos", "x64"), PackageInstallerTests.PRODUCT, "1.2.3", folder),
        BuildException);

      Assert.isTrue(error.message.includes("ditto failed"), error.message);
      Assert.isTrue(error.message.includes("\nDetaching the disk image after the failed copy failed too: "), error.message);
      Assert.isTrue(error.message.endsWith("hdiutil failed"), error.message);
      Assert.isInstanceOf(error.cause, BuildException);
    });
  }

  @TestMethod
  public async refusesAMacDiskImageWithoutTheApp(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async folder => {
      const runner = new ScriptedRunner(() => Promise.resolve(new ProcessResult(0, String.empty, String.empty)));

      const error = await Assert.throwsAsync(() => new PackageInstaller(folder, runner, {}).installAsync(new PackageTarget("macos", "arm64"), PackageInstallerTests.PRODUCT, "1.2.3", folder),
        BuildException);

      Assert.areEqual(`The installed package has no ${path.join(folder, "Sample App.app", "Contents", "MacOS", "Sample App")}.`, error.message);
    });
  }

  @TestMethod
  public async extractsTheLinuxAppImageAfterMakingItExecutable(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async folder => {
      const image = path.join(folder, "_build", "package", "out", "Sample App-1.2.3-linux-x64.AppImage");
      await PackageInstallerTests.writeAsync(image, "image");
      const extracted = path.join(folder, "squashfs-root");
      const runner = new ScriptedRunner(async () => {
        await PackageInstallerTests.writeAsync(path.join(extracted, "sample-app"), "app");
        return new ProcessResult(0, String.empty, String.empty);
      });

      const installed = await new PackageInstaller(folder, runner, {}).installAsync(new PackageTarget("linux", "x64"), PackageInstallerTests.PRODUCT, "1.2.3", folder);

      Assert.areEqual(JSON.stringify(new InstalledPackage(image, path.join(extracted, "sample-app"), path.join(extracted, "resources"), null)), JSON.stringify(installed));
      Assert.areEqual("Sample App-1.2.3-linux-x64.AppImage --appimage-extract", runner.calls.join("|"));
    });
  }

  private static async writeAsync(file: string, text: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }

  private static async withFolderAsync(run: (folder: string, installFolder: string, installer: (runner: ProcessRunner) => PackageInstaller) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-build-installer-"));
    try {
      const local = path.join(folder, "local");
      await run(folder, path.join(local, "Programs", PackageInstallerTests.PRODUCT.slug),
        runner => new PackageInstaller(folder, runner, { LOCALAPPDATA: local, SystemRoot: "C:\\Windows" }));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static foldered(installFolder: string): ProductIdentity {
    return new ProductIdentity("Sample App", "Sample", "sample-app", "com.example.sample", "com.example.sample.development", ".sample/app", ["Sample/App", "Sample/App", "sample/app"],
      "SAMPLE_APP_DATA_DIR", "assets/icons", "example/sample-app", undefined, null, null, undefined, null, installFolder);
  }

  private static createExpandingRunner(component: string, information: string): ScriptedRunner {
    return new ScriptedRunner(async command => {
      if (command === "pkgutil") {
        await PackageInstallerTests.writeAsync(path.join(component, "Payload", "Sample App.app", "Contents", "MacOS", "Sample App"), "app");
        await PackageInstallerTests.writeAsync(path.join(component, "PackageInfo"), information);
      }
      return new ProcessResult(0, String.empty, String.empty);
    });
  }
}
