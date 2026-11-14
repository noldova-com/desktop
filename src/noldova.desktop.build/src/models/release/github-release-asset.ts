/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitHubJson } from "../../services/repository/github-json.ts";
import { Resources } from "../../resources.ts";

export class GitHubReleaseAsset {
  public readonly id: number;
  public readonly name: string;
  public readonly size: number;
  public readonly isUploaded: boolean;
  public readonly digest: string | null;

  private constructor(id: number, name: string, size: number, isUploaded: boolean, digest: string | null) {
    this.id = id;
    this.name = name;
    this.size = size;
    this.isUploaded = isUploaded;
    this.digest = digest;
  }

  public static read(value: unknown, context: string): GitHubReleaseAsset {
    const asset = GitHubJson.object(value, context);
    return new GitHubReleaseAsset(GitHubJson.number(asset, Resources.githubIdField, context), GitHubJson.text(asset, Resources.githubNameField, context), GitHubJson.number(asset, Resources.githubSizeField, context),
      GitHubJson.text(asset, Resources.githubStateField, context) === Resources.githubUploadedState, GitHubJson.nullableText(asset, Resources.githubDigestField, context));
  }
}
