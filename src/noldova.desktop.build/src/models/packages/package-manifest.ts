/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { PackageNaming } from "../../services/packages/package-naming.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { RootManifest } from "./root-manifest.ts";
import { Resources } from "../../resources.ts";

export class PackageManifest {
  public readonly directory: string;
  public readonly name: string;
  public readonly dependencies: readonly string[];
  public readonly coverageExclusions: string;
  public readonly peerDependencies: readonly string[];
  public readonly windowsAddons: readonly string[];
  public readonly posixAddons: readonly string[];
  public readonly externalDependencies: ReadonlyMap<string, string>;
  public readonly files: readonly string[] | null;
  public readonly optionalPeers: readonly string[];

  public constructor(directory: string, name: string, dependencies: readonly string[], coverageExclusions: string = Resources.packageNoCoverageExclusions, peerDependencies: readonly string[] = [],
    windowsAddons: readonly string[] = [], posixAddons: readonly string[] = [], externalDependencies: ReadonlyMap<string, string> = new Map(), files: readonly string[] | null = null,
    modulesPrefix: string = Resources.modulesPrefix, optionalPeers: readonly string[] = []) {
    const expected = PackageManifest.formatName(directory, modulesPrefix);
    if (name !== expected)
      throw new BuildException(PackageManifest.isFixtureDirectory(directory)
        ? Resources.formatFixturePackageMisnamed(directory, expected)
        : Resources.formatSourcePackageMisnamed(directory, expected));

    this.directory = directory;
    this.name = name;
    this.dependencies = [...dependencies].sort();
    this.coverageExclusions = coverageExclusions;
    this.peerDependencies = [...peerDependencies].sort();
    this.windowsAddons = windowsAddons;
    this.posixAddons = posixAddons;
    this.externalDependencies = externalDependencies;
    this.files = files;
    this.optionalPeers = [...optionalPeers].sort();
  }

  public static async readAsync(root: string, directory: string): Promise<PackageManifest> {
    const file = Resources.formatFolderPath(directory, Resources.packageManifestFileName);
    let manifest: JsonReader;
    try {
      manifest = JsonReader.parse(await readFile(path.join(root, file), Resources.textEncoding));
    }
    catch (error) {
      throw new BuildException(Resources.formatManifestUnreadable(file), new ExceptionOptions(error));
    }
    let packageName: string;
    try {
      packageName = manifest.readString(Resources.manifestNameField);
    }
    catch (error) {
      throw new BuildException(Resources.formatManifestNameMissing(file), new ExceptionOptions(error));
    }
    if (manifest.toJson()[Resources.manifestVersionField] !== Resources.packageVersionPlaceholder)
      throw new BuildException(Resources.formatManifestVersionUnstamped(file));

    const dependencies = manifest.hasField(Resources.manifestDependenciesField) ? manifest.readValue(Resources.manifestDependenciesField) : {};
    if (!Object.isPlainObject(dependencies))
      throw new BuildException(Resources.formatManifestDependenciesInvalid(file));
    const peers = manifest.hasField(Resources.peerDependenciesField) ? manifest.readValue(Resources.peerDependenciesField) : {};
    if (!Object.isPlainObject(peers))
      throw new BuildException(Resources.formatManifestPeersInvalid(file));
    let optionalPeers: readonly string[];
    try {
      const peersMeta = manifest.hasField(Resources.peerDependenciesMetaField) ? manifest.readObject(Resources.peerDependenciesMetaField) : JsonReader.fromValue({});
      optionalPeers = Object.keys(peersMeta.toJson()).filter(t => {
        const meta = peersMeta.readObject(t);
        return meta.hasField(Resources.optionalField) && meta.readBoolean(Resources.optionalField);
      });
    }
    catch (error) {
      throw new BuildException(Resources.formatManifestPeersMetaInvalid(file), new ExceptionOptions(error));
    }
    const modulesPrefix = await RootManifest.readModulePackagePrefixAsync(root);
    const own = [...Object.entries(dependencies), ...Object.entries(peers)].filter(([name]) => PackageNaming.isOwn(name, modulesPrefix));
    const unpinned = Object.entries(dependencies).filter(([name, version]) => !PackageNaming.isOwn(name, modulesPrefix) && !Object.isString(version)).map(([name]) => name);
    if (unpinned.length > 0)
      throw new BuildException(Resources.formatManifestUnpinned(file, unpinned));
    const unstamped = own.filter(([, version]) => version !== Resources.packageVersionPlaceholder).map(([name]) => name);
    if (unstamped.length > 0)
      throw new BuildException(Resources.formatManifestOwnUnstamped(file, unstamped));

    let settings: JsonReader;
    try {
      settings = manifest.hasField(Resources.manifestNoldovaField) ? manifest.readObject(Resources.manifestNoldovaField) : JsonReader.fromValue({});
    }
    catch (error) {
      throw new BuildException(Resources.formatManifestSettingsInvalid(file), new ExceptionOptions(error));
    }
    const exclusions = settings.hasField(Resources.coverageExclusionsField) ? settings.readValue(Resources.coverageExclusionsField) : [];
    if (!Array.isArray(exclusions))
      throw new BuildException(Resources.formatManifestExclusionsInvalid(file));
    const windowsAddons = PackageManifest.readAddons(file, settings, Resources.windowsAddonsField, Resources.addonKindWindows);
    const posixAddons = PackageManifest.readAddons(file, settings, Resources.posixAddonsField, Resources.addonKindPosix);
    const files = manifest.hasField(Resources.manifestFilesField) ? manifest.readValue(Resources.manifestFilesField) : null;
    if (!Object.isNull(files) && (!Array.isArray(files) || !files.every(t => Object.isString(t))))
      throw new BuildException(Resources.formatManifestFilesInvalid(file));
    return new PackageManifest(directory, packageName, [...new Set(own.map(([name]) => name))], JSON.stringify(exclusions), Object.keys(peers), windowsAddons, posixAddons,
      new Map(Object.entries(dependencies).filter(([name]) => !PackageNaming.isOwn(name, modulesPrefix)).map(([name, version]) => [name, String(version)])), files, modulesPrefix,
      optionalPeers);
  }

  public static isAngular(peerDependencies: readonly string[]): boolean {
    return peerDependencies.includes(Resources.angularCorePackage);
  }

  public static formatName(directory: string, modulesPrefix: string = Resources.modulesPrefix): string {
    return PackageManifest.isFixtureDirectory(directory)
      ? PackageNaming.nameFixturePackage(directory.slice(Resources.moduleFixturePrefix.length))
      : PackageNaming.nameSourcePackage(directory, modulesPrefix);
  }

  public get id(): string {
    const folder = this.isFixture
      ? `${Resources.fixturePackageIdPrefix}${this.directory.slice(Resources.moduleFixturePrefix.length)}`
      : this.directory.slice(Resources.sourceFolderPrefix.length);
    return folder.split(Resources.pathSegmentSeparator).join(Resources.kebabSeparator);
  }

  public get isAngular(): boolean {
    return PackageManifest.isAngular(this.peerDependencies);
  }

  public get isFixture(): boolean {
    return PackageManifest.isFixtureDirectory(this.directory);
  }

  private static readAddons(file: string, settings: JsonReader, key: string, kind: string): readonly string[] {
    const addons = settings.hasField(key) ? settings.readValue(key) : [];
    if (!Array.isArray(addons) || !addons.every(t => Object.isString(t) && Resources.packageAddonNamePattern.test(t)))
      throw new BuildException(Resources.formatManifestAddonsInvalid(file, kind));
    return addons;
  }

  private static isFixtureDirectory(directory: string): boolean {
    return directory.startsWith(Resources.moduleFixturePrefix);
  }
}
