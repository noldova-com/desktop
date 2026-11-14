/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import type { Git } from "../../src/noldova.desktop.build/src/services/repository/git.ts";
import { Resources } from "../resources.ts";

export class RepositoryFiles {
  private readonly root: string;
  private readonly git: Git;

  public constructor(root: string, git: Git) {
    this.root = root;
    this.git = git;
  }

  public async listAsync(): Promise<readonly string[]> {
    const listed = (await this.git.readOutputAsync(Resources.repositoryFilesListArguments)).split(Resources.repositoryFilesEntrySeparator);
    return listed.filter(t => t.length > 0 && existsSync(path.join(this.root, t))).sort();
  }
}
