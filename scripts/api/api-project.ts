/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class ApiProject {
  public readonly folder: string;
  public readonly file: string;

  public constructor(root: string, purpose: string, id: string) {
    this.folder = path.join(root, Resources.buildFolder, purpose, id);
    this.file = path.join(this.folder, Resources.typeScriptProjectFile);
  }

  public async writeAsync(base: string, root: string, files: readonly string[], paths?: Readonly<Record<string, readonly string[]>>): Promise<void> {
    await mkdir(this.folder, { recursive: true });
    const project = { extends: base, compilerOptions: { noEmit: true, rootDir: root, ...Object.isUndefined(paths) ? {} : { paths } }, files };
    await writeFile(this.file, Resources.formatApiProjectJson(project));
  }
}
