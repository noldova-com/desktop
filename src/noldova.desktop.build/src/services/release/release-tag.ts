/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { GitHubApi } from "../repository/github-api.ts";
import { GitHubJson } from "../repository/github-json.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class ReleaseTag {
  public static async readCommitAsync(api: GitHubApi, tag: string): Promise<string | null> {
    const context = Resources.formatTagContext(tag);
    const reference = await api.readTagAsync(tag);
    if (Object.isNull(reference))
      return null;
    const target = GitHubJson.child(reference, Resources.githubObjectField, context);
    if (GitHubJson.text(target, Resources.githubTypeField, context) !== Resources.githubCommitType)
      throw new BuildException(Resources.formatTagAnnotated(tag));
    return GitHubJson.text(target, Resources.githubShaField, context);
  }

  public static requireAt(tag: string, commit: string | null, revision: string): void {
    if (!Object.isNull(commit) && commit !== revision)
      throw new BuildException(Resources.formatTagMoved(tag, commit, revision));
  }
}
