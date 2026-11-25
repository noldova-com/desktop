/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, cp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { CodePointComparer } from "@noldova/context.text";

import { ModuleCatalog } from "../modules/module-catalog.ts";
import { BuildLayout } from "../packages/build-layout.ts";
import { BuildProduct } from "../packages/build-product.ts";
import { PackageCatalog } from "../packages/package-catalog.ts";
import type { PackageManifest } from "../../models/packages/package-manifest.ts";
import { PackageNaming } from "../packages/package-naming.ts";
import { PackageVersions } from "../../models/packages/package-versions.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import type { NpmCommand } from "../toolchain/npm-command.ts";
import { AcceptedLicenses } from "../../models/packaging/accepted-licenses.ts";
import { CompanyPackage } from "../../models/packaging/company-package.ts";
import { DeclaredPackages } from "../../models/packaging/declared-packages.ts";
import { ForeignAddons } from "./foreign-addons.ts";
import type { LockedPackage } from "../../models/packaging/locked-package.ts";
import { OmittedOptionals } from "../../models/packaging/omitted-optionals.ts";
import { PackageAssets } from "./package-assets.ts";
import { PackageLayout } from "./package-layout.ts";
import type { PackageTarget } from "../../models/packaging/package-target.ts";
import type { PackagedBuild } from "./packaged-build.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { ShippedPackages } from "../../models/packaging/shipped-packages.ts";
import { StagedDependency } from "../../models/packaging/staged-dependency.ts";
import { StagedSources } from "./staged-sources.ts";
import { ThirdPartyClosure } from "./third-party-closure.ts";
import { ThirdPartyPackage } from "../../models/packaging/third-party-package.ts";
import { TypeOnlyPeers } from "../../models/packaging/type-only-peers.ts";
import { FolderCreation } from "../files/folder-creation.ts";
import { Resources } from "../../resources.ts";

export class PackageStage {
  private readonly root: string;
  private readonly layout: PackageLayout;
  private readonly assets: PackageAssets;
  private readonly modules: ModuleCatalog;
  private readonly npm: NpmCommand;
  private readonly build: PackagedBuild;

  private readonly companyArchives: string | null;

  public constructor(root: string, npm: NpmCommand, build: PackagedBuild, companyArchives: string | null = null) {
    this.root = root;
    this.layout = new PackageLayout(root);
    this.assets = new PackageAssets(root);
    this.modules = new ModuleCatalog(root);
    this.npm = npm;
    this.build = build;
    this.companyArchives = companyArchives;
  }

  public get folder(): string {
    return this.layout.stage;
  }

  public static async installAsync(npm: NpmCommand, folder: string, root: RootManifest, fields: Readonly<Record<string, unknown>>, cache: string,
    archives: ReadonlyMap<string, string>, target: PackageTarget): Promise<void> {
    const overrides = root.overrides;
    if (!Object.isUndefined(overrides) && !Object.isPlainObject(overrides))
      throw new BuildException(Resources.stageOverridesInvalid);
    const written = Object.isUndefined(overrides)
      ? {}
      : { overrides: PackageStage.referArchives(overrides, archives) };
    await writeFile(path.join(folder, Resources.packageManifestFileName), Resources.formatJsonFile({ ...fields, ...written }));
    const result = await npm.runAsync([...Resources.stageInstallArguments, cache, ...target.installArguments, ...archives.values()], folder);
    if (!result.isSuccessful)
      throw new BuildException(Resources.formatStageInstallFailed(result.exitCode, result.text));
    const leftOut = [...archives.keys()].filter(t => !existsSync(path.join(folder, Resources.nodeModulesFolder, ...t.split(Resources.pathSegmentSeparator), Resources.packageManifestFileName)));
    if (leftOut.length > 0)
      throw new BuildException(Resources.formatStageArchivesLeftOut(leftOut));
  }

  public async stageAsync(target: PackageTarget, output: Writable, updateFeed: string | null, windowsPublisher: string | null, updateKeys: readonly string[] = []):
    Promise<readonly string[]> {
    const product = await ProductIdentity.readAsync(this.root);
    const license = this.assets.require(Resources.licenseSegments, Resources.stageLicenseRole);
    const icons = this.assets.require(product.icons.split(Resources.pathSegmentSeparator), Resources.stageIconsRole);
    const dictionaries = this.assets.require(Resources.dictionariesSegments, Resources.stageDictionariesRole);
    await rm(this.folder, { recursive: true, force: true });
    await rm(this.layout.npmCache, { recursive: true, force: true });
    const manifest = await RootManifest.readAsync(this.root);
    const { packages, installed } = await this.listShippedAsync();
    const versions = await PackageVersions.readAsync(this.modules, manifest.productVersion, packages);
    const declarations = await this.modules.listBuildAsync(false, []);
    const modulePackages = declarations.map(t => t.packageName).filter(t => !Object.isNull(t));
    const windowPackages = new Set<string>(declarations.flatMap(t => Object.isNull(t.packageName) || Object.isNull(t.windowEntry) ? [] : [PackageNaming.nameWindowPackage(t.packageName)]));
    const typeOnly = await TypeOnlyPeers.readAsync(this.root);
    const accepted = await AcceptedLicenses.readAsync(this.root);
    const omitted = await OmittedOptionals.readAsync(this.root);
    const { shipped: closure, leftOut } = (await ThirdPartyClosure.readAsync(this.root, target)).collect(packages, [...installed, ...modulePackages], typeOnly, windowPackages, omitted,
      t => versions.of(t));
    const roots = [...installed, ...modulePackages].map(t => new StagedDependency(t, String(closure.find(u => u.name === t)?.version)));
    const company = await this.packCompanyAsync(closure.filter(t => PackageNaming.isNoldova(t.name)), windowPackages);
    const thirdParty = await this.prepareThirdPartyAsync(closure.filter(t => !PackageNaming.isNoldova(t.name)), accepted, typeOnly, output);
    const shipped = new Set([...closure.map(t => t.id), ...packages.map(t => Resources.formatPackageId(t.name, versions.of(t.name)))]);
    const declared = [new DeclaredPackages(Resources.acceptedLicensesSection, accepted.ids), new DeclaredPackages(Resources.typeOnlyPeersSection, typeOnly.ids),
      new DeclaredPackages(Resources.omittedOptionalsSection, omitted.ids)];
    for (const { section, ids } of declared)
      for (const id of ids.filter(t => !shipped.has(t)))
        output.write(Resources.formatStageUnshippedWarning(section, id));
    for (const item of thirdParty)
      for (const entry of item.skipped)
        output.write(Resources.formatStageSkippedEntryWarning(item.locked.id, entry));
    output.write(Resources.formatStageOptionalsLeftOut(leftOut));

    await this.build.buildAsync(path.join(this.folder, Resources.buildFolder), updateFeed);
    if (!Object.isNull(windowsPublisher))
      await BuildProduct.setWindowsPublisherAsync(path.join(this.folder, Resources.buildFolder), windowsPublisher);
    if (updateKeys.length > 0)
      await BuildProduct.setLinuxUpdateKeysAsync(path.join(this.folder, Resources.buildFolder), updateKeys);
    output.write(Resources.stageNoGallery);
    const archives = new BuildLayout(this.root);
    await PackageStage.installAsync(this.npm, this.folder, manifest, {
      name: product.slug,
      productName: product.name,
      version: manifest.productVersion,
      author: product.publisher,
      desktopName: `${product.applicationId}${Resources.desktopFileExtension}`,
      private: true,
      main: path.posix.join(...Resources.electronMainSegments),
      dependencies: PackageStage.listDependencies([...packages.map(t => new StagedDependency(t.name, versions.of(t.name))), ...roots,
        ...company.filter(t => PackageNaming.isContext(t.locked.name)).map(t => new StagedDependency(t.locked.name, t.locked.version))]),
      optionalDependencies: PackageStage.listDependencies([...company, ...thirdParty].map(t => t.locked).filter(t => t.isPlatformBound).map(t => new StagedDependency(t.name, t.version)))
    }, this.layout.npmCache, PackageStage.locateArchives(packages, versions, archives, [...company, ...thirdParty]), target);
    const foreign = await ForeignAddons.removeAsync(this.folder, target);
    output.write(Resources.formatStagePackages(packages.map(t => t.name)));
    output.write(Resources.formatStageForeignAddons(foreign));
    output.write(Resources.formatStageCompanyPackages(company.map(t => t.locked.id)));
    output.write(Resources.formatStageWindowPackages([...windowPackages]));
    output.write(Resources.formatStageTypeOnlyPeers(typeOnly.describe()));
    output.write(Resources.formatStageAcceptedLicenses(thirdParty.filter(t => t.license.isAccepted)
      .map(t => Resources.formatStageLicensedPackage(t.locked.id, t.license.expression))));
    output.write(Resources.formatStageThirdPartyPackages(thirdParty.map(t => Resources.formatStageLicensedPackage(t.locked.id, t.license.chosen))));
    const sources = await StagedSources.listAsync(this.folder);
    const notices = sources.map(t => Resources.formatSourceNotice(t.id, t.license, t.source.pages, t.source.files.map(u => Resources.formatSourceNoticeFile(u.url, u.sha256))));
    await writeFile(this.layout.thirdPartyLicenses, [...thirdParty.map(t => t.formatNotice()), ...notices].join(Resources.stageNoticeSeparator));
    output.write(Resources.formatStageSources(sources.map(t => Resources.formatStageSource(t.id, t.source.pages))));

    await cp(icons, path.join(this.folder, product.icons), { recursive: true });
    await cp(dictionaries, path.join(this.folder, ...Resources.dictionariesSegments), { recursive: true });
    await copyFile(license, path.join(this.folder, ...Resources.licenseSegments));
    return [...new Set(sources.flatMap(t => t.source.pages))];
  }

  private async packCompanyAsync(locked: readonly LockedPackage[], windowPackages: ReadonlySet<string>): Promise<readonly CompanyPackage[]> {
    await rm(this.layout.company, { recursive: true, force: true });
    const packed: CompanyPackage[] = [];
    for (const item of locked)
      packed.push(await CompanyPackage.packAsync(item, this.root, this.layout.company, this.npm, windowPackages, this.companyArchives));
    return packed;
  }

  private async prepareThirdPartyAsync(thirdParty: readonly LockedPackage[], accepted: AcceptedLicenses, typeOnly: TypeOnlyPeers, output: Writable):
    Promise<readonly ThirdPartyPackage[]> {
    const prepared: ThirdPartyPackage[] = [];
    for (const locked of thirdParty)
      prepared.push(await ThirdPartyPackage.prepareAsync(locked, this.layout.thirdParty, this.assets.list(Resources.reviewedLicensesSegments), accepted, typeOnly, output));
    await FolderCreation.createAsync(path.dirname(this.layout.thirdPartyLicenses));
    await writeFile(this.layout.thirdPartyLicenses, prepared.map(t => t.formatNotice()).join(Resources.stageNoticeSeparator));
    return prepared;
  }

  private async listShippedAsync(): Promise<ShippedPackages> {
    const declarations = await this.modules.listBuildAsync(false, []);
    const parts = declarations.filter(t => Object.isNull(t.packageName)).flatMap(t => [t.runtimePackage, t.cliPackage]).filter(t => !Object.isNull(t));
    const packages = await new PackageCatalog(this.root).listPackagesAsync(false);
    const missing = parts.filter(t => !packages.some(u => u.name === t));
    if (missing.length > 0)
      throw new BuildException(Resources.formatStagePartsMissing(missing));
    const installed = Resources.stageEntryPackages.filter(t => !packages.some(u => u.name === t));
    const shipped = new Set<string>([...Resources.stageEntryPackages, ...parts]);
    for (const manifest of [...packages].reverse())
      if (shipped.has(manifest.name))
        manifest.dependencies.forEach(t => shipped.add(t));
    return new ShippedPackages(packages.filter(t => shipped.has(t.name)), installed);
  }

  private static refer(name: string, value: unknown): unknown {
    const reference = `${Resources.stageOverrideReferencePrefix}${name}`;
    if (Object.isString(value))
      return reference;
    const fields = new Map<string, unknown>(Object.isPlainObject(value) ? Object.entries(value) : []);
    return Object.isString(fields.get(Resources.stageOverrideSelfKey)) ? Object.fromEntries(fields.set(Resources.stageOverrideSelfKey, reference)) : value;
  }

  private static referArchives(overrides: object, archives: ReadonlyMap<string, string>): Readonly<Record<string, unknown>> {
    const fields = new Map<string, unknown>(Object.entries(overrides));
    for (const name of fields.keys())
      if (archives.has(name))
        fields.set(name, PackageStage.refer(name, fields.get(name)));
    return Object.fromEntries(fields);
  }

  private static listDependencies(dependencies: readonly StagedDependency[]): Readonly<Record<string, string>> {
    const fields = new Map<string, string>();
    for (const dependency of [...dependencies].sort((left, right) => CodePointComparer.compare(left.name, right.name)))
      fields.set(dependency.name, dependency.version);
    return Object.fromEntries(fields);
  }

  private static locateArchives(packages: readonly PackageManifest[], versions: PackageVersions, archives: BuildLayout, packed: readonly (CompanyPackage | ThirdPartyPackage)[]):
    ReadonlyMap<string, string> {
    const located = new Map<string, string>();
    for (const manifest of packages)
      located.set(manifest.name, archives.locateArchive(manifest, versions.of(manifest.name)));
    for (const item of packed)
      located.set(item.locked.name, item.file);
    return located;
  }
}
