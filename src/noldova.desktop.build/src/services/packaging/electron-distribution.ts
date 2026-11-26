/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, rm } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { TextFile } from "../files/text-file.ts";
import { Resources } from "../../resources.ts";

export class ElectronDistribution {
  private readonly root: string;

  public readonly folder: string;

  public constructor(root: string, folder: string) {
    this.root = root;
    this.folder = folder;
  }

  public async readVersionAsync(): Promise<string> {
    const manifest = path.join(this.root, ...Resources.electronPackageSegments, Resources.packageManifestFileName);
    const text = await TextFile.readAsync(manifest);
    try {
      return JsonReader.parse(text).readString(Resources.manifestVersionField);
    }
    catch (error) {
      throw new BuildException(Resources.formatElectronVersionMissing(manifest), new ExceptionOptions(error));
    }
  }

  public async copyAsync(): Promise<void> {
    const source = path.join(this.root, ...Resources.electronPackageSegments, Resources.electronDistributionFolder);
    const version = path.join(source, Resources.electronVersionFile);
    await rm(this.folder, { recursive: true, force: true });
    await cp(source, this.folder, {
      recursive: true,
      verbatimSymlinks: true,
      filter: t => t !== version && path.basename(t) !== Resources.electronDefaultAppFile
    });
  }
}
