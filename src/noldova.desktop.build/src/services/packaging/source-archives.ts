/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { CodePointComparer } from "@noldova/context.text";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { IStagedSource } from "../../interfaces/i-staged-source.ts";
import { SourceArchive } from "../../models/packaging/source-archive.ts";
import { Resources } from "../../resources.ts";

// Lists the packages of the stage whose package.json names, in noldovaDesktop.sourceArchive, the archive of their
// complete corresponding source, with their licence text, so the licence notice and the release can carry it.
export class SourceArchives {
  public static async listAsync(stage: string): Promise<readonly IStagedSource[]> {
    const folders = (await readdir(stage, { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile() && t.name === Resources.packageManifestFileName)
      .map(t => path.relative(stage, t.parentPath).split(path.sep).join(Resources.pathSegmentSeparator))
      .filter(t => Resources.installedPackageFolderPattern.test(t))
      .sort();
    const sources: IStagedSource[] = [];
    for (const folder of folders) {
      const source = await SourceArchives.readPackageAsync(path.join(stage, folder), folder);
      if (!Object.isNull(source))
        sources.push(source);
    }
    return sources;
  }

  private static async readPackageAsync(folder: string, relative: string): Promise<IStagedSource | null> {
    let manifest: Readonly<Record<string, unknown>>;
    try {
      manifest = JsonReader.parse(await readFile(path.join(folder, Resources.packageManifestFileName), Resources.textEncoding)).toJson();
    }
    catch {
      return null;
    }
    const named = manifest[Resources.noldovaDesktopField];
    if (!Object.isPlainObject(named))
      return null;
    const desktop: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(named));
    if (!Object.hasOwn(desktop, Resources.desktopSourceArchiveField))
      return null;
    const name = manifest[Resources.manifestNameField];
    const version = manifest[Resources.manifestVersionField];
    const id = Object.isString(name) && Object.isString(version) ? Resources.formatPackageId(name, version) : relative;
    const archive = SourceArchive.parse(desktop[Resources.desktopSourceArchiveField]);
    if (Object.isNull(archive))
      throw new BuildException(Resources.formatSourceArchiveInvalid(id));
    const [license] = (await readdir(folder, { withFileTypes: true }))
      .filter(t => t.isFile() && Resources.licenseFilePattern.test(t.name))
      .map(t => t.name)
      .sort((left, right) => CodePointComparer.compare(left, right));
    if (Object.isUndefined(license))
      throw new BuildException(Resources.formatSourceArchiveNoLicense(id));
    return { id, license: await readFile(path.join(folder, license), Resources.textEncoding), archive };
  }
}
