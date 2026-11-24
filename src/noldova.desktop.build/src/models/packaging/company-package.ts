/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { cp, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { BuildLayout } from "../../services/packages/build-layout.ts";
import type { NpmCommand } from "../../services/toolchain/npm-command.ts";
import type { LockedPackage } from "./locked-package.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { TarArchive } from "./tar-archive.ts";
import { FolderCreation } from "../../services/files/folder-creation.ts";
import { Resources } from "../../resources.ts";

export class CompanyPackage {
  public readonly locked: LockedPackage;
  public readonly file: string;

  private constructor(locked: LockedPackage, file: string) {
    this.locked = locked;
    this.file = file;
  }

  public static async packAsync(locked: LockedPackage, root: string, folder: string, npm: NpmCommand, windowPackages: ReadonlySet<string>, archives: string | null = null):
    Promise<CompanyPackage> {
    const installed = path.join(root, ...locked.location.split(Resources.pathSegmentSeparator));
    const fetched = locked.isArchive || Object.isNull(archives) || existsSync(installed) ? null : await CompanyPackage.readFetchedAsync(locked, archives);
    const manifest = Object.isNull(fetched) ? await CompanyPackage.readInstalledAsync(locked, installed, archives) : CompanyPackage.readArchivedManifest(locked, fetched);
    if (manifest[Resources.manifestNameField] !== locked.name || manifest[Resources.manifestVersionField] !== locked.version)
      throw new BuildException(Resources.formatCompanyPackageMismatch(Object.isNull(fetched) ? locked.location : fetched[0], locked.id));
    const dependencies = manifest[Resources.manifestDependenciesField];
    const bundled = Object.keys(Object.isPlainObject(dependencies) ? dependencies : {}).filter(t => windowPackages.has(t));
    const archive = locked.isArchive ? await CompanyPackage.verifyArchiveAsync(locked, root) : fetched;
    if (!Object.isNull(archive) && bundled.length === 0)
      return new CompanyPackage(locked, archive[0]);

    await FolderCreation.createAsync(folder);
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

  public static readArchivesFolder(environment: NodeJS.ProcessEnv): string | null {
    const folder = environment[Resources.companyArchivesVariable] ?? String.empty;
    return folder.length > 0 ? folder : null;
  }

  private static async readInstalledAsync(locked: LockedPackage, installed: string, archives: string | null): Promise<JsonObject> {
    try {
      return JsonReader.parse(await readFile(path.join(installed, Resources.packageManifestFileName), Resources.textEncoding)).toJson();
    }
    catch (error) {
      throw new BuildException(Object.isNull(archives)
        ? Resources.formatCompanyPackageUnreadable(locked.id, locked.location)
        : Resources.formatCompanyPackageUnreadableOrUnfetched(locked.id, locked.location, path.join(archives, BuildLayout.nameArchive(locked.name, locked.version))),
      new ExceptionOptions(error));
    }
  }

  private static async readFetchedAsync(locked: LockedPackage, archives: string): Promise<readonly [string, Buffer] | null> {
    const file = path.join(archives, BuildLayout.nameArchive(locked.name, locked.version));
    if (!existsSync(file))
      return null;
    const data = await readFile(file);
    if (!locked.matches(data))
      throw new BuildException(Resources.formatFetchedCompanyArchiveMismatch(file, locked.id));
    return [file, data];
  }

  private static readArchivedManifest(locked: LockedPackage, [archive, data]: readonly [string, Buffer]): JsonObject {
    const text = TarArchive.fromGzip(data, archive).topLevelFiles.get(Resources.packageManifestFileName)?.toString(Resources.textEncoding);
    try {
      return JsonReader.parse(text ?? String.empty).toJson();
    }
    catch (error) {
      throw new BuildException(Resources.formatCompanyManifestMissing(archive, locked.id), new ExceptionOptions(error));
    }
  }

  private static async verifyArchiveAsync(locked: LockedPackage, root: string): Promise<readonly [string, Buffer]> {
    const archive = locked.locateArchive(root);
    const repository = CompanyPackage.findRepository(path.resolve(root));
    const relative = path.relative(repository, archive);
    if (!locked.isInstalled && (path.isAbsolute(relative) || relative.split(path.sep)[0] === Resources.parentFolderSegment))
      throw new BuildException(Resources.formatLockedArchiveOutside(locked.id, archive, repository));
    const unreadable = (error: unknown): never => {
      throw new BuildException(Resources.formatCompanyArchiveUnreadable(locked.id, archive), new ExceptionOptions(error));
    };
    if (!locked.isInstalled) {
      const real = await realpath(archive).catch(unreadable);
      if (real !== path.join(await realpath(repository), relative))
        throw new BuildException(Resources.formatLockedArchiveThroughLink(locked.id, archive, real));
    }
    const data = await readFile(archive).catch(unreadable);
    if (!Object.isNull(locked.sha512) && !locked.matches(data))
      throw new BuildException(Resources.formatCompanyArchiveMismatch(archive, locked.id));
    return [archive, data];
  }

  private static findRepository(root: string): string {
    let folder = root;
    while (!existsSync(path.join(folder, Resources.gitFolder))) {
      const parent = path.dirname(folder);
      if (parent === folder)
        return root;
      folder = parent;
    }
    return folder;
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
        await FolderCreation.createAsync(target);
      else {
        await FolderCreation.createAsync(path.dirname(target));
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
