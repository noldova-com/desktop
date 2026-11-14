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
import { JsonReader } from "@noldova/context.json";

import type { ModuleCatalog } from "../../src/noldova.desktop.build/src/services/modules/module-catalog.ts";
import type { ModuleDeclaration } from "../../src/noldova.desktop.build/src/models/modules/module-declaration.ts";
import { PackageNaming } from "../../src/noldova.desktop.build/src/services/packages/package-naming.ts";
import type { SourceFile } from "../structure/source-file.ts";
import { SourceScanner } from "../../src/noldova.desktop.build/src/services/structure/source-scanner.ts";
import { SourceTree } from "../structure/source-tree.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ModuleImportCheck implements ICheck {
  private readonly root: string;
  private readonly tree: SourceTree;
  private readonly modules: ModuleCatalog;

  public readonly title: string = Resources.moduleImportCheckTitle;

  public constructor(root: string, tree: SourceTree, modules: ModuleCatalog) {
    this.root = root;
    this.tree = tree;
    this.modules = modules;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const inventory = await this.tree.readAsync();
    const files = inventory.files.filter(t => t.owner !== Resources.sourceShellOwner && t.isProduction && t.isScript);
    const declarations = (await this.modules.readAllAsync()).declarations;
    const dependencies = new Map<string, readonly string[]>(declarations.filter(t => !t.isFixture).map(t => [t.id, t.dependencies]));
    const modulePackages = new Map<string, ModuleDeclaration>(declarations.flatMap(t =>
      Resources.moduleImportPartNames.map(u => [PackageNaming.nameModulePackage(t.id, u, t.isFixture), t] as const)));
    const published = new Set<string>(inventory.files.flatMap(t => ModuleImportCheck.locatePublishedPackage(t.path) ?? []));
    const imports = files.flatMap(t => new SourceScanner(t.text).scan().imports.map(u => [t, u] as const));
    const outsideSpecifiers = imports.map(([, t]) => t.value)
      .filter(t => PackageNaming.isNoldova(t) && !PackageNaming.isOwn(ModuleImportCheck.readPackageName(t)));
    const outsidePackages = new Set<string>(outsideSpecifiers.map(t => ModuleImportCheck.readPackageName(t)));
    const exported = new Set<string>((await Promise.all([...outsidePackages].map(async t => {
      const subpaths = await this.readSubpathsAsync(t);
      return outsideSpecifiers.filter(u => ModuleImportCheck.readPackageName(u) === t && ModuleImportCheck.isPublishedSubpath(u, t, subpaths));
    }))).flat());
    const findings: string[] = [];
    for (const [file, literal] of imports) {
      const problem = ModuleImportCheck.findProblem(file, literal.value, dependencies.get(file.owner) ?? [], modulePackages, published, exported);
      if (!Object.isNull(problem))
        findings.push(Resources.formatModuleImportFinding(file.formatLocation(literal.line), literal.value, problem));
    }

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatModuleImportChecked(files.length));
    return findings.length === 0;
  }

  private static findProblem(file: SourceFile, specifier: string, dependencies: readonly string[], modulePackages: ReadonlyMap<string, ModuleDeclaration>, published: ReadonlySet<string>, exported: ReadonlySet<string>): string | null {
    if (specifier.startsWith(Resources.absoluteImportPrefix))
      return Resources.moduleImportAbsolutePath;
    if (specifier.startsWith(Resources.relativeImportPrefix))
      return ModuleImportCheck.isInside(path.posix.join(path.posix.dirname(file.path), specifier), file.packageRoot)
        ? null
        : Resources.formatModuleImportOutsidePackage(file.packageRoot);
    if (!PackageNaming.isNoldova(specifier))
      return null;

    const packageName = ModuleImportCheck.readPackageName(specifier);
    if (!PackageNaming.isOwn(packageName))
      return exported.has(specifier) ? null : ModuleImportCheck.findApiProblem(specifier, packageName);
    const module = modulePackages.get(packageName);
    if (Object.isUndefined(module))
      return published.has(packageName) ? ModuleImportCheck.findApiProblem(specifier, packageName) : Resources.moduleImportNotUsable;
    if (module.isFixture)
      return Resources.moduleImportNotUsable;
    if (module.id === file.owner)
      return null;
    if (!dependencies.includes(module.id))
      return Resources.formatModuleImportUndeclared(module.id, file.owner);
    return ModuleImportCheck.findApiProblem(specifier, packageName);
  }

  private static findApiProblem(specifier: string, packageName: string): string | null {
    return packageName === specifier ? null : Resources.formatModuleImportNotApi(packageName);
  }

  private static isPublishedSubpath(specifier: string, packageName: string, subpaths: readonly string[]): boolean {
    const subpath = `${Resources.moduleImportSubpathRoot}${specifier.slice(packageName.length)}`;
    return subpaths.some(t => {
      const wildcard = t.indexOf(Resources.moduleImportSubpathWildcard);
      if (wildcard < 0)
        return t === subpath;
      const prefix = t.slice(0, wildcard);
      const suffix = t.slice(wildcard + Resources.moduleImportSubpathWildcard.length);
      return subpath.length > prefix.length + suffix.length && subpath.startsWith(prefix) && subpath.endsWith(suffix);
    });
  }

  private static isInside(target: string, folder: string): boolean {
    return target === folder || target.startsWith(`${folder}${Resources.pathSeparator}`);
  }

  private static locatePublishedPackage(filePath: string): string | null {
    const folder = PackageNaming.locatePackageFolder(filePath);
    return Object.isNull(folder) ? null : PackageNaming.nameSourcePackage(folder);
  }

  private static readPackageName(specifier: string): string {
    return specifier.split(Resources.pathSeparator).slice(0, Resources.scopedPackageNameSegments).join(Resources.pathSeparator);
  }

  private async readSubpathsAsync(packageName: string): Promise<readonly string[]> {
    try {
      const manifest = JsonReader.parse(await readFile(path.join(this.root, Resources.nodeModulesFolder, ...packageName.split(Resources.pathSeparator), Resources.manifestFile), Resources.encoding));
      return manifest.hasField(Resources.manifestExportsField)
        ? Object.keys(manifest.readObject(Resources.manifestExportsField).toJson()).filter(t => t.startsWith(Resources.moduleImportSubpathPrefix))
        : [];
    }
    catch {
      return [];
    }
  }
}
