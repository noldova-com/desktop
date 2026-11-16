/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { PackageNaming } from "../../services/packages/package-naming.ts";
import { RootManifest } from "../packages/root-manifest.ts";
import { VersionRange } from "./version-range.ts";
import type { IModuleDeclarationJson } from "../../interfaces/i-module-declaration-json.ts";
import type { IModuleSettingsFile } from "../../interfaces/i-module-settings-file.ts";
import type { ISettingsPageJson } from "../../interfaces/i-settings-page-json.ts";
import { ModuleCliCommands } from "../../services/modules/module-cli-commands.ts";
import { ModuleMenus } from "../../services/modules/module-menus.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { ModuleSettings } from "../../services/modules/module-settings.ts";
import { ModuleWebViews } from "../../services/modules/module-web-views.ts";
import { Resources } from "../../resources.ts";

export class ModuleDeclaration {
  public readonly folder: string;
  public readonly id: string;
  public readonly version: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly parts: readonly string[];
  public readonly dependencies: readonly string[];
  public readonly dependencyVersions: ReadonlyMap<string, string>;
  public readonly optionalDependencies: readonly string[];
  public readonly optionalDependencyVersions: ReadonlyMap<string, string>;
  public readonly packageName: string | null;
  public readonly contributions: ReadonlyMap<string, readonly string[]>;
  public readonly formerNames: ReadonlyMap<string, readonly string[]>;
  public readonly menus: ModuleMenus;
  public readonly settings: readonly Readonly<Record<string, unknown>>[];
  public readonly settingsPages: readonly ISettingsPageJson[];
  public readonly cliCommands: readonly Readonly<Record<string, unknown>>[];
  public readonly webViews: Readonly<Record<string, unknown>> | null;
  public readonly usesPseudoTerminals: boolean;
  public readonly switchSetting: string | null;
  public readonly platforms: readonly string[] | null;
  public readonly noldovaDesktop: VersionRange | null;
  public readonly isFixture: boolean;
  public readonly modulesPrefix: string;

  private constructor(
    folder: string,
    id: string,
    version: string,
    displayName: string,
    description: string,
    parts: readonly string[],
    dependencyVersions: ReadonlyMap<string, string>,
    optionalDependencyVersions: ReadonlyMap<string, string>,
    packageName: string | null,
    contributions: ReadonlyMap<string, readonly string[]>,
    menus: ModuleMenus,
    settings: IModuleSettingsFile,
    cliCommands: readonly Readonly<Record<string, unknown>>[],
    webViews: Readonly<Record<string, unknown>> | null,
    usesPseudoTerminals: boolean,
    switchSetting: string | null,
    platforms: readonly string[] | null,
    noldovaDesktop: VersionRange | null,
    formerNames: ReadonlyMap<string, readonly string[]>,
    isFixture: boolean,
    modulesPrefix: string = Resources.modulesPrefix) {
    this.folder = folder;
    this.id = id;
    this.version = version;
    this.displayName = displayName;
    this.description = description;
    this.parts = parts;
    this.dependencies = [...dependencyVersions.keys()];
    this.dependencyVersions = dependencyVersions;
    this.optionalDependencies = [...optionalDependencyVersions.keys()];
    this.optionalDependencyVersions = optionalDependencyVersions;
    this.packageName = packageName;
    this.contributions = contributions;
    this.formerNames = formerNames;
    this.menus = menus;
    this.settings = settings.settings;
    this.settingsPages = settings.pages;
    this.cliCommands = cliCommands;
    this.webViews = webViews;
    this.usesPseudoTerminals = usesPseudoTerminals;
    this.switchSetting = switchSetting;
    this.platforms = platforms;
    this.noldovaDesktop = noldovaDesktop;
    this.isFixture = isFixture;
    this.modulesPrefix = modulesPrefix;
  }

  public static isVersion(text: string): boolean {
    return VersionRange.isVersion(text);
  }

  public static hasDeclaration(root: string, folder: string): boolean {
    return existsSync(path.join(root, folder, Resources.moduleDeclarationFileName));
  }

  public static async readAsync(
    root: string, folder: string, isFixture: boolean, packageName: string | null = null, listedId: string = path.posix.basename(folder)): Promise<ModuleDeclaration> {
    const file = Resources.formatFolderFile(folder, Resources.moduleDeclarationFileName);
    const fail = (problem: string): BuildException => new BuildException(Resources.formatModuleFileProblem(file, problem));
    let value: JsonObject;
    try {
      value = JsonReader.parse(await readFile(path.join(root, file), Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatJsonFileUnreadable(file), new ExceptionOptions(error));
    }
    const record = new Map(Object.entries(value));
    const unknown = [...record.keys()].filter(t => !Resources.moduleDeclarationFields.includes(t));
    if (unknown.length > 0)
      throw fail(Resources.formatUnknownFields(unknown));

    const id = record.get(Resources.idField);
    if (!Object.isString(id) || id !== listedId || !Resources.moduleIdPattern.test(id) || Resources.moduleReservedIds.includes(id))
      throw fail(Resources.formatModuleIdInvalid(listedId, !Object.isNull(packageName)));
    if (Resources.windowsDeviceNames.includes(id))
      throw fail(Resources.formatModuleIdWindowsDevice(id));
    const version = record.get(Resources.versionField);
    if (!Object.isString(version) || !VersionRange.isVersion(version))
      throw fail(Resources.moduleVersionInvalid);
    const displayName = record.get(Resources.displayNameField);
    if (!Object.isString(displayName) || String.isNullOrWhitespace(displayName))
      throw fail(Resources.moduleDisplayNameMissing);
    const description = record.get(Resources.descriptionField);
    if (!Object.isString(description) || String.isNullOrWhitespace(description))
      throw fail(Resources.moduleDescriptionMissing);
    const parts = ModuleDeclaration.readList(record.get(Resources.partsField), t => Resources.moduleParts.includes(t), fail, Resources.partsField, Resources.modulePartsExpected);
    if (Object.isNull(packageName)) {
      const missing = parts.filter(t => !existsSync(path.join(root, folder, t)));
      if (missing.length > 0)
        throw fail(Resources.formatModulePartsWithoutFolder(missing));
    }
    else
      await ModuleDeclaration.checkPackageAsync(root, folder, packageName, version, parts, fail);
    const dependencyVersions = ModuleDeclaration.readVersions(record.get(Resources.dependenciesField), id, fail, Resources.dependenciesField, Resources.moduleDependsOn);
    const dependencies = [...dependencyVersions.keys()];
    const optionalDependencyVersions = record.has(Resources.optionalDependenciesField)
      ? ModuleDeclaration.readVersions(record.get(Resources.optionalDependenciesField), id, fail, Resources.moduleOptionalDependenciesLabel, Resources.moduleOptionallyDependsOn)
      : new Map<string, string>();
    const both = dependencies.filter(t => optionalDependencyVersions.has(t));
    if (both.length > 0)
      throw fail(Resources.formatModuleDependencyRepeated(both));

    const contributes = record.get(Resources.contributesField);
    if (!Object.isPlainObject(contributes))
      throw fail(Resources.moduleContributesNotObject);
    const contributions = new Map<string, readonly string[]>();
    for (const [kind, names] of Object.entries(contributes)) {
      if (kind === Resources.formerNamesField)
        continue;
      if (!Resources.moduleContributionKinds.includes(kind))
        throw fail(Resources.formatModuleUnknownKind(kind));
      contributions.set(kind, ModuleDeclaration.readNames(names, id, fail, kind));
    }
    const contributed = new Map(Object.entries(contributes));
    const formerNames = contributed.has(Resources.formerNamesField)
      ? ModuleDeclaration.readFormerNames(contributed.get(Resources.formerNamesField), contributions, fail)
      : new Map<string, readonly string[]>();
    const placeholders = contributions.get(Resources.placeholdersKind) ?? [];
    if (placeholders.length > 1)
      throw fail(Resources.modulePlaceholderRepeated);
    if (placeholders.length > 0 && !parts.includes(Resources.windowPart))
      throw fail(Resources.modulePlaceholderWithoutWindow);
    const menus = await ModuleMenus.readAsync(root, folder, id, contributions.get(Resources.menusKind) ?? []);
    const settings = await ModuleSettings.readAsync(root, folder, dependencies, contributions);
    if (settings.pages.length > 0 && !parts.includes(Resources.windowPart))
      throw fail(Resources.moduleSettingsPagesWithoutWindow);
    if ((contributions.get(Resources.cliCommandsKind) ?? []).length > 0 && !parts.includes(Resources.cliPart))
      throw fail(Resources.moduleCliCommandsWithoutCli);
    const cliCommands = await ModuleCliCommands.readAsync(root, folder, contributions);
    const webViews = await ModuleWebViews.readAsync(root, folder);
    if (!Object.isNull(webViews) && !parts.includes(Resources.windowPart))
      throw fail(Resources.moduleWebViewsWithoutWindow);
    const usesPseudoTerminals = record.has(Resources.pseudoTerminalsField) ? record.get(Resources.pseudoTerminalsField) : false;
    if (!Object.isBoolean(usesPseudoTerminals))
      throw fail(Resources.modulePseudoTerminalsNotBoolean);
    if (usesPseudoTerminals && !parts.includes(Resources.runtimePart))
      throw fail(Resources.modulePseudoTerminalsWithoutRuntime);
    const switchSetting = record.has(Resources.switchSettingField) ? ModuleDeclaration.readSwitchSetting(record.get(Resources.switchSettingField), settings.settings, fail) : null;
    const platforms = record.has(Resources.platformsField) ? ModuleDeclaration.readPlatforms(record.get(Resources.platformsField), fail) : null;
    const noldovaDesktop = record.has(Resources.noldovaDesktopField) ? ModuleDeclaration.readNoldovaDesktop(record.get(Resources.noldovaDesktopField), fail) : null;
    return new ModuleDeclaration(
      folder, id, version, displayName, description, parts, dependencyVersions, optionalDependencyVersions, packageName, contributions, menus, settings, cliCommands, webViews, usesPseudoTerminals,
      switchSetting, platforms, noldovaDesktop, formerNames, isFixture, await RootManifest.readModulePackagePrefixAsync(root));
  }

  public get file(): string {
    return Resources.formatFolderFile(this.folder, Resources.moduleDeclarationFileName);
  }

  public get runtimePackage(): string | null {
    return this.locatePackage(Resources.runtimePart);
  }

  public get cliPackage(): string | null {
    return this.locatePackage(Resources.cliPart);
  }

  public get windowEntry(): string | null {
    if (!this.parts.includes(Resources.windowPart))
      return null;
    return Object.isNull(this.packageName) ? Resources.formatFolderFile(this.folder, Resources.moduleWindowEntry) : Resources.formatPackageSubpath(this.packageName, Resources.windowPart);
  }

  public toJson(): IModuleDeclarationJson {
    return {
      id: this.id,
      version: this.version,
      displayName: this.displayName,
      description: this.description,
      dependencies: Object.fromEntries(this.dependencyVersions),
      ...this.optionalDependencyVersions.size === 0 ? {} : { optionalDependencies: Object.fromEntries(this.optionalDependencyVersions) },
      runtimePackage: this.runtimePackage,
      cliPackage: this.cliPackage,
      contributes: Object.fromEntries([...this.contributions].map(([kind, names]) => [kind, [...names]])),
      ...this.formerNames.size === 0 ? {} : { formerNames: Object.fromEntries([...this.formerNames].map(([name, formers]) => [name, [...formers]])) },
      settings: [...this.settings],
      cliCommands: [...this.cliCommands],
      ...Object.isNull(this.webViews) ? {} : { webViews: this.webViews },
      ...this.usesPseudoTerminals ? { pseudoTerminals: true } : {},
      ...Object.isNull(this.switchSetting) ? {} : { switchSetting: this.switchSetting },
      ...Object.isNull(this.platforms) ? {} : { platforms: [...this.platforms] },
      ...Object.isNull(this.noldovaDesktop) ? {} : { noldovaDesktop: this.noldovaDesktop.toString() }
    };
  }

  private static readSwitchSetting(value: unknown, settings: readonly Readonly<Record<string, unknown>>[], fail: (problem: string) => BuildException): string {
    const setting = settings.find(t => t[Resources.nameField] === value);
    if (!Object.isString(value) || Object.isUndefined(setting))
      throw fail(Resources.moduleSwitchSettingUnknown);
    if (JsonReader.fromValue(setting).readObject(Resources.typeField).readString(Resources.kindField) !== Resources.booleanType)
      throw fail(Resources.formatModuleSwitchSettingNotBoolean(value));
    const scopes = setting[Resources.scopesField];
    if (setting[Resources.localityField] !== Resources.sharedLocality || !Array.isArray(scopes) || scopes.length > 0)
      throw fail(Resources.formatModuleSwitchSettingNotShared(value));
    return value;
  }

  private static readPlatforms(value: unknown, fail: (problem: string) => BuildException): readonly string[] {
    const platforms = ModuleDeclaration.readList(value, t => Resources.modulePlatforms.includes(t), fail, Resources.platformsField, Resources.modulePlatformsExpected);
    if (platforms.length === 0)
      throw fail(Resources.modulePlatformsEmpty);
    return platforms;
  }

  private static readNoldovaDesktop(value: unknown, fail: (problem: string) => BuildException): VersionRange {
    const range = Object.isString(value) ? VersionRange.parse(value) : null;
    if (Object.isNull(range))
      throw fail(Resources.formatModuleNoldovaDesktopInvalid(value));
    return range;
  }

  private static readVersions(value: unknown, id: string, fail: (problem: string) => BuildException, field: string, relation: string): ReadonlyMap<string, string> {
    if (!Object.isPlainObject(value))
      throw fail(Resources.formatModuleVersionsNotObject(field));
    const versions = new Map<string, string>();
    for (const [dependency, version] of Object.entries(value)) {
      if (!Resources.moduleIdPattern.test(dependency) || dependency === id)
        throw fail(Resources.formatModuleDependencyNotModule(relation, dependency));
      if (!Object.isString(version) || !ModuleDeclaration.isVersion(version))
        throw fail(Resources.formatModuleDependencyVersionInvalid(version, dependency));
      versions.set(dependency, version);
    }
    return versions;
  }

  private static async checkPackageAsync(
    root: string, folder: string, packageName: string, version: string, parts: readonly string[], fail: (problem: string) => BuildException): Promise<void> {
    const manifestFile = Resources.formatFolderFile(folder, Resources.packageManifestFileName);
    let manifest: JsonObject;
    try {
      manifest = JsonReader.parse(await readFile(path.join(root, folder, Resources.packageManifestFileName), Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatJsonFileUnreadable(manifestFile), new ExceptionOptions(error));
    }
    const record = new Map(Object.entries(manifest));
    if (record.get(Resources.nameField) !== packageName)
      throw new BuildException(Resources.formatModulePackageNameMismatch(manifestFile, packageName, record.get(Resources.nameField)));
    if (record.get(Resources.versionField) !== version)
      throw fail(Resources.formatModulePackageVersionMismatch(packageName, record.get(Resources.versionField)));
    const exports = record.get(Resources.manifestExportsField);
    const exported = Object.isPlainObject(exports) ? Object.keys(exports) : [];
    const missing = parts.filter(t => !exported.includes(Resources.formatPackageExportPath(t)));
    if (missing.length > 0)
      throw fail(Resources.formatModulePartsNotExported(packageName, missing));
    const undeclared = Resources.moduleParts.filter(t => !parts.includes(t) && exported.includes(Resources.formatPackageExportPath(t)));
    if (undeclared.length > 0)
      throw fail(Resources.formatModulePartsNotDeclared(undeclared));
  }

  private static readList(value: unknown, isValid: (item: string) => boolean, fail: (problem: string) => BuildException, field: string, expected: string): readonly string[] {
    if (!Array.isArray(value) || !value.every(t => Object.isString(t) && isValid(t)) || new Set(value).size < value.length)
      throw fail(Resources.formatModuleListInvalid(field, expected));
    return value.map(t => String(t));
  }

  private static readNames(value: unknown, id: string, fail: (problem: string) => BuildException, kind: string): readonly string[] {
    if (kind === Resources.toolsKind)
      return ModuleDeclaration.readToolNames(value, id, fail);
    const isOwned = (name: string): boolean =>
      name.startsWith(Resources.formatQualifiedPrefix(id)) && Resources.camelCaseNamePattern.test(name.slice(id.length + 1));
    if (!Array.isArray(value) || !value.every(t => Object.isString(t) && isOwned(t)))
      throw fail(Resources.formatModuleNamesInvalid(kind, id));
    return value.map(t => String(t));
  }

  private static readFormerNames(value: unknown, contributions: ReadonlyMap<string, readonly string[]>, fail: (problem: string) => BuildException): ReadonlyMap<string, readonly string[]> {
    if (!Object.isPlainObject(value))
      throw fail(Resources.moduleFormerNamesNotObject);
    const renamed = [...contributions.get(Resources.commandsKind) ?? [], ...contributions.get(Resources.documentsKind) ?? []];
    const formerNames = new Map<string, readonly string[]>();
    for (const [name, formers] of Object.entries(value)) {
      if (!renamed.includes(name))
        throw fail(Resources.formatModuleFormerNamesUndeclared(name));
      if (!Array.isArray(formers) || formers.length === 0 || new Set(formers).size < formers.length
        || !formers.every(t => Object.isString(t) && t !== name && Resources.qualifiedNamePattern.test(t)))
        throw fail(Resources.formatModuleFormerNamesInvalid(name));
      formerNames.set(name, formers.map(t => String(t)));
    }
    return formerNames;
  }

  private static readToolNames(value: unknown, id: string, fail: (problem: string) => BuildException): readonly string[] {
    const prefixes = Resources.formatModuleToolPrefixes(id);
    const isOwned = (name: string): boolean =>
      Resources.moduleToolPattern.test(name) && prefixes.some(t => name.startsWith(t) && name.length > t.length);
    return ModuleDeclaration.readList(value, isOwned, fail, Resources.toolsKind, Resources.formatModuleToolNamesExpected(prefixes));
  }

  private locatePackage(part: string): string | null {
    if (!this.parts.includes(part))
      return null;
    return Object.isNull(this.packageName) ? PackageNaming.nameModulePackage(this.id, part, this.isFixture, this.modulesPrefix) : Resources.formatPackageSubpath(this.packageName, part);

  }
}
