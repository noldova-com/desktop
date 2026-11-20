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
import type { ProcessResult } from "../../models/processes/process-result.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { Resources } from "../../resources.ts";

export class DebianInstall implements ISystemInstall {
  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly slug: string;

  public readonly packageName: string;
  public readonly installed: InstalledPackage;

  private constructor(runner: ProcessRunner, folder: string, slug: string, packageName: string, program: string) {
    this.runner = runner;
    this.folder = folder;
    this.slug = slug;
    this.packageName = packageName;
    this.installed = new InstalledPackage(program, program, path.posix.join(path.posix.dirname(program), Resources.packagedResourcesFolder), null);
  }

  private get installFolder(): string {
    return path.posix.dirname(this.installed.program);
  }

  private get profile(): string {
    return path.posix.join(Resources.apparmorProfilesFolder, this.slug);
  }

  public static async installAsync(runner: ProcessRunner, file: string, slug: string, installFolder: string | null, folder: string): Promise<DebianInstall> {
    const field = await runner.captureAsync(Resources.dpkgDebCommand, [Resources.dpkgDebFieldOption, file, Resources.debianPackageField], folder, Resources.smokeCommandLimit);
    const packageName = field.output.trim();
    if (!field.isSuccessful || packageName.length === 0)
      throw new BuildException(Resources.formatDebianPackageUnnamed(file, field.exitCode, field.text));
    const status = (await runner.captureAsync(Resources.dpkgQueryCommand, [...Resources.dpkgQueryStatusArguments, packageName], folder, Resources.smokeCommandLimit)).output.trim();
    if (status.length > 0 && status !== Resources.debianNotInstalledStatus)
      throw new BuildException(Resources.formatDebianAlreadyInstalled(packageName, status));
    await DebianInstall.prepareDependenciesAsync(runner, file, packageName, folder);
    try {
      await runner.requireAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, Resources.aptGetCommand, ...Resources.aptGetInstallArguments, file], folder,
        Resources.installerTimeout);
    }
    catch (error) {
      throw await DebianInstall.removeAfterAsync(runner, packageName, folder, error);
    }
    const command = path.posix.join(Resources.linuxCommandFolder, slug);
    const link = await runner.captureAsync(Resources.readlinkCommand, [Resources.readlinkCanonicalOption, command], folder, Resources.smokeCommandLimit);
    const target = link.output.trim();
    if (!link.isSuccessful || target.length === 0)
      throw await DebianInstall.removeAfterAsync(runner, packageName, folder, new BuildException(Resources.formatDebianCommandUnresolved(command, link.exitCode, link.text)));
    const resources = path.posix.dirname(path.posix.dirname(target));
    if (!target.endsWith(`${path.posix.sep}${path.posix.join(Resources.packagedResourcesFolder, Resources.formatPackagedCommandPath(slug))}`))
      throw await DebianInstall.removeAfterAsync(runner, packageName, folder, new BuildException(Resources.formatDebianCommandNotCommandLine(command, target)));
    const program = path.posix.join(path.posix.dirname(resources), slug);
    const expected = Object.isNull(installFolder) ? Resources.debianInstallPrefix : Resources.formatDebianInstallFolder(installFolder);
    if (!path.posix.dirname(path.posix.dirname(program)).endsWith(expected))
      throw await DebianInstall.removeAfterAsync(runner, packageName, folder, new BuildException(Resources.formatDebianInstalledElsewhere(program, expected)));
    return new DebianInstall(runner, folder, slug, packageName, program);
  }

  private static async removeAfterAsync(runner: ProcessRunner, packageName: string, folder: string, failure: unknown): Promise<unknown> {
    try {
      await runner.captureAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, Resources.aptGetCommand, ...Resources.aptGetRemoveArguments, packageName], folder,
        Resources.installerTimeout);
      return failure;
    }
    catch (error) {
      return new BuildException(Resources.formatSystemInstallNotUndone(failure instanceof Error ? failure.message : String(failure), error instanceof Error ? error.message : String(error)),
        new ExceptionOptions(failure));
    }
  }

  private static async prepareDependenciesAsync(runner: ProcessRunner, file: string, packageName: string, folder: string): Promise<void> {
    const simulation = await runner.captureAsync(Resources.aptGetCommand, [...Resources.aptGetSimulateArguments, file], folder, Resources.smokeCommandLimit);
    const missing = simulation.output.split(Resources.lineSeparator).filter(t => t.startsWith(Resources.aptGetInstalledPrefix))
      .map(t => t.slice(Resources.aptGetInstalledPrefix.length).replace(Resources.aptGetInstalledDetails, String.empty)).filter(t => t !== packageName);
    if (simulation.isSuccessful && missing.length === 0)
      return;
    const update = await runner.captureAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, Resources.aptGetCommand, ...Resources.aptGetUpdateArguments], folder,
      Resources.installerTimeout);
    if (!update.isSuccessful)
      throw new BuildException(Resources.formatDebianDependenciesMissing(file, missing, simulation.text, update.exitCode, update.text));
  }

  public async verifyAsync(): Promise<string> {
    return [await this.verifySandboxHelperAsync(), await this.verifyProfileAsync(), await this.verifyPackageTypeAsync()].join(Resources.lineSeparator);
  }

  public async removeAsync(): Promise<string> {
    await this.runner.requireAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, Resources.aptGetCommand, ...Resources.aptGetRemoveArguments, this.packageName],
      this.folder, Resources.installerTimeout);
    const left: string[] = [];
    for (const item of [this.installFolder, this.profile])
      if (!(await this.runAsync(Resources.testCommand, [Resources.testMissingOption, Resources.testExistsOption, item])).isSuccessful)
        left.push(item);
    if (left.length > 0)
      throw new BuildException(Resources.formatDebianRemovalLeft(this.packageName, left));
    return Resources.formatDebianRemoved(this.packageName, this.installFolder, this.profile);
  }

  private async verifySandboxHelperAsync(): Promise<string> {
    const helper = path.posix.join(this.installFolder, Resources.chromeSandboxFile);
    const probe = await this.runAsRootAsync(Resources.bashCommand, [Resources.bashCommandOption, Resources.debianNamespaceProbe]);
    const canCreate = probe.isSuccessful;
    const expected = Resources.formatOwnerAndMode(Resources.rootUserId, canCreate ? Resources.sandboxHelperPlainMode : Resources.sandboxHelperSetuidMode);
    const status = await this.runAsync(Resources.statCommand, [Resources.statOwnerAndModeOption, helper]);
    const actual = status.output.trim();
    if (!status.isSuccessful || actual !== expected)
      throw new BuildException(Resources.formatDebianSandboxHelperWrong(helper, status.isSuccessful ? actual : status.text, expected, canCreate));
    return Resources.formatDebianSandboxHelperChecked(helper, expected, canCreate);
  }

  private async verifyProfileAsync(): Promise<string> {
    const source = path.posix.join(this.installed.resources, Resources.apparmorProfileFile);
    const isEnabled = (await this.runAsRootAsync(Resources.apparmorStatusCommand, [Resources.apparmorEnabledOption])).isSuccessful;
    const isSupported = isEnabled && (await this.runAsRootAsync(Resources.apparmorParserCommand, [...Resources.apparmorDryRunOptions, source])).isSuccessful;
    if (!isSupported) {
      if (!(await this.runAsync(Resources.testCommand, [Resources.testMissingOption, Resources.testExistsOption, this.profile])).isSuccessful)
        throw new BuildException(Resources.formatDebianProfileUnexpected(this.profile, isEnabled));
      return Resources.formatDebianProfileSkipped(this.profile, isEnabled);
    }
    if (!(await this.runAsync(Resources.cmpCommand, [Resources.cmpSilentOption, source, this.profile])).isSuccessful)
      throw new BuildException(Resources.formatDebianProfileNotCopied(this.profile, source));
    const loaded = await this.runAsRootAsync(Resources.grepCommand, [...Resources.grepWholeLineOptions, Resources.formatLoadedProfile(this.slug), Resources.apparmorLoadedProfiles]);
    if (!loaded.isSuccessful)
      throw new BuildException(Resources.formatDebianProfileNotLoaded(this.slug, Resources.apparmorLoadedProfiles));
    return Resources.formatDebianProfileInstalled(this.profile);
  }

  private async verifyPackageTypeAsync(): Promise<string> {
    const file = path.posix.join(this.installed.resources, Resources.packageTypeFile);
    if (!(await this.runAsync(Resources.grepCommand, [...Resources.grepWholeLineOptions, Resources.debianPackageTarget, file])).isSuccessful)
      throw new BuildException(Resources.formatDebianPackageTypeMissing(file));
    return Resources.formatDebianPackageTypeChecked(file);
  }

  private runAsRootAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    return this.runAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, command, ...commandArguments]);
  }

  private runAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    return this.runner.captureAsync(command, commandArguments, this.folder, Resources.smokeCommandLimit);
  }
}
