/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { FolderCreation } from "../files/folder-creation.ts";
import { Resources } from "../../resources.ts";

export class GalleryFile {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public get file(): string {
    return path.join(this.root, ...Resources.galleryFileSegments);
  }

  public async writeAsync(isPackaged: boolean): Promise<void> {
    await FolderCreation.createAsync(path.dirname(this.file));
    await writeFile(this.file, GalleryFile.contentOf(isPackaged));
  }

  public async isPackagedAsync(): Promise<boolean> {
    return await readFile(this.file, Resources.textEncoding) === GalleryFile.contentOf(true);
  }

  private static contentOf(isPackaged: boolean): string {
    const imports = isPackaged ? Resources.galleryTypeImport : `${Resources.galleryComponentImport}${Resources.galleryTypeImport}`;
    return Resources.formatGalleryFileContent(imports, isPackaged);
  }
}
