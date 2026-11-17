/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import path from "node:path";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";
import { BuildLayout } from "../../services/packages/build-layout.ts";
import { PackageNaming } from "../../services/packages/package-naming.ts";

export class LockedPackage {
  public readonly location: string;
  public readonly name: string;
  public readonly version: string;
  public readonly resolved: string;
  public readonly sha512: string;
  public readonly isInstalled: boolean;

  public constructor(location: string, entry: Readonly<Record<string, unknown>>, isInstalled: boolean = false) {
    const name = location.slice(location.lastIndexOf(Resources.lockedPackageFolder) + Resources.lockedPackageFolder.length);
    const version = entry[Resources.manifestVersionField];
    const resolved = entry[Resources.lockResolvedField];
    const integrity = entry[Resources.lockIntegrityField];
    if (entry[Resources.lockLinkField] === true)
      throw new BuildException(Resources.formatLockedPackageLinked(location, String(resolved)));
    if (!Resources.lockedPackageName.test(name) || !Object.isString(version) || !Resources.lockedPackageVersion.test(version))
      throw new BuildException(Resources.formatLockedPackageInvalid(location));
    if (entry[Resources.lockInBundleField] === true)
      throw new BuildException(Resources.formatLockedPackageBundled(name, version, location));
    if (!Object.isUndefined(entry[Resources.manifestNameField]) && entry[Resources.manifestNameField] !== name)
      throw new BuildException(Resources.formatLockedPackageAlias(location, String(entry[Resources.manifestNameField]), name));
    if (!isInstalled && Object.isString(resolved) && resolved.startsWith(Resources.archiveScheme)) {
      if (!LockedPackage.isOwnArchive(name, resolved))
        throw new BuildException(Resources.formatLockedArchiveRefused(name, version, location, resolved));
      const expected = BuildLayout.nameArchive(name, version);
      if (path.posix.basename(resolved) !== expected)
        throw new BuildException(Resources.formatLockedArchiveMisnamed(name, version, location, resolved, expected));
    }
    if (!Object.isString(resolved) || !LockedPackage.isShippable(resolved, isInstalled))
      throw new BuildException(isInstalled
        ? Resources.formatLockedPackageUnlocked(name, version, location)
        : Resources.formatLockedPackageUnresolved(name, version, location));
    const sha512 = Object.isString(integrity)
      ? integrity.split(Resources.integritySeparator).find(t => t.startsWith(Resources.integrityPrefix))?.slice(Resources.integrityPrefix.length)
      : undefined;
    if (Object.isUndefined(sha512))
      throw new BuildException(!isInstalled && resolved.startsWith(Resources.archiveScheme)
        ? Resources.formatLockedArchiveNoIntegrity(name, version, location, resolved)
        : Resources.formatLockedPackageNoIntegrity(name, version, location));

    this.location = location;
    this.name = name;
    this.version = version;
    this.resolved = resolved;
    this.sha512 = sha512;
    this.isInstalled = isInstalled;
  }

  public get id(): string {
    return Resources.formatPackageId(this.name, this.version);
  }

  public get fileName(): string {
    return Resources.formatLockedArchiveName(this.name, this.version);
  }

  public get isArchive(): boolean {
    return this.resolved.startsWith(Resources.archiveScheme);
  }

  public locateArchive(root: string): string {
    return path.resolve(root, this.resolved.slice(Resources.archiveScheme.length));
  }

  public matches(data: Buffer): boolean {
    return createHash(Resources.integrityAlgorithm).update(data).digest(Resources.integrityDigestEncoding) === this.sha512;
  }

  private static isShippable(resolved: string, isInstalled: boolean): boolean {
    if (resolved.startsWith(Resources.archiveScheme))
      return true;
    return !isInstalled && URL.canParse(resolved) && Resources.registrySchemes.includes(new URL(resolved).protocol);
  }

  private static isOwnArchive(name: string, resolved: string): boolean {
    const file = resolved.slice(Resources.archiveScheme.length);
    return PackageNaming.isNoldova(name) && file === path.posix.normalize(file) && Resources.ownArchiveFolder.test(path.posix.dirname(file))
      && path.posix.extname(file) === Resources.packageArchiveExtension;
  }
}
