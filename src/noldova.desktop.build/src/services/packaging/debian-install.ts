/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { InstalledPackage } from "../../models/packaging/installed-package.ts";
import type { ProcessResult } from "../../models/processes/process-result.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { Resources } from "../../resources.ts";

export class DebianInstall {
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

  public static async installAsync(runner: ProcessRunner, file: string, slug: string, folder: string): Promise<DebianInstall> {
    const field = await runner.captureAsync(Resources.dpkgDebCommand, [Resources.dpkgDebFieldOption, file, Resources.debianPackageField], folder, Resources.smokeCommandLimit);
    const packageName = field.output.trim();
    if (!field.isSuccessful || packageName.length === 0)
      throw new BuildException(Resources.formatDebianPackageUnnamed(file, field.exitCode, field.text));
    await DebianInstall.prepareDependenciesAsync(runner, file, packageName, folder);
    await runner.requireAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, Resources.aptGetCommand, ...Resources.aptGetInstallArguments, file], folder,
      Resources.installerTimeout);
    const command = path.posix.join(Resources.linuxCommandFolder, slug);
    const link = await runner.captureAsync(Resources.readlinkCommand, [Resources.readlinkCanonicalOption, command], folder, Resources.smokeCommandLimit);
    const program = link.output.trim();
    if (!link.isSuccessful || program.length === 0) {
      await runner.captureAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, Resources.aptGetCommand, ...Resources.aptGetRemoveArguments, packageName], folder,
        Resources.installerTimeout);
      throw new BuildException(Resources.formatDebianCommandUnresolved(command, link.exitCode, link.text));
    }
    return new DebianInstall(runner, folder, slug, packageName, program);
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
    return [await this.verifySandboxHelperAsync(), await this.verifyProfileAsync()].join(Resources.lineSeparator);
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

  private runAsRootAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    return this.runAsync(Resources.sudoCommand, [Resources.sudoNonInteractiveOption, command, ...commandArguments]);
  }

  private runAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    return this.runner.captureAsync(command, commandArguments, this.folder, Resources.smokeCommandLimit);
  }
}
