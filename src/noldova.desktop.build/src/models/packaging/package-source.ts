/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import { SourceFile } from "./source-file.ts";

export class PackageSource {
  public readonly pages: readonly string[];
  public readonly files: readonly SourceFile[];

  public constructor(pages: readonly string[], files: readonly SourceFile[]) {
    this.pages = pages;
    this.files = files;
  }

  public static names(desktop: Readonly<Record<string, unknown>>): boolean {
    return Object.hasOwn(desktop, Resources.desktopSourcePagesField) || Object.hasOwn(desktop, Resources.desktopSourcesField);
  }

  public static parse(desktop: Readonly<Record<string, unknown>>): PackageSource | null {
    const listedPages: unknown = desktop[Resources.desktopSourcePagesField];
    const listedFiles: unknown = desktop[Resources.desktopSourcesField];
    if (!Array.isArray(listedPages) || !Array.isArray(listedFiles) || listedPages.length === 0 || listedFiles.length === 0)
      return null;
    const pages: string[] = [];
    for (const page of listedPages) {
      if (!SourceFile.isAddress(page))
        return null;
      pages.push(page);
    }
    const files: SourceFile[] = [];
    for (const item of listedFiles) {
      const file = SourceFile.parse(item);
      if (Object.isNull(file))
        return null;
      files.push(file);
    }
    return new PackageSource(pages, files);
  }
}
