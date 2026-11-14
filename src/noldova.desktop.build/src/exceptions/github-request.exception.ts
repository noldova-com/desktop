/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BuildException } from "./build.exception.ts";
import { Resources } from "../resources.ts";

export class GitHubRequestException extends BuildException {
  public readonly gitHubArguments: readonly string[];
  public readonly exitCode: number | null;
  public readonly errorOutput: string;
  public readonly status: number | null;

  public constructor(gitHubArguments: readonly string[], exitCode: number | null, errorOutput: string, status: number | null) {
    super(Resources.formatGhFailed(gitHubArguments, exitCode, errorOutput));

    this.gitHubArguments = gitHubArguments;
    this.exitCode = exitCode;
    this.errorOutput = errorOutput;
    this.status = status;
  }
}
