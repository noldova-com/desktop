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
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import type { PackageManifest } from "../../models/packages/package-manifest.ts";
import { LockedPackage } from "../../models/packaging/locked-package.ts";
import { CodePointOrder } from "../../models/packaging/code-point-order.ts";
import { OmittedOptionals } from "../../models/packaging/omitted-optionals.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { TypeOnlyPeers } from "../../models/packaging/type-only-peers.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { PackageNaming } from "../packages/package-naming.ts";
import { Resources } from "../../resources.ts";

export class ThirdPartyClosure {
  private readonly packages: JsonObject;
  private readonly installed: JsonObject;
  private readonly target: PackageTarget;

  private constructor(packages: JsonObject, installed: JsonObject, target: PackageTarget) {
    this.packages = packages;
    this.installed = installed;
    this.target = target;
  }

  public static async readAsync(root: string, target: PackageTarget): Promise<ThirdPartyClosure> {
    const packages = await ThirdPartyClosure.readPackagesAsync(path.join(root, Resources.packageLockFileName), Resources.rootLockfileTitle);
    const installedLockfile = path.join(root, ...Resources.installedLockfileSegments);
    const installed = existsSync(installedLockfile)
      ? await ThirdPartyClosure.readPackagesAsync(installedLockfile, Resources.installedLockfileTitle)
      : {};
    return new ThirdPartyClosure(packages, installed, target);
  }

  public collect(manifests: readonly PackageManifest[], rootPackages: readonly string[] = [], typeOnly: TypeOnlyPeers = new TypeOnlyPeers(),
    windowPackages: ReadonlySet<string> = new Set<string>(), omitted: OmittedOptionals = new OmittedOptionals(), versionOf: (name: string) => string = () => Resources.packageVersionPlaceholder):
    readonly [readonly LockedPackage[], ReadonlyMap<string, readonly string[]>] {
    const found = new Map<string, readonly [LockedPackage, JsonObject]>();
    for (const manifest of manifests)
      for (const name of [...manifest.externalDependencies.keys(), ...manifest.peerDependencies.filter(t => PackageNaming.isContext(t))]) {
        if (Object.isNull(this.resolve(Resources.lockfileRootLocation, name)))
          throw new BuildException(Resources.formatClosureManifestUnlocked(manifest.directory, name));
        this.visit(found, Resources.lockfileRootLocation, name, false, windowPackages, omitted);
      }
    for (const name of rootPackages) {
      if (Object.isNull(this.resolve(Resources.lockfileRootLocation, name)))
        throw new BuildException(Resources.formatClosureRootUnlocked(name));
      this.visit(found, Resources.lockfileRootLocation, name, false, windowPackages, omitted);
    }
    const own = new Set(manifests.map(t => t.name));

    const shipped = new Map<string, LockedPackage>();
    for (const [locked] of found.values()) {
      const other = shipped.get(locked.name);
      if (Object.isUndefined(other))
        shipped.set(locked.name, locked);
      else if (other.version !== locked.version)
        throw new BuildException(Resources.formatClosureVersionConflict(other.id, other.location, locked.id, locked.location));
    }
    const leftOut = new Map<string, readonly string[]>();
    for (const [locked, entry] of found.values()) {
      const notOptional = omitted.of(locked.id).find(t => !Object.hasOwn(ThirdPartyClosure.readRecord(entry, Resources.lockfileOptionalDependenciesField), t));
      if (!Object.isUndefined(notOptional))
        throw new BuildException(Resources.formatClosureNotOptional(notOptional, locked.id));
      const skipped = omitted.of(locked.id).filter(t => !shipped.has(t) && this.wouldShip(locked.location, t));
      if (skipped.length > 0)
        leftOut.set(locked.id, skipped);
      const optional = ThirdPartyClosure.readRecord(entry, Resources.peerDependenciesMetaField);
      const missing = Object.keys(ThirdPartyClosure.readRecord(entry, Resources.lockfilePeerDependenciesField))
        .find(t => ThirdPartyClosure.isUnmet(t, shipped, own, typeOnly, locked.id) && ThirdPartyClosure.readRecord(optional, t)[Resources.optionalField] !== true);
      const others = typeOnly.listOtherVersions(locked.id);
      if (!Object.isUndefined(missing))
        throw new BuildException(Resources.formatClosurePeerMissing(locked.id, locked.location, missing, others));
    }
    for (const manifest of manifests) {
      const id = Resources.formatPackageId(manifest.name, versionOf(manifest.name));
      const missing = manifest.peerDependencies.find(t => ThirdPartyClosure.isUnmet(t, shipped, own, typeOnly, id) && !manifest.optionalPeers.includes(t));
      if (!Object.isUndefined(missing))
        throw new BuildException(Resources.formatClosurePeerMissing(id, manifest.directory, missing, typeOnly.listOtherVersions(id)));
    }
    return [[...shipped.values()].sort((left, right) => CodePointOrder.compare(left.name, right.name)), leftOut];
  }

  private static isUnmet(peer: string, shipped: ReadonlyMap<string, LockedPackage>, own: ReadonlySet<string>, typeOnly: TypeOnlyPeers, id: string): boolean {
    return peer !== Resources.electronPackageName && !shipped.has(peer) && !own.has(peer) && !typeOnly.passes(id, peer);
  }

  private static async readPackagesAsync(file: string, title: string): Promise<JsonObject> {
    let lockfile: JsonReader;
    try {
      lockfile = JsonReader.parse(await readFile(file, Resources.textEncoding));
    }
    catch (error) {
      throw new BuildException(Resources.formatLockfileUnreadable(title), new ExceptionOptions(error));
    }
    let version: number;
    let packages: JsonObject;
    try {
      version = lockfile.readInteger(Resources.lockfileVersionField);
      packages = lockfile.readObject(Resources.lockfilePackagesField).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatLockfileVersionInvalid(title), new ExceptionOptions(error));
    }
    if (version !== Resources.lockfileVersion)
      throw new BuildException(Resources.formatLockfileVersionInvalid(title));
    return packages;
  }

  private static readRecord(entry: JsonObject, field: string): JsonObject {
    return ThirdPartyClosure.toRecord(entry[field]) ?? {};
  }

  private static toRecord(value: JsonValue | undefined): JsonObject | null {
    return Object.isPlainObject(value) ? Object.fromEntries(Object.entries(value)) : null;
  }

  private static allows(list: unknown, value: string): boolean {
    if (!Array.isArray(list))
      return true;
    if (list.includes(`${Resources.lockfileNegation}${value}`))
      return false;
    const required = list.filter(t => Object.isString(t) && !t.startsWith(Resources.lockfileNegation));
    return required.length === 0 || required.includes(value);
  }

  private visit(found: Map<string, readonly [LockedPackage, JsonObject]>, from: string, name: string, isOptional: boolean, windowPackages: ReadonlySet<string>,
    omitted: OmittedOptionals): void {
    const resolved = this.resolve(from, name);
    if (Object.isNull(resolved)) {
      if (isOptional)
        return;
      throw new BuildException(Resources.formatClosureDependencyUnlocked(from, name));
    }
    const [location, entry, isInstalled] = resolved;
    if (found.has(location))
      return;
    if (!this.fits(entry)) {
      if (isOptional)
        return;
      throw new BuildException(Resources.formatClosureUnfit(location, this.target.id));
    }

    const locked = new LockedPackage(location, entry, isInstalled);
    found.set(location, [locked, entry]);
    const optional = Object.keys(ThirdPartyClosure.readRecord(entry, Resources.lockfileOptionalDependenciesField));
    for (const dependency of Object.keys(ThirdPartyClosure.readRecord(entry, Resources.lockfileDependenciesField)).filter(t => !optional.includes(t) && !windowPackages.has(t)))
      this.visit(found, location, dependency, false, windowPackages, omitted);
    for (const dependency of optional.filter(t => !omitted.omits(locked.id, t)))
      this.visit(found, location, dependency, true, windowPackages, omitted);
    const optionalPeers = ThirdPartyClosure.readRecord(entry, Resources.peerDependenciesMetaField);
    for (const peer of Object.keys(ThirdPartyClosure.readRecord(entry, Resources.lockfilePeerDependenciesField))
      .filter(t => PackageNaming.isContext(t) && ThirdPartyClosure.readRecord(optionalPeers, t)[Resources.optionalField] !== true))
      this.visit(found, location, peer, false, windowPackages, omitted);
  }

  private static find(packages: JsonObject, from: string, name: string): readonly [string, JsonObject] | null {
    const candidate = path.posix.join(from, Resources.nodeModulesFolder, name);
    const entry = ThirdPartyClosure.toRecord(packages[candidate]);
    if (!Object.isNull(entry))
      return [candidate, entry];
    if (from === Resources.lockfileRootLocation)
      return null;
    const parent = from.lastIndexOf(Resources.lockfileNestedFolder);
    return ThirdPartyClosure.find(packages, parent < 0 ? Resources.lockfileRootLocation : from.slice(0, parent), name);
  }

  private resolve(from: string, name: string): readonly [string, JsonObject, boolean] | null {
    const locked = ThirdPartyClosure.find(this.packages, from, name);
    if (!Object.isNull(locked))
      return [...locked, false];
    const installed = PackageNaming.isNoldova(name) ? ThirdPartyClosure.find(this.installed, from, name) : null;
    return Object.isNull(installed) ? null : [...installed, true];
  }

  private wouldShip(from: string, name: string): boolean {
    const resolved = this.resolve(from, name);
    return !Object.isNull(resolved) && this.fits(resolved[1]);
  }

  private fits(entry: JsonObject): boolean {
    return ThirdPartyClosure.allows(entry[Resources.lockfileOsField], String(Resources.lockfilePlatforms.get(this.target.platform)))
      && ThirdPartyClosure.allows(entry[Resources.lockfileCpuField], this.target.architecture)
      && (this.target.platform !== Resources.linuxTarget || ThirdPartyClosure.allows(entry[Resources.lockfileLibcField], Resources.lockfileLinuxLibrary));
  }
}
