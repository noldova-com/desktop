/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, rmdir, writeFile } from "node:fs/promises";
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
import { Resources } from "../../../src/resources.js";
import { PackageInstaller } from "../../../src/services/packaging/package-installer.js";
import { UserPath } from "../../../src/services/packaging/user-path.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { FolderFixture } from "../../fixtures/folder.fixture.js";

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

  public override async captureAsync(command: string, commandArguments: readonly string[], _directory: string, _timeout: number, _environment?: NodeJS.ProcessEnv,
    isVerbatim: boolean = false): Promise<ProcessResult> {
    this.calls.push([path.basename(command), ...commandArguments, ...isVerbatim ? ["(verbatim)"] : []].join(" "));
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

class MovingRunner extends ProcessRunner {
  private readonly programs: string;
  private location: string | null;

  public readonly calls: string[] = [];
  public readonly shortcut: string;
  public shortcutVariable: string | undefined;
  public isOldProgramWritten: boolean;
  public isOldKept: boolean;
  public isNeighbourRemoved: boolean;
  public isShortcutWritten: boolean;
  public shortcutAnswer: ProcessResult | null;
  public isFolderKept: boolean;
  public isCopyHeld: boolean;
  public waitedUninstaller: string | undefined;

  public constructor(programs: string, appData: string) {
    super();
    this.programs = programs;
    this.location = null;
    this.shortcut = path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Sample Makers", "Sample App.lnk");
    this.shortcutVariable = undefined;
    this.isOldProgramWritten = true;
    this.isOldKept = false;
    this.isNeighbourRemoved = false;
    this.isShortcutWritten = true;
    this.shortcutAnswer = null;
    this.isFolderKept = false;
    this.isCopyHeld = false;
    this.waitedUninstaller = undefined;
  }

  public get app(): string {
    return path.join(this.programs, "Sample Makers", "Sample App");
  }

  public get old(): string {
    return path.join(this.programs, "sample-app");
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], _directory: string, _timeout: number, environment?: NodeJS.ProcessEnv,
    isVerbatim: boolean = false): Promise<ProcessResult> {
    this.calls.push([path.basename(command), ...commandArguments, ...isVerbatim ? ["(verbatim)"] : []].join(" "));
    const placed = commandArguments.find(t => t.startsWith("/D="))?.slice("/D=".length);
    const uninstalled = commandArguments.find(t => t.startsWith("_?="))?.slice("_?=".length);
    const waited = environment?.["NOLDOVA_DESKTOP_UNINSTALLER"];
    const held = environment?.["NOLDOVA_DESKTOP_LEFT_FILES"];
    if (path.basename(command) === "powershell.exe" && !Object.isUndefined(waited)) {
      this.waitedUninstaller = waited;
      await this.uninstallAsync(waited, environment?.["NOLDOVA_DESKTOP_UNINSTALL_FOLDER"] ?? String.empty);
      if (this.isCopyHeld) {
        await rm(waited);
        await mkdir(path.join(waited, "held"), { recursive: true });
      }
      return new ProcessResult(0, String.empty, String.empty);
    }
    if (path.basename(command) === "powershell.exe" && !Object.isUndefined(held))
      return new ProcessResult(0, `${held}: MsMpEng.exe (4321).\r\n`, String.empty);
    if (path.basename(command) === "powershell.exe") {
      this.shortcutVariable = environment?.["NOLDOVA_DESKTOP_SHORTCUT"];
      return this.shortcutAnswer ?? new ProcessResult(0, `${path.join(this.app, "Sample App.exe").toUpperCase()}\r\n`, String.empty);
    }
    if (!Object.isUndefined(placed))
      await this.installAsync(placed, this.isOldProgramWritten);
    else if (Object.isUndefined(uninstalled))
      await this.updateAsync();
    else
      await this.uninstallAsync(command, uninstalled);
    return new ProcessResult(0, String.empty, String.empty);
  }

  private async installAsync(folder: string, isProgramWritten: boolean): Promise<void> {
    for (const file of [...isProgramWritten ? ["Sample App.exe"] : [], "ffmpeg.dll", path.join("bin", "sample-app.cmd"), "Uninstall Sample App.exe"]) {
      await FolderFixture.ensureAsync(path.dirname(path.join(folder, file)));
      await writeFile(path.join(folder, file), file);
    }
    this.location = folder;
  }

  private async updateAsync(): Promise<void> {
    if (this.location === this.old && !this.isOldKept)
      await rm(this.old, { recursive: true });
    if (this.isNeighbourRemoved)
      await rm(path.join(this.programs, "Sample Makers", "Smoke Neighbour"), { recursive: true });
    await this.installAsync(this.app, true);
    if (this.isShortcutWritten) {
      await FolderFixture.ensureAsync(path.dirname(this.shortcut));
      await writeFile(this.shortcut, "shortcut");
    }
  }

  private async uninstallAsync(command: string, folder: string): Promise<void> {
    const isCopy = path.dirname(command) !== folder;
    for (const entry of await readdir(folder))
      if (isCopy || path.join(folder, entry) !== command)
        await rm(path.join(folder, entry), { recursive: true });
    if (!isCopy)
      return;
    await rmdir(folder);
    if (!this.isFolderKept)
      await rmdir(path.dirname(folder));
  }
}

@TestClass
export class PackageInstallerTests {
  private static readonly WINDOWS: PackageTarget = new PackageTarget("windows", "x64");
  private static readonly SYSTEM_ONLY: string = "    <domains enable_anywhere=\"false\" enable_currentUserHome=\"false\" enable_localSystem=\"true\" />\n";
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
      Assert.areEqual(`Uninstall Sample App.exe /S _?=${installFolder} (verbatim)`, runner.calls.find(t => t.startsWith("Uninstall")));
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

      const error = await Assert.throwsAsync(() => installer(runner).uninstallWindowsAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.PRODUCT, "1.2.3", folder), BuildException);

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

      const error = await Assert.throwsAsync(() => installer(runner).uninstallWindowsAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.PRODUCT, "1.2.3", folder), BuildException);

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

      const error = await Assert.throwsAsync(() => installer(runner).uninstallWindowsAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.PRODUCT, "1.2.3", folder), BuildException);

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
  public async movesAnInstallFromTheOldDefaultFolderBesideANeighbourAndUninstallsTheEmptiedFolder(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner, installer) => {
      const makers = path.dirname(runner.app);

      const installed = await installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder);
      const isNeighbourThere = existsSync(path.join(makers, "Smoke Neighbour", "Smoke Neighbour.exe"));
      await installer.uninstallWindowsAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder);

      Assert.areEqual(path.join(runner.app, "Sample App.exe"), installed.program);
      Assert.isTrue(isNeighbourThere);
      Assert.areEqual(runner.shortcut, runner.shortcutVariable);
      Assert.areEqual(JSON.stringify([`Sample App-1.2.3-windows-x64.exe /S /D=${runner.old} (verbatim)`, "Sample App-1.2.3-windows-x64.exe /S", runner.calls[2],
        `Uninstall Sample App.exe /S _?=${runner.app} (verbatim)`, "Sample App-1.2.3-windows-x64.exe /S", runner.calls[5]]),
        JSON.stringify(runner.calls));
      Assert.isTrue((runner.calls[2] ?? String.empty).startsWith("powershell.exe -NoProfile -NonInteractive -EncodedCommand "));
      const script = Buffer.from((runner.calls[2] ?? String.empty).split(" ").at(-1) ?? String.empty, "base64").toString("utf16le");
      Assert.isTrue(script.endsWith("\n(Microsoft.PowerShell.Utility\\New-Object -ComObject WScript.Shell).CreateShortcut($env:NOLDOVA_DESKTOP_SHORTCUT).TargetPath"), script);
      Assert.isTrue((runner.calls[5] ?? String.empty).startsWith("powershell.exe -NoProfile -NonInteractive -EncodedCommand "));
      const wait = Buffer.from((runner.calls[5] ?? String.empty).split(" ").at(-1) ?? String.empty, "base64").toString("utf16le");
      Assert.isTrue(wait.endsWith("\n$uninstall = Microsoft.PowerShell.Management\\Start-Process -FilePath $env:NOLDOVA_DESKTOP_UNINSTALLER "
        + "-ArgumentList @('/S', \"_?=$env:NOLDOVA_DESKTOP_UNINSTALL_FOLDER\") -Wait -PassThru\nexit $uninstall.ExitCode"), wait);
      Assert.areEqual(path.join(folder, "Uninstall Sample App.exe"), runner.waitedUninstaller);
      Assert.isFalse(existsSync(path.join(folder, "Uninstall Sample App.exe")));
      Assert.isFalse(existsSync(runner.old));
      Assert.isFalse(existsSync(makers));
    });
  }

  @TestMethod
  public async refusesAnInstallPlacedInTheOldDefaultFolderWithoutItsProgram(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner, installer) => {
      runner.isOldProgramWritten = false;

      const error = await Assert.throwsAsync(() => installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder),
        BuildException);

      Assert.areEqual(`The installed package has no ${path.join(runner.old, "Sample App.exe")}.`, error.message);
      Assert.areEqual(1, runner.calls.length);
    });
  }

  @TestMethod
  public async refusesAnUpdateThatLeftTheInstallInTheOldDefaultFolder(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner, installer) => {
      runner.isOldKept = true;

      const error = await Assert.throwsAsync(() => installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder),
        BuildException);

      Assert.areEqual(`The update left the old install in ${runner.old}, which it should have moved into the app's install folder.`, error.message);
    });
  }

  @TestMethod
  public async refusesAMoveThatRemovedTheNeighbourInItsFolder(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner, installer) => {
      runner.isNeighbourRemoved = true;

      const error = await Assert.throwsAsync(() => installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder),
        BuildException);

      Assert.areEqual(`Moving the app into its install folder removed ${path.join(path.dirname(runner.app), "Smoke Neighbour", "Smoke Neighbour.exe")}, which belongs to another `
        + "app there.", error.message);
    });
  }

  @TestMethod
  public async refusesAMoveWithoutAStartMenuShortcutInItsFolder(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner, installer) => {
      runner.isShortcutWritten = false;

      const error = await Assert.throwsAsync(() => installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder),
        BuildException);

      Assert.areEqual(`The installed package has no ${runner.shortcut}.`, error.message);
    });
  }

  @TestMethod
  public async refusesAMoveWhoseShortcutStillStartsTheOldProgram(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner, installer) => {
      runner.shortcutAnswer = new ProcessResult(0, `${path.join(runner.old, "Sample App.exe")}\r\n`, String.empty);

      const error = await Assert.throwsAsync(() => installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder),
        BuildException);

      Assert.areEqual(`${runner.shortcut} starts "${path.join(runner.old, "Sample App.exe")}", not ${path.join(runner.app, "Sample App.exe")}.`, error.message);
    });
  }

  @TestMethod
  public async saysWhenTheMovedShortcutCannotBeRead(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner, installer) => {
      runner.shortcutAnswer = new ProcessResult(1, String.empty, "The shortcut is damaged.");

      const error = await Assert.throwsAsync(() => installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder),
        BuildException);

      Assert.areEqual(`${runner.shortcut} could not be read: powershell.exe exited with 1:\nThe shortcut is damaged.`, error.message);
    });
  }

  @TestMethod
  public async refusesAMoveWithoutTheUsersStartMenuFolder(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner) => {
      const installer = new PackageInstaller(folder, runner, { LOCALAPPDATA: path.dirname(path.dirname(runner.old)), SystemRoot: "C:\\Windows" });

      const error = await Assert.throwsAsync(() => installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder),
        BuildException);

      Assert.areEqual("APPDATA must name the folder that holds the user's Start menu.", error.message);
    });
  }

  @TestMethod
  public async namesWhatStillHoldsTheCopiedUninstallerOnceItAndItsProcessesExited(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner, installer) => {
      runner.isCopyHeld = true;
      const copy = path.join(folder, "Uninstall Sample App.exe");
      await installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder);

      const error = await Assert.throwsAsync(() => installer.uninstallWindowsAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder),
        BuildException);

      Assert.isTrue(error.message.startsWith(`The copy of the uninstaller ${copy} could not be removed after it and every process it started had exited: `), error.message);
      Assert.isTrue(error.message.endsWith(`\nWhat holds them now:\n${copy}: MsMpEng.exe (4321).`), error.message);
      Assert.isDefined(error.cause);
    });
  }

  @TestMethod
  public async refusesAnUninstallThatLeavesTheInstallFolder(): Promise<void> {
    await PackageInstallerTests.withMovingAsync(async (folder, runner, installer) => {
      runner.isFolderKept = true;
      await installer.installAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder);

      const error = await Assert.throwsAsync(() => installer.uninstallWindowsAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder),
        BuildException);

      Assert.areEqual(`Uninstalling the app left its install folder ${path.dirname(runner.app)}.`, error.message);
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

      const error = await Assert.throwsAsync(() => new PackageInstaller(folder, new WindowsRunner(uninstaller, null), local)
        .uninstallWindowsAsync(PackageInstallerTests.WINDOWS, product, "1.2.3", folder), BuildException);

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
      const runner = new WindowsRunner(path.join(makers, "Sample App", "Uninstall Sample App.exe"), { type: "REG_EXPAND_SZ", value: `${path.join(installFolder, "bin")};C:\\other` });
      const remove = (): Promise<string | null> => new PackageInstaller(folder, runner, local).removeWindowsLeftoverAsync(product, folder, new UserPath(runner, folder));
      await PackageInstallerTests.writeAsync(path.join(installFolder, "Sample App.exe"), String.empty);
      await PackageInstallerTests.writeAsync(path.join(makers, "Sample App", "Sample App.exe"), String.empty);
      await PackageInstallerTests.writeAsync(path.join(makers, "Smoke Neighbour", "Smoke Neighbour.exe"), String.empty);
      await PackageInstallerTests.writeAsync(other, String.empty);

      const shared = await remove();
      await rm(path.dirname(other), { recursive: true });
      await PackageInstallerTests.writeAsync(path.join(makers, "Smoke Neighbour", "Smoke Neighbour.exe"), String.empty);
      const alone = await remove();

      Assert.areEqual(`Removed what an earlier run left installed: ${installFolder} and ${path.join(makers, "Sample App")} and ${path.join(makers, "Smoke Neighbour")} and `
        + `${path.join(installFolder, "bin")} on the user's Path.`, shared);
      Assert.isFalse(existsSync(installFolder));
      Assert.areEqual("C:\\other", runner.registry?.value);
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
  public async reinstallsOverTheInstallAndReturnsWhatTheInstallerAnsweredWithoutCheckingIt(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async folder => {
      const runner = new ScriptedRunner(() => Promise.resolve(new ProcessResult(2, String.empty, "Sample App cannot be closed.")));
      const installer = new PackageInstaller(folder, runner, { SystemRoot: "C:\\Windows", PSModulePath: "D:\\Modules" });

      const result = await installer.reinstallWindowsAsync(PackageInstallerTests.WINDOWS, PackageInstallerTests.PRODUCT, "1.2.3", folder);

      Assert.areEqual(2, result.exitCode);
      Assert.areEqual("Sample App cannot be closed.", result.text);
      Assert.areEqual("Sample App-1.2.3-windows-x64.exe /S", runner.calls.join("|"));
      Assert.areEqual("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules;D:\\Modules", runner.environment?.["PSModulePath"]);
    });
  }

  @TestMethod
  public async startsTheProgramAsTheNamedUserThroughWindowsPowerShell(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async folder => {
      const program = path.join(folder, "Programs", "sample-app", "Sample App.exe");
      const runner = new ScriptedRunner(() => Promise.resolve(new ProcessResult(0, "5150\r\n", String.empty)));
      const installer = new PackageInstaller(folder, runner, { SystemRoot: "C:\\Windows", NOLDOVA_SMOKE_OTHER_USER: "noldova-smoke" });

      const result = await installer.startForOtherUserAsync(program, folder);

      const command = Buffer.from(Resources.otherUserStartScript, "utf16le").toString("base64");
      Assert.areEqual("5150", result.text);
      Assert.areEqual(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${command}`, runner.calls.join("|"));
      Assert.areEqual(program, runner.environment?.["NOLDOVA_SMOKE_OTHER_PROGRAM"]);
      Assert.areEqual(path.dirname(program), runner.environment?.["NOLDOVA_SMOKE_OTHER_FOLDER"]);
      Assert.areEqual("noldova-smoke", runner.environment?.["NOLDOVA_SMOKE_OTHER_USER"]);
      Assert.areEqual("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules", runner.environment?.["PSModulePath"]);
      Assert.isTrue(Resources.otherUserStartScript.includes("$hold = 'set ELECTRON_RUN_AS_NODE=1&& \"' + $env:NOLDOVA_SMOKE_OTHER_PROGRAM + '\" -e \"setTimeout(() => undefined, 600000)\"'\n"));
      Assert.isTrue(Resources.otherUserStartScript.includes("Start-Process -FilePath cmd.exe -ArgumentList '/c', $hold -WorkingDirectory $env:NOLDOVA_SMOKE_OTHER_FOLDER "
        + "-RedirectStandardOutput other-user-output.log -RedirectStandardError other-user-errors.log -Credential $credential -LoadUserProfile -PassThru\n"));
      Assert.isTrue(Resources.otherUserStartScript.includes("Where-Object { $before -notcontains $_.Id })\n  if ($held.Count -gt 0) { break }\n"));
      Assert.isTrue(Resources.otherUserStartScript.includes("if ($shell.HasExited) { throw \"cmd.exe exited with $($shell.ExitCode) before the app started.\" }"));
      Assert.isTrue(Resources.otherUserStartScript.includes("AddMilliseconds(30000)"));
      Assert.isTrue(Resources.otherUserStartScript.endsWith("\n$held[0].Id"));
      Assert.isFalse(Resources.otherUserStartScript.includes("Write-"));
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

      Assert.areEqual(`${timeout.message}\n${installFolder} held 2 files when the installer was stopped:\nSample App.exe: 3 bytes\n${path.join("resources", "app.asar")}: 4 bytes\n`
        + `${path.join(folder, "temporary")} held no temporary folder the installer had made.`, error.message);
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

      Assert.areEqual(`${timeout.message}\nThe installer had not created ${installFolder}.\n${path.join(folder, "temporary")} held no temporary folder the installer had made.`,
        error.message);
    });
  }

  @TestMethod
  public async looksForTheStoppedInstallersTemporaryFolderInTmpThenTemp(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder) => {
      const local = path.dirname(path.dirname(installFolder));
      const runner = new ScriptedRunner(() => Promise.reject(new ProcessTimeoutException("Sample App-1.2.3-windows-x64.exe", 120000)));
      const install = (environment: NodeJS.ProcessEnv): Promise<BuildException> => Assert.throwsAsync(
        () => new PackageInstaller(folder, runner, { LOCALAPPDATA: local, SystemRoot: "C:\\Windows", ...environment })
          .installAsync(new PackageTarget("windows", "x64"), PackageInstallerTests.PRODUCT, "1.2.3", folder), BuildException);

      const temp = await install({ TEMP: path.join(folder, "temp") });
      const neither = await install({});

      Assert.isTrue(temp.message.endsWith(`\n${path.join(folder, "temp")} held no temporary folder the installer had made.`), temp.message);
      Assert.isTrue(neither.message.endsWith("\nThe installer's temporary folder is unknown: neither TMP nor TEMP is set."), neither.message);
    });
  }

  @TestMethod
  public async listsWhatAStoppedInstallerStartedByItsProcessId(): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, _installFolder, installer) => {
      const runner = new ScriptedRunner(command => path.basename(command) === "powershell.exe" ? Promise.resolve(new ProcessResult(0, String.empty, String.empty))
        : Promise.reject(new ProcessTimeoutException(command, 120000, null, 4242)));

      const error = await Assert.throwsAsync(() => installer(runner).installAsync(new PackageTarget("windows", "x64"), PackageInstallerTests.PRODUCT, "1.2.3", folder),
        BuildException);

      Assert.isTrue(error.message.endsWith("\nNothing the installer, process 4242, had started was still running after it was stopped."), error.message);
      Assert.areEqual("4242", runner.environment?.["NOLDOVA_DESKTOP_INSTALLER_PROCESS"]);
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

    Assert.areEqual("SystemRoot must name the Windows folder, whose PowerShell modules the smoke's PowerShell checks search first.", system.message);
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
  public async refusesAnInstallerPackageThatOffersAnyDestinationButTheStartupDisk(): Promise<void> {
    const cases: readonly (readonly [string, string, string])[] = [
      ["home folder", "    <domains enable_anywhere=\"false\" enable_currentUserHome=\"true\" enable_localSystem=\"true\" />\n",
        "it has <domains enable_anywhere=\"false\" enable_currentUserHome=\"true\" enable_localSystem=\"true\" />"],
      ["any volume", "    <domains enable_anywhere=\"true\" enable_currentUserHome=\"false\" enable_localSystem=\"true\" />\n",
        "it has <domains enable_anywhere=\"true\" enable_currentUserHome=\"false\" enable_localSystem=\"true\" />"],
      ["no startup disk", "    <domains enable_anywhere=\"false\" enable_currentUserHome=\"false\" enable_localSystem=\"false\" />\n",
        "it has <domains enable_anywhere=\"false\" enable_currentUserHome=\"false\" enable_localSystem=\"false\" />"],
      ["a choice left out", "    <domains enable_anywhere=\"false\" enable_localSystem=\"true\" />\n",
        "it has <domains enable_anywhere=\"false\" enable_localSystem=\"true\" />"],
      ["no domains", String.empty, "it has no <domains> element"],
      ["two domains", `${PackageInstallerTests.SYSTEM_ONLY}${PackageInstallerTests.SYSTEM_ONLY}`,
        "it has <domains enable_anywhere=\"false\" enable_currentUserHome=\"false\" enable_localSystem=\"true\" /> and "
        + "<domains enable_anywhere=\"false\" enable_currentUserHome=\"false\" enable_localSystem=\"true\" />"]
    ];

    for (const [name, domains, found] of cases)
      await PackageInstallerTests.withFolderAsync(async folder => {
        const information = "<pkg-info format-version=\"2\" install-location=\"/Applications/Sample Makers\" auth=\"root\"/>";
        const runner = PackageInstallerTests.createExpandingRunner(path.join(folder, "expanded", "Sample App.pkg"), information, domains);

        const error = await Assert.throwsAsync(() => new PackageInstaller(folder, runner, {}).installAsync(new PackageTarget("macos", "arm64", true),
          PackageInstallerTests.foldered("Sample Makers"), "1.2.3", folder), BuildException);

        Assert.areEqual(`The installer package ${path.join(folder, "_build", "package", "out", "Sample App-1.2.3-macos-arm64.pkg")} must install only into `
          + "/Applications/Sample Makers on the startup disk, with one <domains enable_anywhere=\"false\" enable_currentUserHome=\"false\" enable_localSystem=\"true\"/> "
          + `in its Distribution, but ${found}.`, error.message, name);
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
    await FolderFixture.ensureAsync(path.dirname(file));
    await writeFile(file, text);
  }

  private static async withFolderAsync(run: (folder: string, installFolder: string, installer: (runner: ProcessRunner) => PackageInstaller) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-build-installer-"));
    try {
      const local = path.join(folder, "local");
      await run(folder, path.join(local, "Programs", PackageInstallerTests.PRODUCT.slug),
        runner => new PackageInstaller(folder, runner, { LOCALAPPDATA: local, SystemRoot: "C:\\Windows", TMP: path.join(folder, "temporary") }));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async withMovingAsync(run: (folder: string, runner: MovingRunner, installer: PackageInstaller) => Promise<void>): Promise<void> {
    await PackageInstallerTests.withFolderAsync(async (folder, installFolder) => {
      await PackageInstallerTests.writeAsync(path.join(folder, "_build", "package", "electron", "ffmpeg.dll"), "library");
      const runner = new MovingRunner(path.dirname(installFolder), path.join(folder, "roaming"));
      await run(folder, runner, new PackageInstaller(folder, runner, { LOCALAPPDATA: path.dirname(path.dirname(installFolder)), APPDATA: path.join(folder, "roaming"),
        SystemRoot: "C:\\Windows" }));
    });
  }

  private static foldered(installFolder: string): ProductIdentity {
    return new ProductIdentity("Sample App", "Sample", "sample-app", "com.example.sample", "com.example.sample.development", ".sample/app", ["Sample/App", "Sample/App", "sample/app"],
      "SAMPLE_APP_DATA_DIR", "assets/icons", "example/sample-app", undefined, null, null, undefined, null, installFolder);
  }

  private static createExpandingRunner(component: string, information: string, domains: string = PackageInstallerTests.SYSTEM_ONLY): ScriptedRunner {
    return new ScriptedRunner(async command => {
      if (command === "pkgutil") {
        await PackageInstallerTests.writeAsync(path.join(component, "Payload", "Sample App.app", "Contents", "MacOS", "Sample App"), "app");
        await PackageInstallerTests.writeAsync(path.join(component, "PackageInfo"), information);
        await PackageInstallerTests.writeAsync(path.join(path.dirname(component), "Distribution"),
          `<?xml version="1.0" encoding="utf-8"?>\n<installer-gui-script minSpecVersion="2">\n    <pkg-ref id="com.example.sample"/>\n${domains}</installer-gui-script>\n`);
      }
      return new ProcessResult(0, String.empty, String.empty);
    });
  }
}
