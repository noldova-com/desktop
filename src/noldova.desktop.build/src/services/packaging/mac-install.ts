/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { ISystemInstall } from "../../interfaces/i-system-install.ts";
import { InstalledPackage } from "../../models/packaging/installed-package.ts";
import type { ProductIdentity } from "../../models/packages/product-identity.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { Resources } from "../../resources.ts";

export class MacInstall implements ISystemInstall {
  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly file: string;
  private readonly application: string;
  private readonly neighbour: string;

  public readonly packageName: string;
  public readonly installed: InstalledPackage;

  private constructor(runner: ProcessRunner, folder: string, file: string, application: string, neighbour: string, packageName: string, installed: InstalledPackage) {
    this.runner = runner;
    this.folder = folder;
    this.file = file;
    this.application = application;
    this.neighbour = neighbour;
    this.packageName = packageName;
    this.installed = installed;
  }

  public static async installAsync(runner: ProcessRunner, file: string, product: ProductIdentity, folder: string): Promise<MacInstall> {
    if (Object.isNull(product.installFolder))
      throw new BuildException(Resources.smokeMacInstallerNotFoldered);
    const location = Resources.formatMacInstallLocation(product.installFolder);
    const neighbour = path.posix.join(location, Resources.smokeNeighbourBundle);
    const application = path.posix.join(location, `${product.name}${Resources.appBundleExtension}`);
    if (!(await runner.captureAsync(Resources.testCommand, [Resources.testMissingOption, Resources.testExistsOption, application], folder, Resources.smokeCommandLimit)).isSuccessful)
      throw new BuildException(Resources.formatMacAlreadyInstalled(application));
    const receipts = (await runner.captureAsync(Resources.pkgutilCommand, [Resources.pkgutilPackagesOption], folder, Resources.smokeCommandLimit)).output.split(Resources.lineSeparator);
    if (receipts.some(t => t.trim() === product.applicationId))
      throw new BuildException(Resources.formatMacAlreadyInstalled(product.applicationId));
    await MacInstall.runAsRootAsync(runner, folder, [Resources.mkdirCommand, Resources.mkdirParentsOption, neighbour]);
    const program = path.posix.join(application, ...Resources.macBundleProgramSegments, product.name);
    try {
      await MacInstall.runAsRootAsync(runner, folder, [Resources.macInstallerCommand, Resources.macInstallerPackageOption, file, Resources.macInstallerTargetOption,
        Resources.macInstallerRootTarget]);
      if (!await MacInstall.existsAsync(runner, folder, program))
        throw new BuildException(Resources.formatInstalledFilesMissing([program]));
    }
    catch (error) {
      throw await MacInstall.removeAfterAsync(runner, folder, [application, neighbour, product.applicationId], error);
    }
    return new MacInstall(runner, folder, file, application, neighbour, product.applicationId,
      new InstalledPackage(program, program, path.posix.join(application, ...Resources.macBundleResourcesSegments), null));
  }

  public async verifyAsync(): Promise<string> {
    if (!await MacInstall.existsAsync(this.runner, this.folder, this.neighbour))
      throw new BuildException(Resources.formatMacNeighbourTouched(this.neighbour));
    return Resources.formatMacInstalled(this.file, this.application, this.neighbour);
  }

  public async removeAsync(): Promise<string> {
    await MacInstall.runAsRootAsync(this.runner, this.folder, [Resources.removeCommand, Resources.removeRecursiveOption, this.application, this.neighbour]);
    await MacInstall.runAsRootAsync(this.runner, this.folder, [Resources.pkgutilCommand, Resources.pkgutilForgetOption, this.packageName]);
    return Resources.formatMacRemoved(this.application, this.neighbour);
  }

  private static async removeAfterAsync(runner: ProcessRunner, folder: string, [application, neighbour, packageName]: readonly [string, string, string], failure: unknown):
    Promise<unknown> {
    try {
      for (const commandLine of [[Resources.removeCommand, Resources.removeRecursiveOption, application, neighbour], [Resources.pkgutilCommand, Resources.pkgutilForgetOption, packageName]])
        await runner.captureAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, ...commandLine], folder, Resources.installerTimeout);
      return failure;
    }
    catch (error) {
      return new BuildException(Resources.formatSystemInstallNotUndone(failure instanceof Error ? failure.message : String(failure), error instanceof Error ? error.message : String(error)),
        new ExceptionOptions(failure));
    }
  }

  private static async existsAsync(runner: ProcessRunner, folder: string, file: string): Promise<boolean> {
    return (await runner.captureAsync(Resources.testCommand, [Resources.testExistsOption, file], folder, Resources.smokeCommandLimit)).isSuccessful;
  }

  private static runAsRootAsync(runner: ProcessRunner, folder: string, commandLine: readonly string[]): Promise<void> {
    return runner.requireAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, ...commandLine], folder, Resources.installerTimeout);
  }
}
