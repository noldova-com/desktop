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
  public readonly sourceRepository: string;
  public readonly buildRepository: string;
  public readonly version: ReleaseVersion;
  public readonly revision: string;
  public readonly tag: string;
  private readonly tagPrefix: string;

  private constructor(repository: string, sourceRepository: string, buildRepository: string, version: ReleaseVersion, revision: string, tagPrefix: string) {
    this.repository = repository;
    this.sourceRepository = sourceRepository;
    this.buildRepository = buildRepository;
    this.version = version;
    this.revision = revision;
    this.tagPrefix = tagPrefix;
    this.tag = `${tagPrefix}${version.text}`;
  }

  public get isSeparate(): boolean {
    return this.repository.toLowerCase() !== this.sourceRepository.toLowerCase();
  }

  public get isBuiltElsewhere(): boolean {
    return this.buildRepository.toLowerCase() !== this.sourceRepository.toLowerCase();
  }

  public ownsTag(tag: string): boolean {
    return tag.startsWith(this.tagPrefix) && Resources.releaseVersionPattern.test(tag.slice(this.tagPrefix.length));
  }

  public parseTag(tag: string, source: string): ReleaseVersion {
    if (!tag.startsWith(this.tagPrefix))
      throw new BuildException(Resources.formatReleaseTagInvalid(source, tag, this.tagPrefix));
    return ReleaseVersion.parse(tag.slice(this.tagPrefix.length), source);
  }

  public static read(environment: NodeJS.ProcessEnv): ReleaseRequest {
    const repository = environment[Resources.releaseRepositoryVariable] ?? String.empty;
    if (!Resources.releaseRepositoryPattern.test(repository))
      throw new BuildException(Resources.formatReleaseRepositoryInvalid(repository));
    const version = ReleaseVersion.parse(environment[Resources.releaseVersionVariable] ?? String.empty, Resources.releaseVersionVariable);
    const revision = environment[Resources.releaseRevisionVariable] ?? String.empty;
    if (!Resources.releaseRevisionPattern.test(revision))
      throw new BuildException(Resources.formatReleaseRevisionInvalid(revision));
    const sourceRepository = ReleaseRequest.readOptional(environment, Resources.releaseSourceRepositoryVariable) ?? repository;
    if (!Resources.releaseRepositoryPattern.test(sourceRepository))
      throw new BuildException(Resources.formatReleaseRepositoryInvalid(sourceRepository, Resources.releaseSourceRepositoryVariable));
    const buildRepository = ReleaseRequest.readOptional(environment, Resources.releaseBuildRepositoryVariable) ?? sourceRepository;
    if (!Resources.releaseRepositoryPattern.test(buildRepository))
      throw new BuildException(Resources.formatReleaseRepositoryInvalid(buildRepository, Resources.releaseBuildRepositoryVariable));
    const tagPrefix = ReleaseRequest.readOptional(environment, Resources.releaseTagPrefixVariable) ?? Resources.releaseTagPrefix;
    if (!Resources.releaseTagPrefixPattern.test(tagPrefix))
      throw new BuildException(Resources.formatReleaseTagPrefixInvalid(tagPrefix));
    return new ReleaseRequest(repository, sourceRepository, buildRepository, version, revision, tagPrefix);
  }

  private static readOptional(environment: NodeJS.ProcessEnv, variable: string): string | null {
    const value = environment[variable] ?? String.empty;
    return value.length === 0 ? null : value;
  }
}
