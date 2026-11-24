/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { chmod, copyFile, readFile, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import type { ProductIdentity } from "../../models/packages/product-identity.ts";
import type { ProcessResult } from "../../models/processes/process-result.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { AppleSignatureCheck } from "./apple-signature-check.ts";
import { ProcessTimeoutException } from "../../exceptions/process-timeout.exception.ts";
import { FileHolders } from "./file-holders.ts";
import { InstalledPackage } from "../../models/packaging/installed-package.ts";
import { PackageLayout } from "./package-layout.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { StoppedInstaller } from "./stopped-installer.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import type { UserPath } from "./user-path.ts";
import { FolderCreation } from "../files/folder-creation.ts";
import { Resources } from "../../resources.ts";

export class PackageInstaller {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.root = root;
    this.runner = runner;
    this.environment = environment;
  }

  public async installAsync(target: PackageTarget, product: ProductIdentity, version: string, folder: string): Promise<InstalledPackage> {
    const locate = (extension: string): string => this.locatePackage(target, product, version, extension);
    switch (target.platform) {
      case Resources.windowsTarget:
        return this.installWindowsAsync(locate(Resources.installerTarget), product, folder);
      case Resources.macosTarget:
        return Object.isNull(product.installFolder)
          ? this.copyFromDiskImageAsync(locate(Resources.diskImageTarget), product, folder)
          : this.expandInstallerAsync(locate(Resources.macInstallerTarget), product, product.installFolder, folder);
      default:
        return this.unpackAppImageAsync(locate(Resources.appImageTarget), product, folder);
    }
  }

  public reinstallWindowsAsync(target: PackageTarget, product: ProductIdentity, version: string, folder: string): Promise<ProcessResult> {
    return this.runner.captureAsync(this.locatePackage(target, product, version, Resources.installerTarget), Resources.silentInstallArguments, folder,
      Resources.installerTimeout, this.createInstallerEnvironment());
  }

  public startForOtherUserAsync(program: string, folder: string): Promise<ProcessResult> {
    const command = Buffer.from(Resources.otherUserStartScript, Resources.powershellScriptEncoding).toString(Resources.powershellCommandEncoding);
    const environment = this.createInstallerEnvironment();
    environment[Resources.smokeOtherProgramVariable] = program;
    environment[Resources.smokeOtherFolderVariable] = path.dirname(program);
    return this.runner.captureAsync(Resources.windowsPowershellCommand, [...Resources.powershellOptions, command], folder, Resources.smokeOtherUserCommandLimit, environment);
  }

  public async uninstallWindowsAsync(target: PackageTarget, product: ProductIdentity, version: string, folder: string): Promise<void> {
    const installFolder = this.locateWindowsFolder(product);
    await this.uninstallInPlaceAsync(installFolder, product, folder);
    const neighbour = this.locateWindowsNeighbour(product);
    if (Object.isNull(neighbour))
      return;
    if (!existsSync(neighbour))
      throw new BuildException(Resources.formatWindowsNeighbourRemoved(neighbour));
    await rm(path.dirname(neighbour), { recursive: true });
    const environment = this.createInstallerEnvironment();
    await this.runInstallerAsync(this.locatePackage(target, product, version, Resources.installerTarget), Resources.silentInstallArguments, installFolder, folder, environment);
    const uninstaller = path.join(folder, path.basename(PackageInstaller.locateUninstaller(installFolder, product)));
    await copyFile(PackageInstaller.locateUninstaller(installFolder, product), uninstaller);
    const command = Buffer.from(Resources.uninstallWaitScript, Resources.powershellScriptEncoding).toString(Resources.powershellCommandEncoding);
    await this.runner.requireAsync(Resources.windowsPowershellCommand, [...Resources.powershellOptions, command], folder, Resources.installerTimeout,
      { ...environment, [Resources.uninstallerVariable]: uninstaller, [Resources.uninstallFolderVariable]: installFolder });
    try {
      await rm(uninstaller);
    }
    catch (error) {
      throw new BuildException(Resources.formatCopiedUninstallerHeld(uninstaller, error, await new FileHolders(this.runner, folder, environment).describeAsync([uninstaller])),
        new ExceptionOptions(error));
    }
    if (existsSync(path.dirname(installFolder)))
      throw new BuildException(Resources.formatInstallFolderKept(path.dirname(installFolder)));
  }

  public async removeWindowsLeftoverAsync(product: ProductIdentity, folder: string, userPath: UserPath): Promise<string | null> {
    const installFolder = this.locateWindowsFolder(product);
    const removed: string[] = [];
    const installFolders = Object.isNull(product.installFolder) ? [installFolder] : [this.locateWindowsDefaultFolder(product), installFolder];
    for (const installed of installFolders.filter(t => existsSync(t))) {
      if (existsSync(PackageInstaller.locateUninstaller(installed, product)))
        await this.uninstallInPlaceAsync(installed, product, folder);
      else
        await rm(installed, { recursive: true, maxRetries: Resources.removeRetries, retryDelay: Resources.removeRetryDelay });
      removed.push(installed);
    }
    const neighbour = this.locateWindowsNeighbour(product);
    if (!Object.isNull(neighbour) && existsSync(path.dirname(neighbour))) {
      await rm(path.dirname(neighbour), { recursive: true });
      removed.push(path.dirname(neighbour));
      if ((await readdir(path.dirname(path.dirname(neighbour)))).length === 0)
        await rmdir(path.dirname(path.dirname(neighbour)));
    }
    for (const entry of installFolders.map(t => path.join(t, Resources.commandFolder)))
      if (await userPath.removeAsync(entry))
        removed.push(Resources.formatUserPathEntry(entry));
    return removed.length === 0 ? null : Resources.formatLeftoverRemoved(removed);
  }

  private static requireFiles(files: readonly string[]): void {
    const missing = files.filter(t => !existsSync(t));
    if (missing.length > 0)
      throw new BuildException(Resources.formatInstalledFilesMissing(missing));
  }

  private static isNamed(variable: string, name: string): boolean {
    return variable.toUpperCase() === name.toUpperCase();
  }

  public async canDebugAsync(folder: string): Promise<boolean> {
    const program = path.win32.join(this.locateSystemRoot(), ...Resources.whoamiSegments);
    const privileges = await this.runner.captureAsync(program, Resources.whoamiPrivilegesArguments, folder, Resources.smokeCommandLimit);
    if (!privileges.isSuccessful)
      throw new BuildException(Resources.formatSmokeDebugPrivilegeUnread(privileges.exitCode, privileges.text));
    return privileges.output.split(Resources.lineSeparator).some(t => t.trim() === Resources.debugPrivilegeEnabledLine);
  }

  private locateSystemRoot(): string {
    const systemRoot = this.findVariable(Resources.systemRootVariable) ?? String.empty;
    if (systemRoot.length === 0)
      throw new BuildException(Resources.systemRootMissing);
    return systemRoot;
  }

  private findVariable(name: string): string | undefined {
    const variable = Object.keys(this.environment).find(t => PackageInstaller.isNamed(t, name));
    return Object.isUndefined(variable) ? undefined : this.environment[variable];
  }

  private createInstallerEnvironment(): NodeJS.ProcessEnv {
    const modules = [path.win32.join(this.locateSystemRoot(), ...Resources.windowsPowershellModulesSegments), this.findVariable(Resources.powershellModulePathVariable) ?? String.empty]
      .filter(t => t.length > 0)
      .join(path.win32.delimiter);
    const environment: NodeJS.ProcessEnv = {};
    for (const variable of Object.keys(this.environment).filter(t => !PackageInstaller.isNamed(t, Resources.powershellModulePathVariable)))
      environment[variable] = this.environment[variable];
    environment[Resources.powershellModulePathVariable] = modules;
    return environment;
  }

  private locatePackage(target: PackageTarget, product: ProductIdentity, version: string, extension: string): string {
    return path.join(new PackageLayout(this.root).output, target.formatFileName(product.name, version, extension));
  }

  private locateWindowsPrograms(): string {
    const localAppData = this.environment[Resources.localAppDataVariable] ?? String.empty;
    if (localAppData.length === 0)
      throw new BuildException(Resources.localAppDataMissing);
    return path.join(localAppData, Resources.windowsProgramsFolder);
  }

  private locateWindowsDefaultFolder(product: ProductIdentity): string {
    return path.join(this.locateWindowsPrograms(), product.slug);
  }

  private locateWindowsFolder(product: ProductIdentity): string {
    return Object.isNull(product.installFolder) ? this.locateWindowsDefaultFolder(product) : path.join(this.locateWindowsPrograms(), product.installFolder, product.name);
  }

  private locateWindowsNeighbour(product: ProductIdentity): string | null {
    return Object.isNull(product.installFolder) ? null : this.locateNeighbourIn(product.installFolder);
  }

  private locateNeighbourIn(menuFolder: string): string {
    return path.join(this.locateWindowsPrograms(), menuFolder, Resources.smokeNeighbourName, `${Resources.smokeNeighbourName}${Resources.windowsProgramExtension}`);
  }

  private static locateUninstaller(installFolder: string, product: ProductIdentity): string {
    return path.join(installFolder, `${Resources.uninstallerPrefix}${product.name}${Resources.windowsProgramExtension}`);
  }

  private async uninstallInPlaceAsync(installFolder: string, product: ProductIdentity, folder: string): Promise<void> {
    const uninstaller = PackageInstaller.locateUninstaller(installFolder, product);
    const environment = this.createInstallerEnvironment();
    await this.runner.requireAsync(uninstaller, [...Resources.silentInstallArguments, `${Resources.uninstallerInPlaceOption}${installFolder}`], folder,
      Resources.installerTimeout, environment, true);
    try {
      await rm(uninstaller, { maxRetries: Resources.removeRetries, retryDelay: Resources.removeRetryDelay });
    }
    catch (error) {
      throw new BuildException(Resources.formatUninstallerNotRemoved(uninstaller, error), new ExceptionOptions(error));
    }
    const left = await readdir(installFolder, { recursive: true, withFileTypes: true });
    if (left.length > 0) {
      const files = left.filter(t => t.isFile()).map(t => path.join(t.parentPath, t.name)).sort();
      const names = left.map(t => path.relative(installFolder, path.join(t.parentPath, t.name))).sort();
      const holders = files.length === 0 ? null : await new FileHolders(this.runner, folder, environment).describeAsync(files);
      throw new BuildException(Resources.formatUninstallerLeft(names, installFolder, holders));
    }
    await rmdir(installFolder);
  }

  private async installWindowsAsync(installer: string, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    const installFolder = this.locateWindowsFolder(product);
    const environment = this.createInstallerEnvironment();
    const menuFolder = product.installFolder;
    if (!Object.isNull(menuFolder)) {
      const neighbour = this.locateNeighbourIn(menuFolder);
      const moved = this.locateWindowsDefaultFolder(product);
      await FolderCreation.createAsync(path.dirname(neighbour));
      await writeFile(neighbour, String.empty);
      await this.runInstallerAsync(installer, [...Resources.silentInstallArguments, `${Resources.installFolderOption}${moved}`], moved, folder, environment, true);
      PackageInstaller.requireFiles([path.join(moved, `${product.name}${Resources.windowsProgramExtension}`)]);
    }
    await this.runInstallerAsync(installer, Resources.silentInstallArguments, installFolder, folder, environment);
    const program = path.join(installFolder, `${product.name}${Resources.windowsProgramExtension}`);
    const libraries = (await readdir(new PackageLayout(this.root).electron))
      .filter(t => path.extname(t).toLowerCase() === Resources.windowsLibraryExtension)
      .map(t => path.join(installFolder, t));
    const command = path.join(installFolder, Resources.commandFolder, `${product.slug}${Resources.windowsCommandExtension}`);
    PackageInstaller.requireFiles([program, command, ...libraries]);
    if (!Object.isNull(menuFolder))
      await this.requireMovedAsync(menuFolder, product, program, folder, environment);
    return new InstalledPackage(program, program, path.join(path.dirname(program), Resources.packagedResourcesFolder), command);
  }

  private async runInstallerAsync(installer: string, commandArguments: readonly string[], installFolder: string, folder: string, environment: NodeJS.ProcessEnv,
    isVerbatim: boolean = false): Promise<void> {
    const started = Date.now();
    try {
      await this.runner.requireAsync(installer, commandArguments, folder, Resources.installerTimeout, environment, isVerbatim);
    }
    catch (error) {
      if (!(error instanceof ProcessTimeoutException))
        throw error;
      const temporary = this.findVariable(Resources.installerTemporaryVariable) ?? this.findVariable(Resources.installerTemporaryFallbackVariable);
      const description = await new StoppedInstaller(this.runner, folder, environment).describeAsync(installFolder, temporary, started, error.processId);
      throw new BuildException(Resources.formatInstallerTimedOut(error.message, description), new ExceptionOptions(error));
    }
  }

  private async requireMovedAsync(menuFolder: string, product: ProductIdentity, program: string, folder: string, environment: NodeJS.ProcessEnv): Promise<void> {
    const moved = this.locateWindowsDefaultFolder(product);
    const neighbour = this.locateNeighbourIn(menuFolder);
    if (existsSync(moved))
      throw new BuildException(Resources.formatWindowsOldInstallKept(moved));
    if (!existsSync(neighbour))
      throw new BuildException(Resources.formatWindowsNeighbourMoved(neighbour));
    const appData = this.environment[Resources.appDataVariable] ?? String.empty;
    if (appData.length === 0)
      throw new BuildException(Resources.appDataMissing);
    const shortcut = path.join(appData, ...Resources.startMenuProgramsSegments, menuFolder, `${product.name}${Resources.shortcutExtension}`);
    PackageInstaller.requireFiles([shortcut]);
    const command = Buffer.from(Resources.shortcutScript, Resources.powershellScriptEncoding).toString(Resources.powershellCommandEncoding);
    const result = await this.runner.captureAsync(Resources.windowsPowershellCommand, [...Resources.powershellOptions, command], folder, Resources.shortcutTimeout,
      { ...environment, [Resources.shortcutVariable]: shortcut });
    if (!result.isSuccessful)
      throw new BuildException(Resources.formatShortcutReadFailed(shortcut, result.exitCode, result.text));
    const target = result.output.trim();
    if (!PackageInstaller.isNamed(target, program))
      throw new BuildException(Resources.formatShortcutElsewhere(shortcut, target, program));
  }

  private async copyFromDiskImageAsync(image: string, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    const mount = path.join(folder, Resources.installerMountFolder);
    const bundle = `${product.name}${Resources.appBundleExtension}`;
    const application = path.join(folder, bundle);
    await this.requireAsync(Resources.hdiutilCommand, [Resources.hdiutilAttachArgument, image, ...Resources.installerAttachOptions, mount], folder);
    try {
      await this.requireAsync(Resources.dittoCommand, [path.join(mount, bundle), application], folder);
    }
    catch (error) {
      try {
        await this.requireAsync(Resources.hdiutilCommand, [...Resources.hdiutilDetachArguments, mount], folder);
      }
      catch (detachError) {
        throw new BuildException(Resources.formatDetachAfterCopyFailed(error, detachError), new ExceptionOptions(error));
      }
      throw error;
    }
    await this.requireAsync(Resources.hdiutilCommand, [...Resources.hdiutilDetachArguments, mount], folder);
    const program = path.join(application, ...Resources.macBundleProgramSegments, product.name);
    PackageInstaller.requireFiles([program]);
    return new InstalledPackage(program, program, path.join(application, ...Resources.macBundleResourcesSegments), null);
  }

  private async expandInstallerAsync(installer: string, product: ProductIdentity, installFolder: string, folder: string): Promise<InstalledPackage> {
    const expanded = path.join(folder, Resources.installerExpandedFolder);
    await this.requireAsync(Resources.pkgutilCommand, [Resources.pkgutilExpandFullOption, installer, expanded], folder);
    const application = await AppleSignatureCheck.locateExpandedAppAsync(expanded, product.name);
    const information = await readFile(path.join(application, ...Resources.installerPackageInfoFromApp), Resources.textEncoding);
    const location = Resources.formatMacInstallLocation(installFolder);
    if (!information.includes(Resources.formatInstallLocationAttribute(location)))
      throw new BuildException(Resources.formatMacInstallerElsewhere(installer, location, information));
    const domains = [...(await readFile(path.join(expanded, Resources.installerDistributionFile), Resources.textEncoding)).matchAll(Resources.installerDomainsPattern)]
      .map(t => t[0]);
    const [domain = String.empty] = domains;
    const choices = new Map<string | undefined, string | undefined>();
    for (const attribute of domain.matchAll(Resources.xmlAttributePattern))
      choices.set(attribute[1], attribute[2]);
    if (domains.length !== 1 || [...Resources.macInstallerDomains.keys()].some(t => choices.get(t) !== Resources.macInstallerDomains.get(t)))
      throw new BuildException(Resources.formatMacInstallerDomainsOpen(installer, location, domains));
    const program = path.join(application, ...Resources.macBundleProgramSegments, product.name);
    PackageInstaller.requireFiles([program]);
    return new InstalledPackage(program, program, path.join(application, ...Resources.macBundleResourcesSegments), null);
  }

  private async unpackAppImageAsync(file: string, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    await chmod(file, Resources.executableMode);
    await this.requireAsync(file, Resources.appImageExtractArguments, folder);
    const extracted = path.join(folder, Resources.appImageExtractedFolder);
    const program = path.join(extracted, product.slug);
    PackageInstaller.requireFiles([program]);
    return new InstalledPackage(file, program, path.join(extracted, Resources.packagedResourcesFolder), null);
  }

  private requireAsync(command: string, commandArguments: readonly string[], folder: string): Promise<void> {
    return this.runner.requireAsync(command, commandArguments, folder, Resources.installerTimeout);
  }
}
