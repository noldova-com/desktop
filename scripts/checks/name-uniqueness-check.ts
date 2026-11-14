/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import type { ModuleCatalog } from "../../src/noldova.desktop.build/src/services/modules/module-catalog.ts";
import type { ModuleDeclaration } from "../../src/noldova.desktop.build/src/models/modules/module-declaration.ts";
import { Resources } from "../resources.ts";
import type { SourceFile } from "../structure/source-file.ts";
import { SourceScanner } from "../../src/noldova.desktop.build/src/services/structure/source-scanner.ts";
import { SourceTree } from "../structure/source-tree.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class NameUniquenessCheck implements ICheck {
  private readonly tree: SourceTree;
  private readonly modules: ModuleCatalog;

  public readonly title: string = Resources.nameUniquenessTitle;

  public constructor(tree: SourceTree, modules: ModuleCatalog) {
    this.tree = tree;
    this.modules = modules;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const inventory = await this.tree.readAsync();
    const files = inventory.files.filter(t => t.isProduction);
    const declarations = (await this.modules.readAllAsync()).declarations;
    const findings = [
      ...NameUniquenessCheck.checkSelectors(files.filter(t => t.isScript)),
      ...NameUniquenessCheck.checkTokens(files.filter(t => t.isStyle)),
      ...NameUniquenessCheck.checkPackageNames(files.filter(t => t.isManifest)),
      ...NameUniquenessCheck.checkModuleNames(declarations)
    ];
    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(
      Resources.formatNameUniquenessChecked(files.length, declarations.length));
    return findings.length === 0;
  }

  private static checkSelectors(files: readonly SourceFile[]): readonly string[] {
    const findings: string[] = [];
    const locations = new Map<string, string[]>();
    for (const file of files)
      for (const literal of new SourceScanner(file.text).scan().selectors)
        for (const selector of literal.value.split(Resources.nameUniquenessSelectorSeparator).map(t => t.trim())) {
          const location = file.formatLocation(literal.line);
          const prefix = NameUniquenessCheck.choosePrefix(Resources.nameUniquenessSelectorPrefix, file.owner);
          if (Resources.nameUniquenessElementSelector.test(selector) && !selector.startsWith(prefix))
            findings.push(Resources.formatNameUniquenessSelectorPrefix(location, selector, prefix));
          locations.set(selector, [...locations.get(selector) ?? [], location]);
        }

    for (const [selector, places] of locations)
      if (places.length > 1)
        findings.push(Resources.formatNameUniquenessRepeatedSelector(selector, places));
    return findings;
  }

  private static checkTokens(files: readonly SourceFile[]): readonly string[] {
    const findings: string[] = [];
    const owners = new Map<string, Map<string, string>>();
    for (const file of files)
      file.text.split(Resources.lineEnd).forEach((line, index) => {
        const location = file.formatLocation(index + 1);
        for (const [token] of line.matchAll(Resources.nameUniquenessTokenDefinition)) {
          const prefix = NameUniquenessCheck.choosePrefix(Resources.nameUniquenessTokenPrefix, file.owner);
          if (!token.startsWith(prefix))
            findings.push(Resources.formatNameUniquenessTokenPrefix(location, token, prefix));
          const definitions = owners.get(token) ?? new Map<string, string>();
          if (!definitions.has(file.owner))
            definitions.set(file.owner, location);
          owners.set(token, definitions);
        }
      });

    for (const [token, definitions] of owners)
      if (definitions.size > 1) {
        const places = [...definitions].map(([owner, location]) => Resources.formatNameUniquenessPlace(NameUniquenessCheck.describeOwner(owner), location));
        findings.push(Resources.formatNameUniquenessRepeatedToken(token, places));
      }
    return findings;
  }

  private static checkPackageNames(files: readonly SourceFile[]): readonly string[] {
    const findings: string[] = [];
    const manifests = new Map<string, string[]>();
    for (const file of files) {
      let manifest: JsonReader;
      try {
        manifest = JsonReader.parse(file.text);
      } catch (error) {
        findings.push(Resources.formatNameUniquenessUnreadableManifest(file.path, String(error)));
        continue;
      }
      const name = NameUniquenessCheck.readPackageName(manifest);
      if (!Object.isUndefined(name))
        manifests.set(name, [...manifests.get(name) ?? [], file.path]);
    }

    for (const [name, places] of manifests)
      if (places.length > 1)
        findings.push(Resources.formatNameUniquenessRepeatedPackage(name, places));
    return findings;
  }

  private static checkModuleNames(declarations: readonly ModuleDeclaration[]): readonly string[] {
    const findings: string[] = [];
    const ids = new Map<string, string[]>();
    const names = new Map<string, string[]>();
    for (const declaration of declarations) {
      ids.set(declaration.id, [...ids.get(declaration.id) ?? [], declaration.file]);
      for (const [kind, contributed] of declaration.contributions)
        for (const name of contributed)
          names.set(name, [...names.get(name) ?? [], Resources.formatNameUniquenessPlace(declaration.file, kind)]);
    }

    for (const [id, places] of ids)
      if (places.length > 1)
        findings.push(Resources.formatNameUniquenessRepeatedModule(id, places));
    for (const [name, places] of names)
      if (places.length > 1)
        findings.push(Resources.formatNameUniquenessRepeatedName(name, places));
    return findings;
  }

  private static readPackageName(manifest: JsonReader): string | undefined {
    const name = manifest.hasField(Resources.nameField) ? manifest.readValue(Resources.nameField) : undefined;
    return Object.isString(name) ? name : undefined;
  }

  private static choosePrefix(prefix: string, owner: string): string {
    return owner === Resources.sourceShellOwner ? prefix : Resources.formatNameUniquenessOwnedPrefix(prefix, owner);
  }

  private static describeOwner(owner: string): string {
    return owner === Resources.sourceShellOwner ? Resources.nameUniquenessShellLabel : Resources.formatNameUniquenessModuleOwner(owner);
  }
}
