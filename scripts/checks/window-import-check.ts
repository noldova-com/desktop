/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { ModuleCatalog } from "../../src/noldova.desktop.build/src/services/modules/module-catalog.ts";
import { PackageNaming } from "../../src/noldova.desktop.build/src/services/packages/package-naming.ts";
import type { SourceFile } from "../structure/source-file.ts";
import { SourceScanner } from "../../src/noldova.desktop.build/src/services/structure/source-scanner.ts";
import type { SourceTree } from "../structure/source-tree.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class WindowImportCheck implements ICheck {
  private readonly tree: SourceTree;
  private readonly modules: ModuleCatalog;

  public readonly title: string = Resources.windowImportCheckTitle;

  public constructor(tree: SourceTree, modules: ModuleCatalog) {
    this.tree = tree;
    this.modules = modules;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.tree.readAsync()).files.filter(t => t.isScript && WindowImportCheck.isWindowSide(t.path));
    const forbidden = new Set<string>([
      ...Resources.windowImportForbiddenFolders.map(t => PackageNaming.nameSourcePackage(t)),
      ...(await this.modules.readAllAsync()).declarations.flatMap(t => Resources.windowImportForbiddenModuleParts.map(u => PackageNaming.nameModulePackage(t.id, u, t.isFixture)))
    ]);
    const findings: string[] = [];
    for (const file of files)
      for (const literal of new SourceScanner(file.text).scan().imports)
        if (WindowImportCheck.isForbidden(file, literal.value, forbidden))
          findings.push(Resources.formatWindowImportFinding(file.formatLocation(literal.line), literal.value));

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatWindowImportChecked(files.length));
    return findings.length === 0;
  }

  private static isForbidden(file: SourceFile, specifier: string, forbidden: ReadonlySet<string>): boolean {
    if (!specifier.startsWith(Resources.relativeImportPrefix))
      return Resources.windowImportForbiddenPlatform.test(specifier)
        || forbidden.has(specifier.split(Resources.pathSeparator).slice(0, Resources.scopedPackageNameSegments).join(Resources.pathSeparator));
    const target = `${path.posix.join(path.posix.dirname(file.path), specifier)}${Resources.pathSeparator}`;
    const part = WindowImportCheck.findModulePart(target);
    return Object.isNull(part) ? Resources.windowImportForbiddenFolders.includes(PackageNaming.locatePackageFolder(target) ?? String.empty) : Resources.windowImportForbiddenModuleParts.includes(part);
  }

  private static isWindowSide(filePath: string): boolean {
    const folder = WindowImportCheck.locateWindowFolder(filePath);
    return !Object.isNull(folder) && !filePath.startsWith(`${folder}${Resources.windowImportScriptsFolder}`) && filePath.slice(folder.length).includes(Resources.pathSeparator);
  }

  private static locateWindowFolder(filePath: string): string | null {
    for (const pattern of Resources.windowImportModulePartPatterns) {
      const match = pattern.exec(filePath);
      if (!Object.isNull(match))
        return match[1] === Resources.windowImportWindowPart ? match[0] : null;
    }
    const folder = PackageNaming.locatePackageFolder(filePath);
    return !Object.isNull(folder) && Resources.windowImportWindowFolders.includes(folder) ? `${folder}${Resources.pathSeparator}` : null;
  }

  private static findModulePart(filePath: string): string | null {
    for (const pattern of Resources.windowImportModulePartPatterns) {
      const part = pattern.exec(filePath)?.[1];
      if (!Object.isUndefined(part))
        return part;
    }
    return null;
  }
}
