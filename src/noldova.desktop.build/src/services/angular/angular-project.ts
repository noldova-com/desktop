/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, statSync } from "node:fs";
import { glob, lstat, readdir, readFile, rm, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { BuildLayout } from "../packages/build-layout.ts";
import { ContentHash } from "../packages/content-hash.ts";
import { InstalledPackages } from "../packages/installed-packages.ts";
import { PackageManifest } from "../../models/packages/package-manifest.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { AboutLogo } from "./about-logo.ts";
import { PackageNaming } from "../packages/package-naming.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { RetriedDownload } from "../processes/retried-download.ts";
import type { NpmCommand } from "../toolchain/npm-command.ts";
import { InstalledCopies } from "./installed-copies.ts";
import { Resources } from "../../resources.ts";

export class AngularProject {
  private readonly layout: BuildLayout;
  private readonly runner: ProcessRunner;
  private readonly npm: NpmCommand;

  public readonly root: string;

  public constructor(root: string, runner: ProcessRunner, npm: NpmCommand) {
    this.root = root;
    this.layout = new BuildLayout(root);
    this.runner = runner;
    this.npm = npm;
  }

  public async installAsync(output: Writable): Promise<void> {
    if (!this.hasProject()) {
      output.write(Resources.angularNoProject);
      return;
    }

    if (await this.needsInstallAsync()) {
      output.write(Resources.angularInstalling);
      const result = await this.npm.runAsync(Resources.angularInstallArguments, this.root);
      if (!result.isSuccessful)
        throw new BuildException(Resources.formatAngularInstallFailed(result.exitCode, result.errorOutput));
      await writeFile(path.join(this.root, Resources.angularInstallRecord), await this.describeInstallAsync(), Resources.textEncoding);
    }

    await this.requireSingleCopyAsync();
    if (!await this.hasTestTargetAsync()) {
      output.write(Resources.angularNoBrowser);
      return;
    }
    output.write(Resources.angularInstallingBrowser);
    await RetriedDownload.runAsync(Resources.angularBrowserSubject, output, async () => {
      const result = await this.runner.captureAsync(process.execPath, [path.join(this.root, Resources.playwrightCli), ...Resources.angularBrowserArguments], this.root, Resources.downloadAttemptTimeout);
      return result.isSuccessful ? null : Resources.formatExitCodeProblem(result.exitCode, result.errorOutput);
    });
  }

  public async prepareAsync(output: Writable): Promise<void> {
    if (!this.hasProject()) {
      output.write(Resources.angularNoProject);
      return;
    }
    if (await this.needsInstallAsync())
      throw new BuildException(Resources.angularNotInstalled);
    await this.removeOwnPackagesAsync();
    await rm(path.join(this.root, Resources.angularDependencyCache), { recursive: true, force: true });
  }

  public async buildAsync(output: Writable, outputPath: string | null): Promise<void> {
    if (Object.isNull(this.app) || !this.hasProject())
      return;

    output.write(Resources.angularBuilding);
    const outputArguments = Object.isNull(outputPath) ? [] : [Resources.angularOutputPathOption, outputPath];
    const exitCode = await this.runner.runAsync(
      process.execPath,
      [path.join(this.root, Resources.angularCli), ...Resources.angularBuildArguments, ...outputArguments],
      this.app);
    if (exitCode !== 0)
      throw new BuildException(Resources.formatWindowBuildFailed(exitCode));
    await AboutLogo.of(this.root, await ProductIdentity.readAsync(this.root))?.copyAsync(outputPath ?? path.join(this.root, ...Resources.windowOutputSegments));
  }

  public async verifyWithoutAsync(outputPath: string | null, texts: readonly string[]): Promise<void> {
    if (!this.hasProject())
      return;

    const folder = outputPath ?? path.join(this.root, ...Resources.windowOutputSegments);
    const shown = path.relative(this.root, folder).split(path.sep).join(path.posix.sep);
    let scanned = 0;
    for await (const file of glob(Resources.allFilesPattern, { cwd: folder })) {
      if (!AngularProject.isFile(path.join(folder, file)))
        continue;
      scanned++;
      const content = await readFile(path.join(folder, file), Resources.textEncoding);
      const found = texts.find(t => content.includes(t));
      if (!Object.isUndefined(found))
        throw new BuildException(Resources.formatWindowContainsText(shown, found, file));
    }
    if (scanned === 0)
      throw new BuildException(Resources.formatWindowHasNoFiles(shown));
  }

  public hasProject(): boolean {
    return !Object.isNull(this.app) && existsSync(path.join(this.app, Resources.angularWorkspaceFile));
  }

  private async readJsonAsync<T>(file: string, read: (reader: JsonReader) => T): Promise<T> {
    try {
      return read(JsonReader.parse(await readFile(file, Resources.textEncoding)));
    }
    catch (error) {
      throw new BuildException(Resources.formatJsonUnreadable(this.describe(file), error), new ExceptionOptions(error));
    }
  }

  private describe(file: string): string {
    return path.relative(this.root, file).split(path.sep).join(path.posix.sep);
  }

  private static isFile(file: string): boolean {
    return statSync(file).isFile();
  }

  private get app(): string | null {
    return this.layout.windowAppFolder;
  }

  private async requireSingleCopyAsync(): Promise<void> {
    const result = await this.npm.runAsync(Resources.angularListArguments, this.root);
    const copies = InstalledCopies.find(result.output, Resources.angularSingleCopyPackage);
    if (copies.length > 1)
      throw new BuildException(Resources.formatAngularCopies(Resources.angularSingleCopyPackage, copies));
  }

  private async hasTestTargetAsync(): Promise<boolean> {
    const source = path.join(this.root, Resources.sourceFolder);
    const folders = (await readdir(source, { withFileTypes: true })).filter(t => t.isDirectory()).map(t => t.name).sort();
    for (const folder of folders) {
      const workspace = path.join(source, folder, Resources.angularWorkspaceFile);
      if (existsSync(workspace) && await this.readJsonAsync(workspace, t => {
        const projects = t.readObject(Resources.angularProjectsField);
        return Object.keys(projects.toJson()).some(u => projects.readObject(u).readObject(Resources.angularArchitectField).hasField(Resources.angularTestTarget));
      }))
        return true;
    }
    return false;
  }

  private async removeOwnPackagesAsync(): Promise<void> {
    const modulesPrefix = await RootManifest.readModulePackagePrefixAsync(this.root);
    const lockfile = path.join(this.root, Resources.packageLockFileName);
    const locked = existsSync(lockfile) ? await this.readJsonAsync(lockfile, t => t.readObject(Resources.lockfilePackagesField)) : JsonReader.fromValue({});
    const isLocked = (name: string): boolean => locked.hasField(Resources.formatPackageLockKey(name));
    for (const ownScope of PackageNaming.listOwnScopes(modulesPrefix)) {
      const scope = path.join(this.root, Resources.nodeModulesFolder, ownScope);
      if (!existsSync(scope))
        continue;
      for (const entry of (await readdir(scope)).filter(t => PackageNaming.isOwn(Resources.formatScopedPackageName(ownScope, t), modulesPrefix) && !isLocked(Resources.formatScopedPackageName(ownScope, t)))) {
        const installed = path.join(scope, entry);
        if (!PackageManifest.isAngular(await InstalledPackages.readDependencyNamesAsync(installed, Resources.catalogPeerFields)))
          continue;
        if ((await lstat(installed)).isSymbolicLink())
          await unlink(installed);
        else
          await rm(installed, { recursive: true, force: true });
      }
      if ((await readdir(scope)).length === 0)
        await rmdir(scope);
    }
  }

  private async needsInstallAsync(): Promise<boolean> {
    const record = path.join(this.root, Resources.angularInstallRecord);
    if (!existsSync(record) || !existsSync(path.join(this.root, Resources.angularCli)))
      return true;
    return await readFile(record, Resources.textEncoding) !== await this.describeInstallAsync();
  }

  private async describeInstallAsync(): Promise<string> {
    const lockfile = path.join(this.root, Resources.packageLockFileName);
    return Resources.formatAngularInstallRecord(process.platform, process.arch, existsSync(lockfile) ? await ContentHash.ofFileAsync(lockfile) : Resources.absentLockfileHash);
  }
}
