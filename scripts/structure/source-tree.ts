/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { PackageNaming } from "../../src/noldova.desktop.build/src/services/packages/package-naming.ts";
import { Resources } from "../resources.ts";
import type { RepositoryFiles } from "./repository-files.ts";
import { SourceFile } from "./source-file.ts";
import { SourceInventory } from "./source-inventory.ts";

export class SourceTree {
  private readonly root: string;
  private readonly files: RepositoryFiles;

  public constructor(root: string, files: RepositoryFiles) {
    this.root = root;
    this.files = files;
  }

  public async readAsync(): Promise<SourceInventory> {
    const listed = (await this.files.listAsync()).filter(t => t.startsWith(Resources.sourceFolderPrefix));
    const manifestFolders = new Set(listed.filter(t => path.posix.basename(t) === Resources.manifestFile).map(t => path.posix.dirname(t)));
    const moduleIds = new Set<string>();
    const files: SourceFile[] = [];
    for (const file of listed) {
      const moduleId = Resources.sourceModuleFilePattern.exec(file)?.[1];
      const area = Object.isUndefined(moduleId) ? PackageNaming.locatePackageFolder(file) : Resources.formatSourceModuleArea(moduleId);
      if (Object.isNull(area))
        continue;

      if (!Object.isUndefined(moduleId))
        moduleIds.add(moduleId);
      if (!Resources.sourceScannedExtensions.has(path.posix.extname(file)))
        continue;

      const segments = file.split(Resources.pathSeparator);
      const owner = moduleId ?? Resources.sourceShellOwner;
      const isProduction = !segments.some(t => Resources.sourceTestFolders.has(t));
      const text = await readFile(path.join(this.root, file), Resources.encoding);
      files.push(new SourceFile(file, owner, isProduction, SourceTree.findPackageRoot(file, area, manifestFolders), text));
    }
    return new SourceInventory([...moduleIds].sort(), files);
  }

  private static findPackageRoot(file: string, area: string, manifestFolders: ReadonlySet<string>): string {
    let folder = path.posix.dirname(file);
    while (folder !== area && !manifestFolders.has(folder))
      folder = path.posix.dirname(folder);
    return folder;
  }
}
