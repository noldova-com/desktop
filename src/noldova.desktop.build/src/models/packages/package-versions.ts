/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import type { ModuleCatalog } from "../../services/modules/module-catalog.ts";
import type { PackageManifest } from "./package-manifest.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackageVersions {
  private readonly moduleVersions: ReadonlyMap<string, string>;

  public readonly version: string;
  public readonly commit: string | null;

  public constructor(version: string, commit: string | null = null, moduleVersions: ReadonlyMap<string, string> = new Map()) {
    this.version = version;
    this.commit = commit;
    this.moduleVersions = new Map(moduleVersions);
  }

  public static async readAsync(modules: ModuleCatalog, productVersion: string, packages: readonly PackageManifest[], commit: string | null = null): Promise<PackageVersions> {
    const inventory = await modules.readAllAsync();
    if (inventory.problems.length > 0)
      throw new BuildException(Resources.formatModuleVersionsUnreadable(inventory.problems));
    const parts = new Map<string, string>(inventory.declarations.flatMap(t => t.parts.map(u => [Resources.formatFolderPath(t.folder, u), t.version] as const)));
    const moduleVersions = new Map<string, string>();
    for (const manifest of packages) {
      const version = parts.get(manifest.directory);
      if (!Object.isUndefined(version))
        moduleVersions.set(manifest.name, version);
    }
    for (const fixture of await modules.listFixturePackagesAsync())
      moduleVersions.set(fixture.packageName, fixture.version);
    return new PackageVersions(productVersion, commit, moduleVersions);
  }

  public of(name: string): string {
    return this.moduleVersions.get(name) ?? this.version;
  }

  public stampManifest(manifest: PackageManifest, text: string): string {
    const source = JsonReader.parse(text);
    const stamped = Resources.stampedDependencyFields.filter(t => source.hasField(t)).map(t => [t, Object.fromEntries(
      Object.entries(source.readObject(t).toJson()).map(([name, version]) => [name, manifest.dependencies.includes(name) ? this.of(name) : version]))]);
    return JSON.stringify({
      ...source.toJson(),
      [Resources.manifestVersionField]: this.of(manifest.name),
      ...Object.fromEntries(stamped),
      ...(Object.isNull(this.commit) ? {} : { [Resources.manifestCommitField]: this.commit })
    }, null, Resources.jsonIndent);
  }
}
