/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { chmod, readdir, rm, rmdir, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import type { ProductIdentity } from "../../models/packages/product-identity.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { ProcessTimeoutException } from "../../exceptions/process-timeout.exception.ts";
import { FileHolders } from "./file-holders.ts";
import { InstalledPackage } from "../../models/packaging/installed-package.ts";
import { PackageLayout } from "./package-layout.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import type { UserPath } from "./user-path.ts";
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

  public async installAsync(target: PackageTarget, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    const output = new PackageLayout(this.root).output;
    const locate = (extension: string): string => path.join(output, target.formatFileName(product.name, extension));
    switch (target.platform) {
      case Resources.windowsTarget:
        return this.installWindowsAsync(locate(Resources.installerTarget), product, folder);
      case Resources.macosTarget:
        return this.copyFromDiskImageAsync(locate(Resources.diskImageTarget), product, folder);
      default:
        return this.unpackAppImageAsync(locate(Resources.appImageTarget), product, folder);
    }
  }

  public async uninstallWindowsAsync(product: ProductIdentity, folder: string): Promise<void> {
    const installFolder = this.locateWindowsFolder(product);
    const uninstaller = this.locateUninstaller(product);
    const environment = this.createInstallerEnvironment();
    await this.runner.requireAsync(uninstaller, [...Resources.silentInstallArguments, `${Resources.uninstallerInPlaceOption}${installFolder}`], folder,
      Resources.installerTimeout, environment);
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

  public async removeWindowsLeftoverAsync(product: ProductIdentity, folder: string, userPath: UserPath): Promise<string | null> {
    const installFolder = this.locateWindowsFolder(product);
    const removed: string[] = [];
    if (existsSync(installFolder)) {
      if (existsSync(this.locateUninstaller(product)))
        await this.uninstallWindowsAsync(product, folder);
      else
        await rm(installFolder, { recursive: true, maxRetries: Resources.removeRetries, retryDelay: Resources.removeRetryDelay });
      removed.push(installFolder);
    }
    const entry = path.join(installFolder, Resources.commandFolder);
    if (await userPath.removeAsync(entry))
      removed.push(Resources.formatUserPathEntry(entry));
    return removed.length === 0 ? null : Resources.formatLeftoverRemoved(removed);
  }

  private static async describeAsync(installFolder: string): Promise<string> {
    if (!existsSync(installFolder))
      return Resources.formatInstallerCreatedNothing(installFolder);
    const files = (await readdir(installFolder, { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile())
      .map(t => path.join(t.parentPath, t.name))
      .sort();
    const lines: string[] = [];
    for (const file of files)
      lines.push(Resources.formatInstalledFileSize(path.relative(installFolder, file), (await stat(file)).size));
    return Resources.formatInstallerStoppedFiles(installFolder, files.length, lines);
  }

  private static requireFiles(files: readonly string[]): void {
    const missing = files.filter(t => !existsSync(t));
    if (missing.length > 0)
      throw new BuildException(Resources.formatInstalledFilesMissing(missing));
  }

  private static isNamed(variable: string, name: string): boolean {
    return variable.toUpperCase() === name.toUpperCase();
  }

  private findVariable(name: string): string | undefined {
    return Object.entries(this.environment).find(([variable]) => PackageInstaller.isNamed(variable, name))?.[1];
  }

  private createInstallerEnvironment(): NodeJS.ProcessEnv {
    const systemRoot = this.findVariable(Resources.systemRootVariable) ?? String.empty;
    if (systemRoot.length === 0)
      throw new BuildException(Resources.systemRootMissing);
    const modules = [path.win32.join(systemRoot, ...Resources.windowsPowershellModulesSegments), this.findVariable(Resources.powershellModulePathVariable) ?? String.empty]
      .filter(t => t.length > 0)
      .join(path.win32.delimiter);
    const others = Object.entries(this.environment).filter(([variable]) => !PackageInstaller.isNamed(variable, Resources.powershellModulePathVariable));
    return { ...Object.fromEntries(others), [Resources.powershellModulePathVariable]: modules };
  }

  private locateWindowsFolder(product: ProductIdentity): string {
    const localAppData = this.environment[Resources.localAppDataVariable] ?? String.empty;
    if (localAppData.length === 0)
      throw new BuildException(Resources.localAppDataMissing);
    return path.join(localAppData, Resources.windowsProgramsFolder, product.slug);
  }

  private locateUninstaller(product: ProductIdentity): string {
    return path.join(this.locateWindowsFolder(product), `${Resources.uninstallerPrefix}${product.name}${Resources.windowsProgramExtension}`);
  }

  private async installWindowsAsync(installer: string, product: ProductIdentity, folder: string): Promise<InstalledPackage> {
    const installFolder = this.locateWindowsFolder(product);
    const environment = this.createInstallerEnvironment();
    try {
      await this.runner.requireAsync(installer, Resources.silentInstallArguments, folder, Resources.installerTimeout, environment);
    }
    catch (error) {
      if (!(error instanceof ProcessTimeoutException))
        throw error;
      throw new BuildException(Resources.formatInstallerTimedOut(error.message, await PackageInstaller.describeAsync(installFolder)), new ExceptionOptions(error));
    }
    const program = path.join(installFolder, `${product.name}${Resources.windowsProgramExtension}`);
    const libraries = (await readdir(new PackageLayout(this.root).electron))
      .filter(t => path.extname(t).toLowerCase() === Resources.windowsLibraryExtension)
      .map(t => path.join(installFolder, t));
    const command = path.join(installFolder, Resources.commandFolder, `${product.slug}${Resources.windowsCommandExtension}`);
    PackageInstaller.requireFiles([program, command, ...libraries]);
    return new InstalledPackage(program, program, path.join(path.dirname(program), Resources.packagedResourcesFolder), command);
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
