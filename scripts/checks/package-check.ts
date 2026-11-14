/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type { PackageBuild } from "../../src/noldova.desktop.build/src/services/packages/package-build.ts";
import { BuildException } from "../../src/noldova.desktop.build/src/exceptions/build.exception.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class PackageCheck implements ICheck {
  private readonly build: PackageBuild;

  public readonly title: string = Resources.packageCheckTitle;

  public constructor(build: PackageBuild) {
    this.build = build;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    try {
      const packages = await this.build.buildAsync(output);
      output.write(packages.length === 0 ? Resources.packageCheckNoPackages : Resources.formatPackageCheckBuilt(packages.length));
      return true;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      output.write(`${error.message}${Resources.lineEnd}`);
      return false;
    }
  }
}
