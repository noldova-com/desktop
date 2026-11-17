/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { BuildLayout } from "../../services/packages/build-layout.ts";
import type { NpmCommand } from "../../services/toolchain/npm-command.ts";
import type { LockedPackage } from "./locked-package.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { TarArchive } from "./tar-archive.ts";
import { Resources } from "../../resources.ts";

export class CompanyPackage {
  public readonly locked: LockedPackage;
  public readonly file: string;

  private constructor(locked: LockedPackage, file: string) {
    this.locked = locked;
    this.file = file;
  }

  public static async packAsync(locked: LockedPackage, root: string, folder: string, npm: NpmCommand, windowPackages: ReadonlySet<string>): Promise<CompanyPackage> {
    const installed = path.join(root, ...locked.location.split(Resources.pathSegmentSeparator));
    let manifest: JsonObject;
    try {
      manifest = JsonReader.parse(await readFile(path.join(installed, Resources.packageManifestFileName), Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatCompanyPackageUnreadable(locked.id, locked.location), new ExceptionOptions(error));
    }
    if (manifest[Resources.manifestNameField] !== locked.name || manifest[Resources.manifestVersionField] !== locked.version)
      throw new BuildException(Resources.formatCompanyPackageMismatch(locked.location, locked.id));
    const dependencies = manifest[Resources.manifestDependenciesField];
    const bundled = Object.keys(Object.isPlainObject(dependencies) ? dependencies : {}).filter(t => windowPackages.has(t));
    const archive = locked.isArchive ? await CompanyPackage.verifyArchiveAsync(locked, root) : null;
    if (!Object.isNull(archive) && bundled.length === 0)
      return new CompanyPackage(locked, archive[0]);

    await mkdir(folder, { recursive: true });
    const source = bundled.length === 0 ? installed : path.join(folder, Resources.companyPackageSourcesFolder, ...locked.name.split(Resources.pathSegmentSeparator));
    if (bundled.length > 0) {
      if (Object.isNull(archive))
        await cp(installed, source, { recursive: true, filter: t => path.basename(t) !== Resources.nodeModulesFolder });
      else
        await CompanyPackage.extractAsync(locked, archive, source);
      const packed = await CompanyPackage.readManifestAsync(locked, source, archive?.[0] ?? locked.location);
      const listed = packed[Resources.manifestDependenciesField];
      const shipped = Object.fromEntries(Object.entries(Object.isPlainObject(listed) ? listed : {}).filter(([name]) => !windowPackages.has(name)));
      await writeFile(path.join(source, Resources.packageManifestFileName), Resources.formatJsonFile({ ...packed, [Resources.manifestDependenciesField]: shipped }));
    }
    const result = await npm.runAsync([...Resources.npmPackArguments, folder, source], root);
    if (!result.isSuccessful)
      throw new BuildException(Resources.formatCompanyPackFailed(locked.id, locked.location, result.exitCode, result.text));
    return new CompanyPackage(locked, path.join(folder, BuildLayout.nameArchive(locked.name, locked.version)));
  }

  private static async verifyArchiveAsync(locked: LockedPackage, root: string): Promise<readonly [string, Buffer]> {
    const archive = locked.locateArchive(root);
    let data: Buffer;
    try {
      data = await readFile(archive);
    }
    catch (error) {
      throw new BuildException(Resources.formatCompanyArchiveUnreadable(locked.id, archive), new ExceptionOptions(error));
    }
    if (!locked.matches(data))
      throw new BuildException(Resources.formatCompanyArchiveMismatch(archive, locked.id));
    return [archive, data];
  }

  private static async extractAsync(locked: LockedPackage, [archive, data]: readonly [string, Buffer], source: string): Promise<void> {
    const written = new Map<string, string>();
    for (const entry of TarArchive.fromGzip(data, archive).entries) {
      const isFolder = entry.type === Resources.tarFolderType;
      const entryName = isFolder ? entry.name.replace(Resources.trailingSlashesPattern, String.empty) : entry.name;
      if (isFolder && !entryName.includes(Resources.pathSegmentSeparator))
        continue;
      const relative = Resources.tarPackagePath.exec(entryName)?.[1];
      const name = relative ?? entry.name;
      if (!isFolder && !Resources.tarFileTypes.includes(entry.type))
        throw new BuildException(Resources.formatTarEntryTypeRefused(archive, name, TarArchive.describeEntry(entry)));
      const segments = relative?.split(Resources.pathSegmentSeparator) ?? [];
      if (Object.isUndefined(relative) || segments.some(t => Resources.companyPackageUnsafeSegments.includes(t)))
        throw new BuildException(Resources.formatTarEntryOutside(archive, name, locked.id));
      if (segments.some(t => Resources.windowsUnsafeSegment.test(t)))
        throw new BuildException(Resources.formatTarEntryWindowsUnsafe(archive, name));
      for (let count = 1; count <= segments.length; count++) {
        const prefix = segments.slice(0, count).join(Resources.pathSegmentSeparator);
        const key = prefix.normalize(Resources.unicodeNormalForm).toUpperCase().toLowerCase();
        const other = written.get(key);
        if (!Object.isUndefined(other) && other !== prefix)
          throw new BuildException(Resources.formatTarEntryCaseClash(archive, other, prefix));
        written.set(key, prefix);
      }
      const target = path.join(source, ...segments);
      if (isFolder)
        await mkdir(target, { recursive: true });
      else {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, entry.content, { mode: entry.mode & Resources.filePermissionsMask });
      }
    }
  }

  private static async readManifestAsync(locked: LockedPackage, source: string, origin: string): Promise<JsonObject> {
    const refusal = Resources.formatCompanyManifestMissing(origin, locked.id);
    let manifest: JsonObject;
    try {
      manifest = JsonReader.parse(await readFile(path.join(source, Resources.packageManifestFileName), Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(refusal, new ExceptionOptions(error));
    }
    if (manifest[Resources.manifestNameField] !== locked.name || manifest[Resources.manifestVersionField] !== locked.version)
      throw new BuildException(refusal);
    return manifest;
  }
}
