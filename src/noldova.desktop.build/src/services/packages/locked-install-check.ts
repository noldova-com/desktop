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
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class LockedInstallCheck {
  public static async listLockedSpecsAsync(root: string): Promise<readonly string[]> {
    const lockfile = path.join(root, Resources.packageLockFileName);
    if (!existsSync(lockfile))
      return [];
    const locked = await LockedInstallCheck.readPackagesAsync(lockfile);
    const installedLockfile = path.join(root, ...Resources.installedLockfileSegments);
    const installed = existsSync(installedLockfile) ? await LockedInstallCheck.readPackagesAsync(installedLockfile) : {};
    const names = new Set(Object.values(locked).flatMap(t => Object.keys(LockedInstallCheck.toRecord(LockedInstallCheck.toRecord(t)[Resources.lockfilePeerDependenciesField]))));
    const top = Resources.formatPackageLockKey(String.empty);
    for (const location of Object.keys(installed)) {
      const name = location.slice(top.length);
      const entry = LockedInstallCheck.toRecord(locked[location]);
      if (location.startsWith(top) && !name.includes(`${Resources.pathSegmentSeparator}${top}`) && entry[Resources.optionalField] === true
        && Object.keys(LockedInstallCheck.toRecord(entry[Resources.lockfilePeerDependenciesField])).length === 0)
        names.add(name);
    }
    const specs: string[] = [];
    for (const name of [...names].sort()) {
      const entry = LockedInstallCheck.toRecord(locked[Resources.formatPackageLockKey(name)]);
      const version = entry[Resources.manifestVersionField];
      if (entry[Resources.lockLinkField] !== true && Object.isString(version))
        specs.push(Resources.formatLockedSpec(name, version));
    }
    return specs;
  }

  public static async checkAsync(root: string): Promise<void> {
    const lockfile = path.join(root, Resources.packageLockFileName);
    const installedLockfile = path.join(root, ...Resources.installedLockfileSegments);
    if (!existsSync(lockfile) || !existsSync(installedLockfile))
      return;
    const locked = await LockedInstallCheck.readPackagesAsync(lockfile);
    const installed = await LockedInstallCheck.readPackagesAsync(installedLockfile);
    const links = new Map<string, string>();
    for (const [location, value] of Object.entries(locked)) {
      const entry = LockedInstallCheck.toRecord(value);
      const resolved = entry[Resources.lockResolvedField];
      if (entry[Resources.lockLinkField] === true && Object.isString(resolved))
        links.set(location, resolved);
    }
    for (const [location, value] of Object.entries(installed)) {
      const entry = LockedInstallCheck.toRecord(value);
      const resolved = entry[Resources.lockResolvedField];
      if (entry[Resources.lockLinkField] === true || links.has(location) || (Object.isString(resolved) && resolved.startsWith(Resources.archiveScheme)))
        continue;
      const version = entry[Resources.manifestVersionField];
      const lockedEntry = LockedInstallCheck.toRecord(locked[LockedInstallCheck.locate(location, links)]);
      const held = lockedEntry[Resources.manifestVersionField];
      if (version !== held)
        throw new BuildException(Resources.formatUnlockedInstall(location, Object.isString(version) ? version : String.empty, Object.isString(held) ? held : null));
    }
  }

  private static locate(location: string, links: ReadonlyMap<string, string>): string {
    for (const [link, target] of links)
      if (location.startsWith(`${link}${Resources.pathSegmentSeparator}`))
        return `${target}${location.slice(link.length)}`;
    return location;
  }

  private static async readPackagesAsync(file: string): Promise<JsonObject> {
    return JsonReader.parse(await readFile(file, Resources.textEncoding)).readObject(Resources.lockfilePackagesField).toJson();
  }

  private static toRecord(value: JsonValue | undefined): JsonObject {
    return Object.isPlainObject(value) ? Object.fromEntries(Object.entries(value)) : {};
  }
}
