/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";

import type { AngularProject } from "../angular/angular-project.ts";
import { GalleryFile } from "../angular/gallery-file.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackagedBuild {
  private static readonly COMMAND_LINE: string = fileURLToPath(new URL(`${Resources.packagedBuildCommandLineName}${path.extname(import.meta.filename)}`, import.meta.url));

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly gallery: GalleryFile;
  private readonly angular: AngularProject;

  public constructor(root: string, runner: ProcessRunner, gallery: GalleryFile, angular: AngularProject) {
    this.root = root;
    this.runner = runner;
    this.gallery = gallery;
    this.angular = angular;
  }

  public async buildAsync(folder: string, updateFeed: string | null): Promise<void> {
    try {
      const feed = Object.isNull(updateFeed) ? [] : [Resources.updateFeedOption, updateFeed];
      const exitCode = await this.runner.runAsync(process.execPath, [PackagedBuild.COMMAND_LINE, ...Resources.packagedBuildOptions, folder, ...feed], this.root);
      if (exitCode !== 0)
        throw new BuildException(Resources.formatPackagedBuildFailed(exitCode));
      if (!await this.gallery.isPackagedAsync())
        throw new BuildException(Resources.packagedBuildGalleryLeft);
    }
    finally {
      await this.gallery.writeAsync(false);
    }
    await this.angular.verifyWithoutAsync(path.join(folder, Resources.packagedWindowFolder), Resources.galleryMarkers);
  }
}
