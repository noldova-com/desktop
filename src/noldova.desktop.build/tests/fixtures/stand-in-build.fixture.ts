/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";

import { AngularProject } from "../../src/services/angular/angular-project.js";
import { GalleryFile } from "../../src/services/angular/gallery-file.js";
import { PackagedBuild } from "../../src/services/packaging/packaged-build.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";
import { NpmCommand } from "../../src/services/toolchain/npm-command.js";

export class StandInBuildFixture extends PackagedBuild {
  public constructor(root: string) {
    const runner = new ProcessRunner();
    super(root, runner, new GalleryFile(root), new AngularProject(root, runner, new NpmCommand(runner, {})));
  }

  public override async buildAsync(folder: string): Promise<void> {
    await mkdir(folder, { recursive: true });
  }
}
