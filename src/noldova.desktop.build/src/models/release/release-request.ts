/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { ReleaseVersion } from "./release-version.ts";
import { Resources } from "../../resources.ts";

export class ReleaseRequest {
  public readonly repository: string;
  public readonly version: ReleaseVersion;
  public readonly revision: string;

  private constructor(repository: string, version: ReleaseVersion, revision: string) {
    this.repository = repository;
    this.version = version;
    this.revision = revision;
  }

  public static read(environment: NodeJS.ProcessEnv): ReleaseRequest {
    const repository = environment[Resources.releaseRepositoryVariable] ?? String.empty;
    if (!Resources.releaseRepositoryPattern.test(repository))
      throw new BuildException(Resources.formatReleaseRepositoryInvalid(repository));
    const version = ReleaseVersion.parse(environment[Resources.releaseVersionVariable] ?? String.empty, Resources.releaseVersionVariable);
    const revision = environment[Resources.releaseRevisionVariable] ?? String.empty;
    if (!Resources.releaseRevisionPattern.test(revision))
      throw new BuildException(Resources.formatReleaseRevisionInvalid(revision));
    return new ReleaseRequest(repository, version, revision);
  }
}
