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
import { PackageSource } from "../../models/packaging/package-source.ts";
import { StagedSource } from "../../models/packaging/staged-source.ts";
import { Resources } from "../../resources.ts";

export class StagedSources {
  public static async listAsync(stage: string): Promise<readonly StagedSource[]> {
    const folders = (await readdir(stage, { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile() && t.name === Resources.packageManifestFileName)
      .map(t => path.relative(stage, t.parentPath).split(path.sep).join(Resources.pathSegmentSeparator))
      .filter(t => Resources.installedPackageFolderPattern.test(t))
      .sort();
    const sources: StagedSource[] = [];
    for (const folder of folders) {
      const source = await StagedSources.readPackageAsync(path.join(stage, folder), folder);
      if (!Object.isNull(source))
        sources.push(source);
    }
    return sources;
  }

  private static async readPackageAsync(folder: string, relative: string): Promise<StagedSource | null> {
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
    if (!PackageSource.names(desktop))
      return null;
    const name = manifest[Resources.manifestNameField];
    const version = manifest[Resources.manifestVersionField];
    const id = Object.isString(name) && Object.isString(version) ? Resources.formatPackageId(name, version) : relative;
    const source = PackageSource.parse(desktop);
    if (Object.isNull(source))
      throw new BuildException(Resources.formatPackageSourceInvalid(id));
    const [license] = (await readdir(folder, { withFileTypes: true }))
      .filter(t => t.isFile() && Resources.licenseFilePattern.test(t.name))
      .map(t => t.name)
      .sort((left, right) => CodePointComparer.compare(left, right));
    if (Object.isUndefined(license))
      throw new BuildException(Resources.formatPackageSourceNoLicense(id));
    return new StagedSource(id, await readFile(path.join(folder, license), Resources.textEncoding), source);
  }
}
