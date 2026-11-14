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
import { JsonReader } from "@noldova/context.json";

import { PackageNaming } from "../../src/noldova.desktop.build/src/services/packages/package-naming.ts";
import { SourceScanner } from "../../src/noldova.desktop.build/src/services/structure/source-scanner.ts";
import type { SourceTree } from "../structure/source-tree.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class DeclaredDependencyCheck implements ICheck {
  private readonly tree: SourceTree;

  public readonly title: string = Resources.declaredDependencyCheckTitle;

  public constructor(tree: SourceTree) {
    this.tree = tree;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.tree.readAsync()).files;
    const manifests = new Map<string, ReadonlySet<string>>();
    const privateRoots = new Set<string>();
    for (const file of files.filter(t => t.isManifest && t.isProduction)) {
      const declared = DeclaredDependencyCheck.readDeclared(file.text);
      if (!Object.isNull(declared))
        manifests.set(path.posix.dirname(file.path), declared);
      if (DeclaredDependencyCheck.isPrivate(file.text))
        privateRoots.add(path.posix.dirname(file.path));
    }

    const findings: string[] = [];
    let checked = 0;
    for (const file of files.filter(t => t.isProduction && t.isScript && t.path.startsWith(`${t.packageRoot}${Resources.pathSeparator}${Resources.sourceFolderPrefix}`))) {
      const declared = manifests.get(file.packageRoot);
      if (Object.isUndefined(declared))
        continue;
      checked++;
      for (const literal of new SourceScanner(file.text).scan().imports) {
        const packageName = DeclaredDependencyCheck.readPackageName(literal.value);
        if (!Object.isNull(packageName) && !declared.has(packageName) && !(privateRoots.has(file.packageRoot) && PackageNaming.isOwn(packageName)))
          findings.push(Resources.formatDeclaredDependencyFinding(file.formatLocation(literal.line), literal.value, packageName, file.packageRoot));
      }
    }

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatDeclaredDependencyChecked(checked, manifests.size));
    return findings.length === 0;
  }

  private static isPrivate(text: string): boolean {
    try {
      return new Map(Object.entries(JsonReader.parse(text).toJson())).get(Resources.manifestPrivateField) === true;
    } catch {
      return false;
    }
  }

  private static readDeclared(text: string): ReadonlySet<string> | null {
    let manifest: JsonReader;
    try {
      manifest = JsonReader.parse(text);
    } catch {
      return null;
    }

    const declared = new Set<string>();
    const record = new Map(Object.entries(manifest.toJson()));
    const name = record.get(Resources.nameField);
    if (Object.isString(name))
      declared.add(name);
    for (const field of Resources.declaredDependencyFields) {
      const dependencies = record.get(field);
      if (Object.isObject(dependencies))
        for (const dependency of Object.keys(dependencies))
          declared.add(dependency);
    }
    return declared;
  }

  private static readPackageName(specifier: string): string | null {
    if (Resources.declaredDependencyLocalPrefixes.some(t => specifier.startsWith(t)) || specifier.startsWith(Resources.builtInImportPrefix))
      return null;
    const segments = specifier.split(Resources.pathSeparator);
    return segments.slice(0, specifier.startsWith(Resources.packageScopeMarker) ? Resources.scopedPackageNameSegments : Resources.unscopedPackageNameSegments).join(Resources.pathSeparator);
  }
}
