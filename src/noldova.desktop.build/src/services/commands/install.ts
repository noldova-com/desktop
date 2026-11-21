/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { BuildPart } from "../../models/build-part.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import type { AngularProject } from "../angular/angular-project.ts";
import { Resources } from "../../resources.ts";

export class Install {
  private readonly angular: AngularProject;
  private readonly output: Writable;

  public constructor(angular: AngularProject, output: Writable) {
    this.angular = angular;
    this.output = output;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    const part = BuildPart.parse(commandArguments);
    const installArguments = part.removeFrom(commandArguments);
    if (installArguments.length > 0) {
      this.output.write(Resources.installUsage);
      return Resources.usageExitCode;
    }

    try {
      await this.angular.installAsync(this.output, part);
      return 0;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      this.output.write(Resources.formatOutputLine(error.message));
      return Resources.failureExitCode;
    }
  }
}
