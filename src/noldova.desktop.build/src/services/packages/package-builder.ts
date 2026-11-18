/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProcessResult } from "../../models/processes/process-result.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import type { NpmCommand } from "../toolchain/npm-command.ts";
import { TypeScriptCompiler } from "../toolchain/typescript-compiler.ts";
import type { AddonBuilder } from "./addon-builder.ts";
import { ArchiveReader } from "./archive.reader.ts";
import type { BuildLayout } from "./build-layout.ts";
import { LockedInstallCheck } from "./locked-install-check.ts";
import type { PackageManifest } from "../../models/packages/package-manifest.ts";
import type { PackageVersions } from "../../models/packages/package-versions.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackageBuilder {
  private readonly layout: BuildLayout;
  private readonly versions: PackageVersions;
  private readonly runner: ProcessRunner;
  private readonly npm: NpmCommand;
  private readonly addons: AddonBuilder;
  private readonly protocolVersion: number | null;
  private readonly archives: ArchiveReader = new ArchiveReader();

  public constructor(layout: BuildLayout, versions: PackageVersions, runner: ProcessRunner, npm: NpmCommand, addons: AddonBuilder, protocolVersion: number | null = null) {
    this.layout = layout;
    this.versions = versions;
    this.runner = runner;
    this.npm = npm;
    this.addons = addons;
    this.protocolVersion = protocolVersion;
  }

  public async buildSourceAsync(manifest: PackageManifest, archives: readonly string[]): Promise<void> {
    await this.packSourceAsync(manifest);
    await this.installAsync(manifest.name, this.layout.root, archives);
  }

  public async packSourceAsync(manifest: PackageManifest): Promise<void> {
    const declarations = this.locateDeclarations(manifest);
    const output = this.layout.locateOutput(manifest);
    await rm(output, { recursive: true, force: true });
    const script = this.layout.locateSource(manifest, ...Resources.buildScriptSegments);
    const buildsItself = existsSync(script);
    if (buildsItself)
      await this.runBuildScriptAsync(manifest, script, output);
    else
      await this.compileAsync(manifest, Resources.sourceFolder, this.layout.locateSource(manifest, Resources.sourceFolder), output);
    await writeFile(path.join(output, Resources.packageManifestFileName), this.versions.stampManifest(manifest, await readFile(this.layout.locateSource(manifest, Resources.packageManifestFileName), Resources.textEncoding)));
    await this.stampProtocolVersionAsync(manifest, path.join(output, Resources.packageResourcesFile));
    for (const [source, name] of this.listCopies(manifest))
      await cp(source, path.join(output, name), { recursive: true });
    if (!buildsItself)
      await this.copyDeclarationsAsync(declarations, output);
    await this.addons.buildAsync(manifest, output);

    await mkdir(this.layout.archivesFolder, { recursive: true });
    PackageBuilder.require(await this.npm.runAsync([...Resources.npmPackArguments, this.layout.archivesFolder], output), Resources.formatPackingOperation(manifest.name));
    const differences = await this.findArchiveDifferencesAsync(manifest, this.layout.locateArchive(manifest, this.versions.of(manifest.name)));
    if (differences.length > 0)
      throw new BuildException(Resources.formatLines([...differences, Resources.buildScriptInputsRule]));
  }

  public async listCopiedFilesAsync(manifest: PackageManifest): Promise<readonly (readonly [string, string])[]> {
    const script = this.layout.locateSource(manifest, ...Resources.buildScriptSegments);
    const copies: (readonly [string, string])[] = [...this.listCopies(manifest)];
    if (existsSync(script))
      copies.push(...(await this.listScriptInputsAsync(manifest, script)).map(t => [t, path.basename(t)] as const));
    else {
      const folder = path.dirname(this.locateDeclarations(manifest));
      const entry = Resources.declarationSegments.slice(0, -1).join(path.posix.sep);
      copies.push(...(await readdir(folder)).filter(t => t.endsWith(Resources.declarationExtension)).sort().map(t => [path.join(folder, t), Resources.formatFolderPath(entry, t)] as const));
    }
    const files: (readonly [string, string])[] = [];
    for (const [source, entry] of copies)
      files.push(...await PackageBuilder.listFilesAsync(source, entry));
    return files.filter(([, entry]) => PackageBuilder.isPacked(manifest.files, entry));
  }

  public async listInputsAsync(manifest: PackageManifest): Promise<readonly string[]> {
    const inputs = [
      this.layout.locateSource(manifest, Resources.packageManifestFileName),
      this.layout.locateSource(manifest, Resources.sourceFolder),
      ...this.listCopies(manifest).map(([source]) => source)
    ];
    const scripts = this.layout.locateSource(manifest, Resources.scriptsFolder);
    if (existsSync(scripts))
      inputs.push(scripts);
    const script = this.layout.locateSource(manifest, ...Resources.buildScriptSegments);
    if (existsSync(script))
      inputs.push(...await this.listScriptInputsAsync(manifest, script));
    return inputs;
  }

  public async findArchiveDifferencesAsync(manifest: PackageManifest, archive: string): Promise<readonly string[]> {
    const script = this.layout.locateSource(manifest, ...Resources.buildScriptSegments);
    const copies = existsSync(script) ? await this.listScriptInputsAsync(manifest, script) : [];
    if (copies.length === 0)
      return [];
    const packed = await this.archives.readAsync(archive);
    const differences: string[] = [];
    for (const source of copies)
      for (const [file, entry] of await PackageBuilder.listFilesAsync(source, Resources.formatFolderPath(Resources.archivePackageFolder, path.basename(source)))) {
        const copy = packed.get(entry);
        const origin = path.relative(this.layout.root, file).split(path.sep).join(path.posix.sep);
        if (Object.isUndefined(copy))
          differences.push(Resources.formatArchiveCopyMissing(path.basename(archive), entry, origin));
        else if (!copy.equals(await readFile(file)))
          differences.push(Resources.formatArchiveCopyDiffers(path.basename(archive), entry, origin));
      }
    return differences;
  }

  public async installAsync(subject: string, folder: string, archives: readonly string[]): Promise<void> {
    const installed = archives.filter(t => existsSync(t));
    const peers = installed.length === 0 ? [] : await LockedInstallCheck.listLockedSpecsAsync(folder);
    PackageBuilder.require(await this.npm.runAsync([...Resources.npmInstallArguments, ...installed, ...peers], folder), Resources.formatInstallingOperation(subject));
    await LockedInstallCheck.checkAsync(folder);
  }

  public async compileTestsAsync(manifest: PackageManifest): Promise<void> {
    const output = this.layout.locateTestOutput(manifest);
    await rm(output, { recursive: true, force: true });
    await this.compileAsync(manifest, Resources.testsFolder, this.layout.locateSource(manifest), output);
    const source = path.join(output, Resources.sourceFolder);
    await rm(source, { recursive: true, force: true });
    await symlink(this.layout.locateInstalled(manifest), source, Resources.testSourceLinkType);
  }

  public async typeCheckAsync(manifest: PackageManifest): Promise<void> {
    const result = await this.runner.captureAsync(
      process.execPath,
      [TypeScriptCompiler.locate(this.layout.root), Resources.compilerProjectOption, this.layout.locateSource(manifest, Resources.sourceFolder, Resources.projectFile), Resources.compilerNoEmitOption],
      this.layout.root,
      Resources.compileTimeout);
    PackageBuilder.require(result, Resources.formatTypeCheckOperation(manifest.directory));
  }

  private async stampProtocolVersionAsync(manifest: PackageManifest, resources: string): Promise<void> {
    if (!existsSync(resources))
      return;
    const text = await readFile(resources, Resources.textEncoding);
    if (!text.includes(Resources.protocolVersionPlaceholder))
      return;
    if (Object.isNull(this.protocolVersion))
      throw new BuildException(Resources.formatProtocolVersionUndeclared(manifest.directory));
    await writeFile(resources, text.replaceAll(Resources.protocolVersionPlaceholder, String(this.protocolVersion)));
  }

  private static require(result: ProcessResult, operation: string): void {
    if (!result.isSuccessful)
      throw new BuildException(Resources.formatOperationFailed(operation, result.exitCode, result.text));
  }

  private static async listFilesAsync(source: string, entry: string): Promise<readonly (readonly [string, string])[]> {
    if (!(await stat(source)).isDirectory())
      return [[source, entry]];
    const files: (readonly [string, string])[] = [];
    for (const name of (await readdir(source, { recursive: true })).sort()) {
      const file = path.join(source, name);
      if ((await stat(file)).isFile())
        files.push([file, Resources.formatFolderPath(entry, name.split(path.sep).join(path.posix.sep))]);
    }
    return files;
  }

  private static isPacked(files: readonly string[] | null, entry: string): boolean {
    return Object.isNull(files) || Resources.alwaysPackedPattern.test(entry)
      || files.map(t => t.replace(Resources.trailingSlashesPattern, String.empty)).some(t => path.posix.matchesGlob(entry, t) || path.posix.matchesGlob(entry, `${t}${Resources.globDescendantsSuffix}`));
  }

  private listCopies(manifest: PackageManifest): readonly (readonly [string, string])[] {
    const optional = [[[Resources.readmeFile], Resources.readmeFile] as const, ...Resources.modulePackageFiles.map(t => [[t], t] as const),
      [[Resources.sourceFolder, Resources.assetsFolder], Resources.assetsFolder] as const]
      .map(([segments, name]) => [this.layout.locateSource(manifest, ...segments), name] as const)
      .filter(([source]) => existsSync(source));
    return [[path.join(this.layout.root, Resources.licenseFile), Resources.licenseFile], ...optional];
  }

  private locateDeclarations(manifest: PackageManifest): string {
    const declarations = this.layout.locateSource(manifest, Resources.sourceFolder, ...Resources.declarationSegments);
    if (!existsSync(declarations))
      throw new BuildException(Resources.formatDeclarationsMissing(manifest.directory));
    return declarations;
  }

  private async copyDeclarationsAsync(declarations: string, output: string): Promise<void> {
    const folder = path.join(output, ...Resources.declarationSegments.slice(0, -1));
    await mkdir(folder, { recursive: true });
    for (const name of (await readdir(path.dirname(declarations))).filter(t => t.endsWith(Resources.declarationExtension)).sort())
      await copyFile(path.join(path.dirname(declarations), name), path.join(folder, name));
  }

  private async listScriptInputsAsync(manifest: PackageManifest, script: string): Promise<readonly string[]> {
    const result = await this.runner.captureAsync(process.execPath, [script, Resources.inputsOption], this.layout.root, Resources.buildScriptTimeout);
    PackageBuilder.require(result, Resources.formatListingInputsOperation(manifest.directory));
    return result.output.split(Resources.lineBreakPattern).filter(t => t.length > 0).map(t => path.join(this.layout.root, ...t.split(Resources.pathSegmentSeparator)));
  }

  private async runBuildScriptAsync(manifest: PackageManifest, script: string, output: string): Promise<void> {
    const result = await this.runner.captureAsync(process.execPath, [script, output], this.layout.root, Resources.buildScriptTimeout);
    PackageBuilder.require(result, Resources.formatBuildScriptOperation(manifest.directory));
  }

  private async compileAsync(manifest: PackageManifest, folder: string, rootDirectory: string, output: string): Promise<void> {
    const project = this.layout.locateSource(manifest, folder, Resources.projectFile);
    const result = await this.runner.captureAsync(
      process.execPath,
      [
        TypeScriptCompiler.locate(this.layout.root),
        Resources.compilerProjectOption,
        project,
        Resources.compilerRootOption,
        rootDirectory,
        Resources.compilerOutputOption,
        output,
        Resources.compilerSourceMapOption
      ],
      this.layout.root,
      Resources.compileTimeout);
    PackageBuilder.require(result, Resources.formatCompilingOperation(manifest.directory, folder));
  }
}
