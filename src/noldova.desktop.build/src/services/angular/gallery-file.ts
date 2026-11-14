/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
    await mkdir(path.dirname(this.file), { recursive: true });
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
