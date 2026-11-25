/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonValue } from "@noldova/context.json";

import { DependencyOrder } from "../ordering/dependency-order.ts";
import { InstalledPackages } from "../packages/installed-packages.ts";
import { PackageNaming } from "../packages/package-naming.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import type { IFixturePackage } from "../../interfaces/i-fixture-package.ts";
import type { IListedModule } from "../../interfaces/i-listed-module.ts";
import { ModuleDeclaration } from "../../models/modules/module-declaration.ts";
import { VersionRange } from "../../models/modules/version-range.ts";
import { ModuleInventory } from "../../models/modules/module-inventory.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { FileErrors } from "../files/file-errors.ts";
import { TextFile } from "../files/text-file.ts";
import { Resources } from "../../resources.ts";

export class ModuleCatalog {

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async readAllAsync(): Promise<ModuleInventory> {
    const folders = await this.listFoldersAsync();
    const results = await Promise.allSettled(folders.map(([folder, isFixture]) => ModuleDeclaration.readAsync(this.root, folder, isFixture)));
    return new ModuleInventory(
      results.filter(t => t.status === "fulfilled").map(t => t.value),
      results.filter(t => t.status === "rejected").map(t => String(t.reason.message)));
  }

  public async hasWebViewsAsync(): Promise<boolean> {
    return (await this.listBuildAsync(false, [])).some(t => !Object.isNull(t.webViews));
  }

  public async listBuildAsync(includeFixtures: boolean, excluded: readonly string[]): Promise<readonly ModuleDeclaration[]> {
    const manifest = await this.readManifestAsync();
    const listed = ModuleCatalog.readList(manifest);
    ModuleCatalog.checkPermissionsModule(manifest, listed);
    const declarations: ModuleDeclaration[] = [];
    for (const { id, packageName } of listed)
      declarations.push(await this.readListedAsync(id, packageName, Object.isNull(packageName) ? null : ModuleCatalog.readPin(manifest, id, packageName), false));
    if (includeFixtures) {
      for (const [folder] of (await this.listFoldersAsync()).filter(([, isFixture]) => isFixture))
        declarations.push(await ModuleDeclaration.readAsync(this.root, folder, true));
      for (const fixture of await this.listFixturePackagesAsync())
        declarations.push(await this.readListedAsync(fixture.id, fixture.packageName, fixture.version, true));
    }

    const ids = new Set(declarations.map(t => t.id));
    if (ids.size < declarations.length)
      throw new BuildException(Resources.formatCatalogIdsRepeated(declarations.map(t => t.folder)));
    ModuleCatalog.checkNames(declarations);
    ModuleCatalog.checkFormerNames(declarations);
    const absent = excluded.filter(t => !ids.has(t));
    if (absent.length > 0)
      throw new BuildException(Resources.formatCatalogExcludedAbsent(absent));
    for (const id of excluded)
      ids.delete(id);
    const included = declarations.filter(t => ids.has(t.id));
    await this.checkNoldovaDesktopAsync(included);
    for (const declaration of included) {
      const missing = declaration.dependencies.filter(t => !ids.has(t));
      if (missing.length > 0)
        throw new BuildException(Resources.formatCatalogDependenciesMissing(declaration.id, missing));
      for (const [dependency, needed] of declaration.dependencyVersions) {
        const version = String(included.find(t => t.id === dependency)?.version);
        if (version !== needed)
          throw new BuildException(Resources.formatCatalogDependencyVersion(declaration.id, dependency, needed, version));
      }
      for (const [dependency, needed] of declaration.optionalDependencyVersions) {
        const present = included.find(t => t.id === dependency);
        if (!Object.isUndefined(present) && present.version !== needed)
          throw new BuildException(Resources.formatCatalogOptionalDependencyVersion(declaration.id, dependency, needed, present.version));
      }
    }
    const ordered = new DependencyOrder(included, t => t.id, t => [...t.dependencies, ...t.optionalDependencies.filter(u => ids.has(u))])
      .sort(t => new BuildException(Resources.formatCatalogCycle(t)));
    ModuleCatalog.checkMenus(ordered);
    ModuleCatalog.checkPlaceholders(ordered);
    ModuleCatalog.checkSettingsPages(ordered);
    return ordered;
  }

  public async readNoldovaDesktopVersionAsync(): Promise<string | null> {
    return (await this.readBuiltVersionsAsync()).get(Resources.desktopRuntimePackage) ?? await this.readInstalledVersionAsync(Resources.desktopRuntimePackage);
  }

  public async listFixturePackagesAsync(): Promise<readonly IFixturePackage[]> {
    const absolute = path.join(this.root, Resources.modulePackageFixturesFolder);
    const names = existsSync(absolute) ? (await readdir(absolute, { withFileTypes: true })).filter(t => t.isDirectory()).map(t => t.name).sort() : [];
    const fixtures: IFixturePackage[] = [];
    for (const name of names) {
      const folder = Resources.formatFolderFile(Resources.modulePackageFixturesFolder, name);
      if (!ModuleDeclaration.hasDeclaration(this.root, folder))
        continue;
      const packageName = PackageNaming.nameFixturePackage(folder.slice(Resources.moduleFixtureFolder.length + 1));
      fixtures.push({ id: name, packageName, version: await this.readFixtureVersionAsync(folder) });
    }
    return fixtures;
  }

  private async readListedAsync(id: string, packageName: string | null, pin: string | null, isFixture: boolean): Promise<ModuleDeclaration> {
    const folder = Object.isNull(packageName) ? Resources.formatFolderFile(Resources.modulesSourceFolder, id) : Resources.formatFolderFile(Resources.nodeModulesFolder, packageName);
    if (!ModuleDeclaration.hasDeclaration(this.root, folder))
      throw new BuildException(Resources.formatCatalogDeclarationMissing(id, folder, !Object.isNull(packageName)));
    if (Object.isNull(packageName))
      return ModuleDeclaration.readAsync(this.root, folder, isFixture, null, id);
    await this.checkInstalledAsync(id, packageName, String(pin));
    const declaration = await ModuleDeclaration.readAsync(this.root, folder, isFixture, packageName, id);
    await this.checkPeersAsync(declaration);
    await this.checkOneCopyAsync(declaration);
    await this.checkWindowPackageAsync(declaration);
    return declaration;
  }

  private async readFixtureVersionAsync(folder: string): Promise<string> {
    const file = Resources.formatFolderFile(folder, Resources.moduleDeclarationFileName);
    let declaration: JsonReader;
    try {
      declaration = JsonReader.parse(await readFile(path.join(this.root, file), Resources.textEncoding));
    }
    catch (error) {
      throw new BuildException(Resources.formatJsonFileUnreadable(file), new ExceptionOptions(error));
    }
    try {
      return declaration.readString(Resources.versionField);
    }
    catch (error) {
      throw new BuildException(Resources.formatCatalogFixtureVersionMissing(file), new ExceptionOptions(error));
    }
  }

  private static checkMenus(declarations: readonly ModuleDeclaration[]): void {
    const byId = new Map(declarations.map(t => [t.id, t]));
    for (const declaration of declarations) {
      const reachable = [declaration, ...declaration.dependencies.map(t => byId.get(t)).filter(t => !Object.isUndefined(t))];
      declaration.menus.checkReferences(
        declaration.id,
        new Set([...Resources.shellMenuPlaces, ...reachable.flatMap(t => t.menus.places.map(u => u.name))]),
        new Set(reachable.flatMap(t => t.menus.places.filter(u => !Object.isNull(u.toolbar)).map(u => u.name))),
        new Set(reachable.flatMap(t => t.contributions.get(Resources.commandsKind) ?? [])));
    }
  }

  private static checkPlaceholders(declarations: readonly ModuleDeclaration[]): void {
    const placeholders = declarations.flatMap(t => (t.contributions.get(Resources.placeholdersKind) ?? []).map(u => Resources.formatNameInFile(u, t.file)));
    if (placeholders.length > 1)
      throw new BuildException(Resources.formatCatalogPlaceholdersRepeated(placeholders));
  }

  private static checkSettingsPages(declarations: readonly ModuleDeclaration[]): void {
    const pages = declarations.flatMap(t => t.settingsPages.map(u => ({ title: u.title, moduleId: t.id, owner: Resources.formatNameInFile(u.name, t.file) })));
    const repeated = pages.filter((t, index) => Resources.shellSettingsPages.includes(t.title) || pages.findIndex(u => u.title === t.title) !== index
      || declarations.some(u => !u.dependencies.includes(t.moduleId) && u.settings.some(v => String(v[Resources.pageField]) === t.title)));
    if (repeated.length > 0)
      throw new BuildException(Resources.formatCatalogSettingsPagesRepeated(repeated.map(t => [t.title, t.owner] as const)));

  }

  private async readManifestAsync(): Promise<JsonReader> {
    try {
      return JsonReader.parse(await readFile(path.join(this.root, Resources.packageManifestFileName), Resources.textEncoding));
    }
    catch (error) {
      throw new BuildException(Resources.moduleListRequired, new ExceptionOptions(error));
    }
  }

  private static readList(manifest: JsonReader): readonly IListedModule[] {
    let modules: JsonValue;
    try {
      modules = manifest.readObject(Resources.desktopField).readValue(Resources.modulesField);
    }
    catch (error) {
      throw new BuildException(Resources.moduleListRequired, new ExceptionOptions(error));
    }
    if (!Array.isArray(modules))
      throw new BuildException(Resources.moduleListRequired);
    const listed = modules.map((t: unknown) => ModuleCatalog.readEntry(t));
    if (new Set(listed.map(t => t.id)).size < listed.length || new Set(listed.map(t => t.packageName).filter(t => !Object.isNull(t))).size < listed.filter(t => !Object.isNull(t.packageName)).length)
      throw new BuildException(Resources.moduleListRequired);
    return listed;
  }

  private static checkPermissionsModule(manifest: JsonReader, listed: readonly IListedModule[]): void {
    const desktop = manifest.readObject(Resources.desktopField);
    const product = desktop.hasField(Resources.productField) ? desktop.readObject(Resources.productField) : JsonReader.fromValue({});
    const name = product.hasField(Resources.permissionsModuleField) ? product.readValue(Resources.permissionsModuleField) : undefined;
    if (!Object.isUndefined(name) && !listed.some(t => t.id === name))
      throw new BuildException(Resources.formatCatalogPermissionsModuleInvalid(name));
  }

  private static readEntry(entry: unknown): IListedModule {
    if (Object.isString(entry))
      return { id: entry, packageName: null };
    if (!Object.isPlainObject(entry))
      throw new BuildException(Resources.moduleListRequired);
    const record = new Map(Object.entries(entry));
    const id = record.get(Resources.idField);
    const packageName = record.get(Resources.packageField);
    if (record.size !== Resources.moduleListEntryFieldCount || !Object.isString(id) || !Object.isString(packageName) || !Resources.packageNamePattern.test(packageName))
      throw new BuildException(Resources.moduleListRequired);
    return { id, packageName };
  }

  private static checkNames(declarations: readonly ModuleDeclaration[]): void {
    const places = new Map<string, string[]>();
    for (const declaration of declarations)
      for (const [kind, names] of declaration.contributions)
        for (const name of names)
          places.set(name, [...places.get(name) ?? [], Resources.formatContributionPlace(declaration.file, kind)]);
    const repeated = [...places].filter(([, files]) => files.length > 1);
    if (repeated.length > 0)
      throw new BuildException(Resources.formatCatalogNamesRepeated(repeated));
  }

  private static checkFormerNames(declarations: readonly ModuleDeclaration[]): void {
    const places = new Map<string, string[]>();
    for (const declaration of declarations)
      for (const formers of declaration.formerNames.values())
        for (const former of formers)
          places.set(former, [...places.get(former) ?? [], Resources.formatContributionPlace(declaration.file, Resources.formerNamesField)]);
    const repeated = [...places].filter(([, files]) => files.length > 1);
    if (repeated.length > 0)
      throw new BuildException(Resources.formatCatalogFormerNamesRepeated(repeated));
    const current = new Set(declarations.flatMap(t => [...t.contributions.values()].flat()));
    const taken = [...places].filter(([name]) => current.has(name));
    if (taken.length > 0)
      throw new BuildException(Resources.formatCatalogFormerNamesCurrent(taken));
  }

  private static readPin(manifest: JsonReader, id: string, packageName: string): string {
    let pin: string;
    try {
      pin = manifest.readObject(Resources.dependenciesField).readString(packageName);
    }
    catch (error) {
      throw new BuildException(Resources.formatCatalogPinMissing(id, packageName), new ExceptionOptions(error));
    }
    if (!ModuleDeclaration.isVersion(pin))
      throw new BuildException(Resources.formatCatalogPinMissing(id, packageName));
    return pin;
  }

  private async checkInstalledAsync(id: string, packageName: string, pin: string): Promise<void> {
    const installed = await this.readInstalledVersionAsync(packageName);
    if (installed !== pin)
      throw new BuildException(Resources.formatCatalogInstalledMismatch(id, packageName, pin, installed));
  }

  private async checkPeersAsync(declaration: ModuleDeclaration): Promise<void> {
    const folder = path.join(this.root, declaration.folder);
    const meta = await ModuleCatalog.readManifestFieldAsync(folder, Resources.peerDependenciesMetaField);
    let built: ReadonlyMap<string, string> | null = null;
    for (const [peer, needed] of Object.entries((await ModuleCatalog.readManifestFieldAsync(folder, Resources.peerDependenciesField)).toJson())) {
      if (PackageNaming.isWindow(peer))
        throw new BuildException(Resources.formatCatalogWindowPeer(declaration.id, declaration.packageName, peer));
      const isOwn = PackageNaming.isOwn(peer, declaration.modulesPrefix);
      if (isOwn)
        built ??= await this.readBuiltVersionsAsync();
      const builtVersion = isOwn ? built?.get(peer) : undefined;
      const version = builtVersion ?? await this.readInstalledVersionAsync(peer);
      ModuleCatalog.checkPeer(
        declaration,
        Resources.formatCatalogPackageSubject(declaration.id, declaration.packageName),
        peer,
        needed,
        version,
        ModuleCatalog.isOptional(meta, peer),
        Object.isUndefined(builtVersion) ? Resources.catalogAppHolder : Resources.catalogBuildHolder,
        false);
    }
  }

  private async checkOneCopyAsync(declaration: ModuleDeclaration): Promise<void> {
    const start = path.join(this.root, declaration.folder);
    const windowPackage = ModuleCatalog.nameWindowPackage(declaration);
    const visited = new Set<string>();
    const pending: (readonly [string, boolean])[] = [[start, false]];
    for (let item = pending.pop(); !Object.isUndefined(item); item = pending.pop()) {
      const [folder, isWindowSide] = item;
      const key = Resources.formatWalkKey(folder, isWindowSide);
      if (visited.has(key))
        continue;
      visited.add(key);
      for (const name of await InstalledPackages.readDependencyNamesAsync(folder)) {
        const resolved = InstalledPackages.resolve(this.root, folder, name);
        const installedName = Object.isNull(resolved) ? name : await InstalledPackages.readNameAsync(resolved, name);
        const isWindowPart = folder === start && name === windowPackage && installedName === name;
        if (!isWindowPart && (PackageNaming.isShared(name) || PackageNaming.isShared(installedName)))
          throw ModuleCatalog.failOneCopy(declaration, Resources.formatCatalogDependencyListed(this.describe(folder), name, installedName));
        if (!isWindowSide && !isWindowPart && (PackageNaming.isAngular(installedName) || (!Object.isNull(resolved) && await ModuleCatalog.isAngularAsync(resolved))))
          throw new BuildException(Resources.formatCatalogAngularDependency(
            declaration.id, declaration.packageName, this.describe(folder), name, PackageNaming.nameWindowPackage(String(declaration.packageName))));
        if (!Object.isNull(resolved))
          pending.push([resolved, isWindowSide || isWindowPart]);
      }
    }
    for (const [name, folder] of await InstalledPackages.listAsync(start))
      if (PackageNaming.isShared(name))
        throw ModuleCatalog.failOneCopy(declaration, Resources.formatCatalogOwnCopy(name, this.describe(folder)));
  }

  private async checkWindowPackageAsync(declaration: ModuleDeclaration): Promise<void> {
    const name = ModuleCatalog.nameWindowPackage(declaration);
    const pin = Object.isNull(name) ? undefined : (await ModuleCatalog.readManifestFieldAsync(path.join(this.root, declaration.folder), Resources.dependenciesField)).toJson()[name];
    if (Object.isNull(name) || Object.isUndefined(pin))
      return;
    const folder = InstalledPackages.resolve(this.root, path.join(this.root, declaration.folder), name);
    const subject = Resources.formatCatalogWindowSubject(declaration.id, name);
    if (!Object.isString(pin) || !ModuleDeclaration.isVersion(pin) || Object.isNull(folder) || await InstalledPackages.readVersionAsync(folder) !== pin)
      throw new BuildException(Resources.formatCatalogWindowPinInvalid(subject, declaration.packageName));
    if (!await ModuleCatalog.isAngularAsync(folder))
      throw new BuildException(Resources.formatCatalogWindowNotAngular(subject));
    const meta = await ModuleCatalog.readManifestFieldAsync(folder, Resources.peerDependenciesMetaField);
    let built: ReadonlyMap<string, string> | null = null;
    for (const [peer, needed] of Object.entries((await ModuleCatalog.readManifestFieldAsync(folder, Resources.peerDependenciesField)).toJson())) {
      if (PackageNaming.isWorkspaceOnly(peer) && !ModuleCatalog.isOptional(meta, peer))
        throw new BuildException(Resources.formatCatalogWindowPeerNotOptional(subject, peer));
      const isOwn = PackageNaming.isOwn(peer, declaration.modulesPrefix);
      if (isOwn)
        built ??= await this.readBuiltVersionsAsync();
      const builtVersion = isOwn ? built?.get(peer) : undefined;
      const version = builtVersion ?? await this.readWorkspaceVersionAsync(peer);
      ModuleCatalog.checkPeer(declaration, subject, peer, needed, version, false, Object.isUndefined(builtVersion) ? Resources.catalogWorkspaceHolder : Resources.catalogBuildHolder, true);
    }
  }

  private static checkPeer(
    declaration: ModuleDeclaration, subject: string, peer: string, needed: unknown, version: string | null, isOptional: boolean, holder: string, isWindowPart: boolean): void {
    const isAngular = isWindowPart && PackageNaming.isAngular(peer);
    const isOrganization = PackageNaming.isNoldova(peer) && !PackageNaming.isShared(peer);
    const range = Object.isString(needed) && (PackageNaming.isNoldova(peer) || isAngular) ? VersionRange.parse(needed) : null;
    if (isAngular && !Object.isNull(range) && !range.isFollowing())
      throw new BuildException(Resources.formatCatalogAngularPeerRange(subject, peer, needed, range.minimum));
    if (isOrganization && !Object.isNull(range) && !range.isFollowing())
      throw new BuildException(Resources.formatCatalogOrganizationPeerRange(subject, peer, needed, range.minimum));
    const isExact = Object.isString(needed) && ModuleDeclaration.isVersion(needed);
    const noldovaDesktop = Object.isNull(declaration.noldovaDesktop) ? null : declaration.noldovaDesktop.toString();
    if (PackageNaming.isCore(peer) && (Object.isNull(noldovaDesktop) ? !Object.isNull(range) : needed !== noldovaDesktop))
      throw new BuildException(Object.isNull(noldovaDesktop)
        ? Resources.formatCatalogCoreRangeUnnamed(subject, peer, needed, declaration.file)
        : Resources.formatCatalogCoreRangeMismatch(subject, peer, needed, declaration.file, noldovaDesktop));
    if ((isExact || !Object.isNull(range)) && Object.isNull(version) && isOptional)
      return;
    if (Object.isNull(range) ? !isExact || needed !== version : Object.isNull(version) || !range.includes(version))
      throw new BuildException(Resources.formatCatalogPeerMismatch(subject, peer, needed, holder, version));
  }

  private async checkNoldovaDesktopAsync(declarations: readonly ModuleDeclaration[]): Promise<void> {
    if (declarations.every(t => Object.isNull(t.noldovaDesktop)))
      return;
    const version = await this.readNoldovaDesktopVersionAsync();
    const outside = declarations.flatMap(t => Object.isNull(t.noldovaDesktop) || (!Object.isNull(version) && t.noldovaDesktop.includes(version))
      ? []
      : [Resources.formatCatalogOutsideRange(t.id, t.version, t.noldovaDesktop.toString())]);
    if (outside.length > 0)
      throw new BuildException(Resources.formatCatalogNoldovaDesktopOutside(outside, version));
  }

  private static isOptional(meta: JsonReader, peer: string): boolean {
    return meta.hasField(peer) && meta.readObject(peer).toJson()[Resources.optionalField] === true;
  }

  private static nameWindowPackage(declaration: ModuleDeclaration): string | null {
    return Object.isNull(declaration.packageName) || Object.isNull(declaration.windowEntry) ? null : PackageNaming.nameWindowPackage(declaration.packageName);
  }

  private static async isAngularAsync(folder: string): Promise<boolean> {
    return (await InstalledPackages.readDependencyNamesAsync(folder, Resources.catalogPeerFields)).includes(Resources.angularCorePackage);
  }

  private static async readManifestFieldAsync(folder: string, field: string): Promise<JsonReader> {
    const manifest = JsonReader.parse(await TextFile.readAsync(path.join(folder, Resources.packageManifestFileName)));
    return manifest.hasField(field) ? manifest.readObject(field) : JsonReader.fromValue({});
  }

  private async readWorkspaceVersionAsync(packageName: string): Promise<string | null> {
    const folder = path.join(this.root, Resources.nodeModulesFolder, ...packageName.split(Resources.pathSegmentSeparator));
    return existsSync(path.join(folder, Resources.packageManifestFileName)) ? await InstalledPackages.readVersionAsync(folder) : null;
  }

  private static failOneCopy(declaration: ModuleDeclaration, cause: string): BuildException {
    return new BuildException(Resources.formatCatalogSecondCopy(declaration.id, declaration.packageName, cause));
  }

  private describe(folder: string): string {
    return path.relative(this.root, folder).split(path.sep).join(Resources.pathSegmentSeparator);
  }

  private async readBuiltVersionsAsync(): Promise<ReadonlyMap<string, string>> {
    const productVersion = (await RootManifest.readAsync(this.root)).productVersion;
    const versions = new Map<string, string>();
    for (const name of await this.listSourcePackagesAsync())
      versions.set(name, productVersion);
    for (const declaration of (await this.readAllAsync()).declarations)
      for (const part of declaration.parts)
        versions.set(PackageNaming.nameModulePackage(declaration.id, part, declaration.isFixture, declaration.modulesPrefix), declaration.version);
    return versions;
  }

  private async listSourcePackagesAsync(): Promise<readonly string[]> {
    const source = path.join(this.root, Resources.sourceFolder);
    const folders = existsSync(source) ? (await readdir(source, { withFileTypes: true })).filter(t => t.isDirectory() && !t.name.endsWith(Resources.windowAppSuffix)).map(t => t.name) : [];
    return folders
      .filter(t => !Object.isNull(PackageNaming.locatePackageFolder(Resources.formatFolderFile(Resources.formatFolderFile(Resources.sourceFolder, t), Resources.packageManifestFileName))))
      .map(t => PackageNaming.nameSourcePackage(Resources.formatFolderFile(Resources.sourceFolder, t)));
  }

  private async readInstalledVersionAsync(packageName: string): Promise<string | null> {
    try {
      return JsonReader.parse(await readFile(path.join(this.root, Resources.nodeModulesFolder, packageName, Resources.packageManifestFileName), Resources.textEncoding))
        .readString(Resources.versionField);
    }
    catch (error) {
      if (!(error instanceof JsonException || FileErrors.isMissing(error)))
        throw error;
      return null;
    }
  }

  private async listFoldersAsync(): Promise<readonly (readonly [string, boolean])[]> {
    const folders: (readonly [string, boolean])[] = [];
    for (const [parent, isFixture] of [[Resources.modulesSourceFolder, false], [Resources.moduleFixtureFolder, true]] as const) {
      const absolute = path.join(this.root, parent);
      const names = existsSync(absolute) ? (await readdir(absolute, { withFileTypes: true })).filter(t => t.isDirectory()).map(t => t.name).sort() : [];
      for (const name of names)
        if (ModuleDeclaration.hasDeclaration(this.root, Resources.formatFolderFile(parent, name)))
          folders.push([Resources.formatFolderFile(parent, name), isFixture]);

    }
    return folders;
  }
}
