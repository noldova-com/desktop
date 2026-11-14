/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import type { PackageCatalog } from "../../src/noldova.desktop.build/src/services/packages/package-catalog.ts";
import type { PackageManifest } from "../../src/noldova.desktop.build/src/models/packages/package-manifest.ts";
import { BuildException } from "../../src/noldova.desktop.build/src/exceptions/build.exception.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class PackageLayoutCheck implements ICheck {
  private readonly root: string;
  private readonly catalog: PackageCatalog;

  public readonly title: string = Resources.packageLayoutCheckTitle;

  public constructor(root: string, catalog: PackageCatalog) {
    this.root = root;
    this.catalog = catalog;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    let packages: readonly PackageManifest[];
    try {
      packages = await this.catalog.listPackagesAsync();
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      output.write(`${error.message}${Resources.lineEnd}`);
      return false;
    }

    const findings = packages.flatMap(t =>
      Resources.packageLayoutRequiredFiles.filter(u => !existsSync(path.join(this.root, t.directory, u))).map(u => Resources.formatPackageLayoutMissing(t.directory, u)));

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatPackageLayoutChecked(packages.length));
    return findings.length === 0;
  }
}
