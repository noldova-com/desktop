/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { SourceScanner } from "../structure/source-scanner.ts";
import type { BuildLayout } from "./build-layout.ts";
import { ImportClosure } from "./import-closure.ts";
import { InstalledPackages } from "./installed-packages.ts";
import { TextFile } from "../files/text-file.ts";
import { Resources } from "../../resources.ts";

export class ModuleWindowImports {
  private readonly layout: BuildLayout;

  public constructor(layout: BuildLayout) {
    this.layout = layout;
  }

  public async checkAsync(modulePackages: readonly string[]): Promise<void> {
    const modules = new Set(modulePackages);
    for (const name of modules) {
      const folder = this.layout.locateInstalledPackage(name);
      const others = new Set([...modules].filter(t => t !== name));
      const listed = new Set([name, ...await InstalledPackages.readDependencyNamesAsync(folder, Resources.windowImportFields)]);
      for (const specifier of await ModuleWindowImports.readWindowImportsAsync(name, folder)) {
        const imported = ModuleWindowImports.namePackage(specifier);
        if (others.has(imported) && specifier !== Resources.formatWindowEntry(imported))
          throw new BuildException(Resources.formatWindowImportOtherModule(name, specifier, Resources.formatWindowEntry(imported)));
        if (!others.has(imported) && !listed.has(imported))
          throw new BuildException(Resources.formatWindowImportUnlisted(name, specifier, imported));
      }
    }
  }

  private static async readWindowImportsAsync(name: string, folder: string): Promise<readonly string[]> {
    const exports = JsonReader.parse(await TextFile.readAsync(path.join(folder, Resources.packageManifestFileName))).toJson()[Resources.manifestExportsField];
    const entry = ModuleWindowImports.resolveExport(Object.isPlainObject(exports) ? new Map(Object.entries(exports)).get(Resources.windowExportPath) : null);
    const file = Object.isNull(entry) ? null : path.join(folder, entry);
    if (Object.isNull(file) || !existsSync(file))
      throw new BuildException(Resources.formatWindowExportMissing(name));
    const specifiers = new Set<string>();
    for (const source of await new ImportClosure(folder).listAsync(file))
      for (const literal of new SourceScanner(await TextFile.readAsync(source)).scan().imports)
        if (!literal.value.startsWith(Resources.relativeSpecifierPrefix))
          specifiers.add(literal.value);
    return [...specifiers].sort();
  }

  private static resolveExport(value: JsonValue | undefined): string | null {
    if (Object.isString(value))
      return value;
    if (!Object.isPlainObject(value))
      return null;
    const conditions = new Map(Object.entries(value));
    for (const condition of Resources.windowExportConditions) {
      const resolved = ModuleWindowImports.resolveExport(conditions.get(condition));
      if (!Object.isNull(resolved))
        return resolved;
    }
    return null;
  }

  private static namePackage(specifier: string): string {
    const segments = specifier.split(Resources.pathSegmentSeparator);
    return segments.slice(0, specifier.startsWith(Resources.packageScopeMark) ? Resources.scopedPackageNameSegments : Resources.packageNameSegments).join(Resources.pathSegmentSeparator);
  }
}
