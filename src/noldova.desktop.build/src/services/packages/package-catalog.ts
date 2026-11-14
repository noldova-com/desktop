/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { DependencyOrder } from "../ordering/dependency-order.ts";
import { PackageManifest } from "../../models/packages/package-manifest.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackageCatalog {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async listPackagesAsync(includeFixtures: boolean = false): Promise<readonly PackageManifest[]> {
    return (await this.listAllAsync(includeFixtures)).filter(t => !t.isAngular);
  }

  public async listAngularPackagesAsync(includeFixtures: boolean = false): Promise<readonly PackageManifest[]> {
    return (await this.listAllAsync(includeFixtures)).filter(t => t.isAngular);
  }

  private static order(packages: readonly PackageManifest[]): readonly PackageManifest[] {
    const names = new Map<string, PackageManifest>(packages.map(t => [t.name, t]));
    if (names.size < packages.length)
      throw new BuildException(Resources.formatPackageNamesClash(packages.map(t => t.directory)));
    for (const manifest of packages) {
      const unknown = manifest.dependencies.filter(t => !names.has(t));
      if (unknown.length > 0)
        throw new BuildException(Resources.formatPackageDependsOnUnknown(manifest.directory, unknown));
    }

    return new DependencyOrder(packages, t => t.name, t => t.dependencies)
      .sort(t => new BuildException(Resources.formatPackageCycle(t)));
  }

  private async listAllAsync(includeFixtures: boolean): Promise<readonly PackageManifest[]> {
    const packages: PackageManifest[] = [];
    for (const directory of await this.listDirectoriesAsync())
      packages.push(await PackageManifest.readAsync(this.root, directory));
    return PackageCatalog.order(packages.filter(t => includeFixtures || !t.isFixture));
  }

  private async listDirectoriesAsync(): Promise<readonly string[]> {
    const source = path.join(this.root, Resources.sourceFolder);
    if (!existsSync(source))
      return [];

    const entries = await readdir(source, { recursive: true });
    return entries
      .map(t => Resources.formatFolderPath(Resources.sourceFolder, t.split(path.sep).join(Resources.pathSegmentSeparator)))
      .filter(t => path.posix.basename(t) === Resources.packageManifestFileName && !t.split(Resources.pathSegmentSeparator)[1]?.endsWith(Resources.windowAppSuffix))
      .filter(t => !t.split(Resources.pathSegmentSeparator).includes(Resources.nodeModulesFolder))
      .map(t => path.posix.dirname(t))
      .sort();
  }
}
