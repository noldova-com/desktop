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
    if (!Resources.lockedPackageName.test(name) || !Object.isString(version) || !Resources.lockedPackageVersion.test(version))
      throw new BuildException(Resources.formatLockedPackageInvalid(location));
    if (entry[Resources.lockInBundleField] === true)
      throw new BuildException(Resources.formatLockedPackageBundled(name, version, location));
    if (!Object.isUndefined(entry[Resources.manifestNameField]) && entry[Resources.manifestNameField] !== name)
      throw new BuildException(Resources.formatLockedPackageAlias(location, String(entry[Resources.manifestNameField]), name));
    if (!Object.isString(resolved) || !LockedPackage.isShippable(resolved, isInstalled))
      throw new BuildException(isInstalled
        ? Resources.formatLockedPackageUnlocked(name, version, location)
        : Resources.formatLockedPackageUnresolved(name, version, location));
    const sha512 = Object.isString(integrity)
      ? integrity.split(Resources.integritySeparator).find(t => t.startsWith(Resources.integrityPrefix))?.slice(Resources.integrityPrefix.length)
      : undefined;
    if (Object.isUndefined(sha512))
      throw new BuildException(Resources.formatLockedPackageNoIntegrity(name, version, location));

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

  public locateArchive(root: string): string {
    return path.resolve(root, this.resolved.slice(Resources.archiveScheme.length));
  }

  public matches(data: Buffer): boolean {
    return createHash(Resources.integrityAlgorithm).update(data).digest(Resources.integrityDigestEncoding) === this.sha512;
  }

  private static isShippable(resolved: string, isInstalled: boolean): boolean {
    if (isInstalled)
      return resolved.startsWith(Resources.archiveScheme);
    return URL.canParse(resolved) && Resources.registrySchemes.includes(new URL(resolved).protocol);
  }
}
