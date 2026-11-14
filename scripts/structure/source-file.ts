/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { Resources } from "../resources.ts";

export class SourceFile {
  public readonly path: string;
  public readonly owner: string;
  public readonly isProduction: boolean;
  public readonly packageRoot: string;
  public readonly text: string;

  public constructor(filePath: string, owner: string, isProduction: boolean, packageRoot: string, text: string) {
    this.path = filePath;
    this.owner = owner;
    this.isProduction = isProduction;
    this.packageRoot = packageRoot;
    this.text = text;
  }

  public get isScript(): boolean {
    return Resources.sourceScriptExtensions.has(path.posix.extname(this.path));
  }

  public get isJson(): boolean {
    return path.posix.extname(this.path) === Resources.jsonExtension;
  }

  public get isStyle(): boolean {
    return Resources.sourceStyleExtensions.has(path.posix.extname(this.path));
  }

  public get isManifest(): boolean {
    return path.posix.basename(this.path) === Resources.manifestFile;
  }

  public formatLocation(line: number): string {
    return Resources.formatSourceLineLocation(this.path, line);
  }
}
