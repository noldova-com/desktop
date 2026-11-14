/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { RepositoryFiles } from "../structure/repository-files.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class GitHubConfigurationCheck implements ICheck {
  private readonly root: string;
  private readonly files: RepositoryFiles;

  public readonly title: string = Resources.gitHubConfigurationCheckTitle;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.files.listAsync()).filter(t => Resources.gitHubConfigurationFilePattern.test(t));
    const findings: string[] = [];
    for (const file of files) {
      const lines = (await readFile(path.join(this.root, file), Resources.encoding)).split(Resources.lineEnd);
      lines.forEach((line, index) => {
        const problem = GitHubConfigurationCheck.findProblem(line);
        if (!Object.isNull(problem))
          findings.push(Resources.formatGitHubConfigurationFinding(file, index + 1, problem));
      });
    }

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatGitHubConfigurationChecked(files.length));
    return findings.length === 0;
  }

  private static findProblem(line: string): string | null {
    const match = Resources.gitHubUsesLinePattern.exec(line);
    if (Object.isNull(match))
      return null;
    const [, action = String.empty, rest = String.empty] = match;
    if (action.startsWith(Resources.gitHubLocalActionPrefix))
      return null;
    if (action.startsWith(Resources.gitHubOwnRepositoryPrefix))
      return Resources.gitHubOwnRepositoryPathPattern.test(action) ? null
        : Resources.formatGitHubUnscopedReference(action);
    if (!Resources.gitHubPinnedActionPattern.test(action))
      return Resources.formatGitHubUnpinnedAction(action);
    if (!Resources.gitHubReleaseCommentPattern.test(rest) && !Resources.gitHubSharedWorkflowPattern.test(action))
      return Resources.formatGitHubUnversionedAction(action);
    return null;
  }
}
