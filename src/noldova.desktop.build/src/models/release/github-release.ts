/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitHubJson } from "../../services/repository/github-json.ts";
import { GitHubReleaseAsset } from "./github-release-asset.ts";
import { Resources } from "../../resources.ts";

export class GitHubRelease {
  public readonly id: number;
  public readonly tag: string;
  public readonly target: string;
  public readonly isDraft: boolean;
  public readonly assets: readonly GitHubReleaseAsset[];

  private constructor(id: number, tag: string, target: string, isDraft: boolean, assets: readonly GitHubReleaseAsset[]) {
    this.id = id;
    this.tag = tag;
    this.target = target;
    this.isDraft = isDraft;
    this.assets = assets;
  }

  public static read(value: unknown, context: string): GitHubRelease {
    const release = GitHubJson.object(value, context);
    return new GitHubRelease(GitHubJson.number(release, Resources.githubIdField, context), GitHubJson.text(release, Resources.githubTagNameField, context), GitHubJson.text(release, Resources.githubTargetCommitishField, context),
      GitHubJson.flag(release, Resources.githubDraftField, context), GitHubJson.array(release[Resources.githubAssetsField], Resources.formatJsonChildContext(context, Resources.githubAssetsField))
        .map((t, index) => GitHubReleaseAsset.read(t, Resources.formatJsonItemContext(context, Resources.githubAssetsField, index))));
  }
}
