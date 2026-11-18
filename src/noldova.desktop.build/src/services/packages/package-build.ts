/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";

import { BuildVariant } from "../../models/modules/build-variant.ts";
import { ModuleCatalog } from "../modules/module-catalog.ts";
import type { ModuleDeclaration } from "../../models/modules/module-declaration.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { Git } from "../repository/git.ts";
import { NodeGyp } from "../toolchain/node-gyp.ts";
import { NpmCommand } from "../toolchain/npm-command.ts";
import { AddonBuilder } from "./addon-builder.ts";
import { BuildLayout } from "./build-layout.ts";
import { BuildProduct } from "./build-product.ts";
import { BuildRecord } from "../../models/packages/build-record.ts";
import { ContentHash } from "./content-hash.ts";
import { ImportClosure } from "./import-closure.ts";
import { InstalledPackages } from "./installed-packages.ts";
import { InstalledTreeCheck } from "./installed-tree-check.ts";
import { ModuleWindowImports } from "./module-window-imports.ts";
import { OnceHash } from "./once-hash.ts";
import { PackageBuilder } from "./package-builder.ts";
import { PackageCatalog } from "./package-catalog.ts";
import type { PackageManifest } from "../../models/packages/package-manifest.ts";
import { PackageVersions } from "../../models/packages/package-versions.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import { Resources } from "../../resources.ts";

export class PackageBuild {
  private static readonly TOOL_FOLDER: string = fileURLToPath(new URL(Resources.buildToolFolderUrl, import.meta.url));
  private static readonly toolHash: OnceHash = new OnceHash(() => ContentHash.ofTreeAsync(PackageBuild.TOOL_FOLDER));

  private readonly layout: BuildLayout;
  private readonly catalog: PackageCatalog;
  private readonly closure: ImportClosure;
  private readonly windowImports: ModuleWindowImports;
  private readonly tree: InstalledTreeCheck;
  private readonly product: BuildProduct;
  private readonly modules: ModuleCatalog;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly platform: string;
  private readonly architecture: string;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv, platform: string = process.platform, architecture: string = process.arch) {
    this.layout = new BuildLayout(root);
    this.catalog = new PackageCatalog(root);
    this.closure = new ImportClosure(root);
    this.windowImports = new ModuleWindowImports(this.layout);
    this.tree = new InstalledTreeCheck(this.layout);
    this.product = new BuildProduct(root);
    this.modules = new ModuleCatalog(root);
    this.runner = runner;
    this.environment = environment;
    this.platform = platform;
    this.architecture = architecture;
  }

  public async buildAsync(output: Writable, variant: BuildVariant = BuildVariant.REGULAR): Promise<readonly PackageManifest[]> {
    const all = await this.listAllAsync(variant.isTest);
    const packages = all.filter(t => !t.isAngular && !PackageBuild.buildsOnAngular(t, all));
    if (packages.length === 0)
      return packages;

    const versions = await this.readVersionsAsync(all);
    const archives = packages.map(t => this.layout.locateArchive(t, versions.of(t.name)));
    const common = await this.hashCommonInputsAsync();
    const builder = await this.createBuilderAsync(versions);
    const archiveHashes = new Map<string, string>();
    for (const manifest of packages) {
      const inputs = await this.hashSourceInputsAsync(builder, manifest, packages, common, archiveHashes, versions);
      const artifacts = this.listSourceArtifacts(manifest, versions);
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateRecord(manifest), inputs, artifacts);
      if (!isCurrent)
        await builder.buildSourceAsync(manifest, archives);
      await (await PackageBuild.hashRecordAsync(inputs, artifacts)).writeAsync(this.layout.locateRecord(manifest));
      archiveHashes.set(manifest.name, await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, versions.of(manifest.name))));
      output.write(Resources.formatPackageBuilt(manifest.name, isCurrent));
    }

    const installed = PackageBuild.hashInstalled(packages, archiveHashes);
    for (const manifest of this.listTested(packages)) {
      const inputs = await this.hashTestInputsAsync(manifest, common, installed);
      const artifacts = [this.layout.locateTestOutput(manifest)];
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateTestRecord(manifest), inputs, artifacts);
      if (!isCurrent)
        await builder.compileTestsAsync(manifest);
      await (await PackageBuild.hashRecordAsync(inputs, artifacts)).writeAsync(this.layout.locateTestRecord(manifest));
      output.write(Resources.formatPackageTestsCompiled(manifest.name, isCurrent));
    }

    if (!variant.isTest) {
      const fixtures = await this.listAllAsync(true);
      for (const fixture of fixtures.filter(t => t.isFixture && !t.isAngular)) {
        const buildsOnAngular = PackageBuild.buildsOnAngular(fixture, fixtures);
        if (!buildsOnAngular)
          await builder.typeCheckAsync(fixture);
        output.write(Resources.formatFixtureChecked(fixture.name, buildsOnAngular));
      }
    }

    await this.requireCurrentAsync(variant);
    return packages;
  }

  public async listCopiesAsync(): Promise<readonly (readonly [string, string, string])[]> {
    const all = await this.listAllAsync(false);
    const builder = await this.createBuilderAsync(await this.readVersionsAsync(all));
    const copies: (readonly [string, string, string])[] = [];
    for (const manifest of all)
      for (const [file, entry] of await builder.listCopiedFilesAsync(manifest))
        copies.push([path.relative(this.layout.root, file).split(path.sep).join(path.posix.sep), manifest.name, entry]);
    return copies;
  }

  public async writeProductAsync(variant: BuildVariant, outputFolder: string | null): Promise<void> {
    await this.product.writeAsync(await this.hashFingerprintAsync(variant), outputFolder, variant);
  }

  public async buildAngularAsync(output: Writable, variant: BuildVariant = BuildVariant.REGULAR): Promise<readonly PackageManifest[]> {
    const packages = await this.catalog.listAngularPackagesAsync(variant.isTest);
    if (packages.length === 0 && !this.hasWindowApp())
      return packages;

    const all = await this.listAllAsync(variant.isTest);
    const versions = await this.readVersionsAsync(all);
    const common = await this.hashAngularInputsAsync();
    const builder = await this.createBuilderAsync(versions);
    const dependencies = new Set(packages.flatMap(t => PackageBuild.collectDependencies(t, all)));
    const archiveHashes = new Map<string, string>();
    for (const manifest of all.filter(t => !t.isAngular && dependencies.has(t.name)))
      archiveHashes.set(manifest.name, await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, versions.of(manifest.name))));
    let isOwnInstalled = false;
    for (const [index, manifest] of packages.entries()) {
      const inputs = await this.hashSourceInputsAsync(builder, manifest, all, common, archiveHashes, versions);
      const artifacts = [this.layout.locateArchive(manifest, versions.of(manifest.name))];
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateRecord(manifest), inputs, artifacts);
      if (!isCurrent && manifest.isFixture && !isOwnInstalled) {
        await builder.installAsync(Resources.angularInstallSubject, this.layout.root,
          [...all.filter(t => !t.isAngular && !PackageBuild.buildsOnAngular(t, all)), ...packages.slice(0, index).filter(t => !t.isFixture)]);
        isOwnInstalled = true;
      }
      if (!isCurrent)
        await builder.packSourceAsync(manifest);
      await (await PackageBuild.hashRecordAsync(inputs, artifacts)).writeAsync(this.layout.locateRecord(manifest));
      archiveHashes.set(manifest.name, await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, versions.of(manifest.name))));
      output.write(Resources.formatPackageBuilt(manifest.name, isCurrent));
    }

    await this.buildOnAngularAsync(output, builder, all, versions, archiveHashes);
    return packages;
  }

  public async installAngularAsync(output: Writable, modules: readonly ModuleDeclaration[] = [], variant: BuildVariant = BuildVariant.REGULAR): Promise<void> {
    await this.windowImports.checkAsync(modules.flatMap(t => !Object.isNull(t.packageName) && !Object.isNull(t.windowEntry) ? [t.packageName] : []));
    const packages = await this.catalog.listAngularPackagesAsync(variant.isTest);
    if (packages.length === 0 && !this.hasWindowApp()) {
      await this.tree.checkAsync();
      return;
    }

    const all = await this.listAllAsync(variant.isTest);
    const versions = await this.readVersionsAsync(all);
    const builder = await this.createBuilderAsync(versions);
    const installed = new Map(packages.filter(t => existsSync(this.layout.locateArchive(t, versions.of(t.name)))).map(t => [t.name, versions.of(t.name)] as const));
    const parts = [await this.hashAngularInputsAsync()];
    for (const manifest of packages.filter(t => installed.has(t.name)))
      parts.push(Resources.formatHashEntry(manifest.name, await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, versions.of(manifest.name)))));
    const record = new BuildRecord(ContentHash.ofParts(parts), []);
    const isCurrent = await record.isRecordedAsync(this.layout.windowInstallRecord) && await this.isInstalledAsync(installed);
    if (!isCurrent) {
      await rm(this.layout.windowInstallRecord, { force: true });
      await builder.installAsync(Resources.angularInstallSubject, this.layout.root, [...all.filter(t => !t.isAngular), ...packages]);
      await record.writeAsync(this.layout.windowInstallRecord);
    }
    await this.tree.checkAsync();
    output.write(Resources.formatAngularPackagesInstalled(packages.length, isCurrent));
  }

  public async requireCurrentAsync(variant: BuildVariant = BuildVariant.REGULAR): Promise<void> {
    const all = await this.listAllAsync(variant.isTest);
    const packages = all.filter(t => !t.isAngular && !PackageBuild.buildsOnAngular(t, all));
    if (packages.length === 0)
      return;

    const versions = await this.readVersionsAsync(all);
    const common = await this.hashCommonInputsAsync();
    const builder = await this.createBuilderAsync(versions);
    const archiveHashes = new Map<string, string>();
    const stale: string[] = [];
    for (const manifest of packages) {
      const inputs = await this.hashSourceInputsAsync(builder, manifest, packages, common, archiveHashes, versions);
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateRecord(manifest), inputs, this.listSourceArtifacts(manifest, versions));
      if (!isCurrent)
        stale.push(manifest.name);
      archiveHashes.set(manifest.name, isCurrent ? await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, versions.of(manifest.name))) : Resources.staleHash);
    }

    const installed = PackageBuild.hashInstalled(packages, archiveHashes);
    for (const manifest of this.listTested(packages)) {
      const inputs = await this.hashTestInputsAsync(manifest, common, installed);
      if (!await PackageBuild.isCurrentAsync(this.layout.locateTestRecord(manifest), inputs, [this.layout.locateTestOutput(manifest)]))
        stale.push(Resources.formatTestsSubject(manifest.name));
    }
    if (stale.length > 0)
      throw new BuildException(Resources.formatArtifactsStale(stale));
  }

  public async hashFingerprintAsync(variant: BuildVariant): Promise<string> {
    const declarations = await this.modules.listBuildAsync(variant.isTest, variant.excluded);
    const packages = await this.catalog.listPackagesAsync(variant.isTest);
    const builder = await this.createBuilderAsync(await this.readVersionsAsync(packages));
    const parts = [await this.hashCommonInputsAsync(), JSON.stringify(declarations.map(t => t.toJson()))];
    for (const manifest of packages)
      parts.push(Resources.formatHashEntry(manifest.name, await this.hashPackageSourceAsync(builder, manifest)));
    return ContentHash.ofParts(parts);
  }

  private async buildOnAngularAsync(output: Writable, builder: PackageBuilder, all: readonly PackageManifest[], versions: PackageVersions, archiveHashes: Map<string, string>): Promise<void> {
    const packages = all.filter(t => !t.isAngular && PackageBuild.buildsOnAngular(t, all));
    if (packages.length === 0)
      return;

    const common = await this.hashCommonInputsAsync();
    const rooted = all.filter(t => !t.isAngular);
    const parts = new Set(rooted.flatMap(t => t.dependencies));
    const angularParts = all.filter(t => t.isAngular && parts.has(t.name));
    for (const manifest of rooted.filter(t => !packages.includes(t) && !archiveHashes.has(t.name)))
      archiveHashes.set(manifest.name, await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, versions.of(manifest.name))));
    let arePartsInstalled = false;
    for (const manifest of packages) {
      const inputs = await this.hashSourceInputsAsync(builder, manifest, all, common, archiveHashes, versions);
      const artifacts = [this.layout.locateArchive(manifest, versions.of(manifest.name))];
      const isCurrent = await PackageBuild.isCurrentAsync(this.layout.locateRecord(manifest), inputs, artifacts);
      if (!isCurrent && !arePartsInstalled) {
        await builder.installAsync(Resources.rootInstallSubject, this.layout.root, [...rooted.filter(t => !packages.includes(t)), ...angularParts]);
        arePartsInstalled = true;
      }
      if (!isCurrent)
        await builder.packSourceAsync(manifest);
      await (await PackageBuild.hashRecordAsync(inputs, artifacts)).writeAsync(this.layout.locateRecord(manifest));
      archiveHashes.set(manifest.name, await ContentHash.ofFileAsync(this.layout.locateArchive(manifest, versions.of(manifest.name))));
      output.write(Resources.formatPackageBuilt(manifest.name, isCurrent));
    }

    await builder.installAsync(Resources.rootInstallSubject, this.layout.root, [...rooted, ...angularParts]);
    output.write(Resources.formatRootPackagesInstalled(packages.length));
  }

  private async isInstalledAsync(installed: ReadonlyMap<string, string>): Promise<boolean> {
    for (const [name, version] of installed) {
      const folder = this.layout.locateInstalledPackage(name);
      if (!existsSync(path.join(folder, Resources.packageManifestFileName)) || await InstalledPackages.readVersionAsync(folder) !== version)
        return false;
    }
    return true;
  }

  private hasWindowApp(): boolean {
    const app = this.layout.windowAppFolder;
    return !Object.isNull(app) && existsSync(path.join(app, Resources.angularWorkspaceFile));
  }

  private async listAllAsync(includeFixtures: boolean): Promise<readonly PackageManifest[]> {
    return [...await this.catalog.listPackagesAsync(includeFixtures), ...await this.catalog.listAngularPackagesAsync(includeFixtures)];
  }

  private static buildsOnAngular(manifest: PackageManifest, packages: readonly PackageManifest[]): boolean {
    const dependencies = PackageBuild.collectDependencies(manifest, packages);
    return packages.some(t => t.isAngular && dependencies.includes(t.name));
  }

  private static collectDependencies(manifest: PackageManifest, packages: readonly PackageManifest[]): readonly string[] {
    const direct = packages.filter(t => manifest.dependencies.includes(t.name));
    return [...new Set(direct.flatMap(t => [t.name, ...PackageBuild.collectDependencies(t, packages)]))].sort();
  }

  private static hashInstalled(packages: readonly PackageManifest[], archiveHashes: ReadonlyMap<string, string>): string {
    return ContentHash.ofParts(packages.filter(t => !t.isFixture).map(t => Resources.formatHashEntry(t.name, archiveHashes.get(t.name))));
  }

  private static async isCurrentAsync(recordFile: string, inputs: string, artifacts: readonly string[]): Promise<boolean> {
    return artifacts.every(t => existsSync(t)) && await (await PackageBuild.hashRecordAsync(inputs, artifacts)).isRecordedAsync(recordFile);
  }

  private static async hashRecordAsync(inputs: string, artifacts: readonly string[]): Promise<BuildRecord> {
    const outputs: string[] = [];
    for (const artifact of artifacts)
      outputs.push(await PackageBuild.hashPathAsync(artifact));
    return new BuildRecord(inputs, outputs);
  }

  private static async hashPathAsync(item: string): Promise<string> {
    return (await stat(item)).isDirectory() ? await ContentHash.ofTreeAsync(item) : await ContentHash.ofFileAsync(item);
  }

  private async readVersionsAsync(packages: readonly PackageManifest[]): Promise<PackageVersions> {
    return await PackageVersions.readAsync(this.modules, (await RootManifest.readAsync(this.layout.root)).productVersion, packages, await this.readCommitAsync());
  }

  private async readCommitAsync(): Promise<string | null> {
    if (!existsSync(path.join(this.layout.root, Resources.gitFolder)))
      return null;
    const git = new Git(this.layout.root, this.runner);
    if ((await git.readOutputAsync(Resources.gitStatusArguments)).length > 0)
      return null;
    const commit = (await git.readOutputAsync(Resources.gitCommitArguments, Resources.gitCommitExitCodes)).trim();
    return commit.length > 0 ? commit : null;
  }

  private async createBuilderAsync(versions: PackageVersions): Promise<PackageBuilder> {
    const addons = new AddonBuilder(this.layout, new NodeGyp(this.runner, this.environment), this.platform, this.architecture, this.releaseAddons);
    const root = await RootManifest.readAsync(this.layout.root);
    return new PackageBuilder(this.layout, versions, this.runner, new NpmCommand(this.runner, this.environment), addons, root.protocolVersion);
  }

  private get releaseAddons(): string {
    return this.environment[Resources.releaseAddonsVariable] ?? String.empty;
  }

  private listSourceArtifacts(manifest: PackageManifest, versions: PackageVersions): readonly string[] {
    return [this.layout.locateArchive(manifest, versions.of(manifest.name)), this.layout.locateInstalled(manifest)];
  }

  private listTested(packages: readonly PackageManifest[]): readonly PackageManifest[] {
    return packages.filter(t => existsSync(this.layout.locateSource(t, Resources.testsFolder, Resources.projectFile)));
  }

  private async hashCommonInputsAsync(): Promise<string> {
    const parts: string[] = [this.platform, this.architecture];
    if (this.releaseAddons.length > 0)
      parts.push(await ContentHash.ofTreeAsync(this.releaseAddons));
    parts.push(await PackageBuild.toolHash.readAsync());
    for (const file of Resources.buildRootInputs) {
      const input = path.join(this.layout.root, file);
      parts.push(existsSync(input) ? await ContentHash.ofFileAsync(input) : Resources.missingInputHash);
    }
    return ContentHash.ofParts(parts);
  }

  private async hashAngularInputsAsync(): Promise<string> {
    const parts = [await this.hashCommonInputsAsync()];
    const app = this.layout.windowAppFolder;
    if (!Object.isNull(app))
      for (const file of Resources.angularInputs)
        parts.push(await ContentHash.ofFileAsync(path.join(app, file)));
    const carrier = path.join(this.layout.root, ...Resources.carryScriptSegments);
    if (existsSync(carrier))
      parts.push(await this.closure.hashAsync(carrier));
    return ContentHash.ofParts(parts);
  }

  private async hashPackageSourceAsync(builder: PackageBuilder, manifest: PackageManifest): Promise<string> {
    const parts: string[] = [];
    for (const input of await builder.listInputsAsync(manifest))
      parts.push(path.relative(this.layout.root, input).split(path.sep).join(path.posix.sep), await PackageBuild.hashPathAsync(input));
    const script = this.layout.locateSource(manifest, Resources.scriptsFolder, Resources.buildScriptFile);
    if (existsSync(script))
      parts.push(await this.closure.hashAsync(script));
    return ContentHash.ofParts(parts);
  }

  private async hashSourceInputsAsync(
    builder: PackageBuilder,
    manifest: PackageManifest,
    packages: readonly PackageManifest[],
    common: string,
    archiveHashes: ReadonlyMap<string, string>,
    versions: PackageVersions): Promise<string> {
    const dependencies = PackageBuild.collectDependencies(manifest, packages).map(t => Resources.formatHashEntry(t, archiveHashes.get(t)));
    return ContentHash.ofParts([common, versions.of(manifest.name), versions.commit ?? String.empty, await this.hashPackageSourceAsync(builder, manifest), ...dependencies]);
  }

  private async hashTestInputsAsync(manifest: PackageManifest, common: string, installed: string): Promise<string> {
    return ContentHash.ofParts([common, await ContentHash.ofTreeAsync(this.layout.locateSource(manifest, Resources.testsFolder)), installed]);
  }
}
