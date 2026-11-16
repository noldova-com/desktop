/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ModuleDeclaration } from "../../models/modules/module-declaration.ts";
import { Resources } from "../../resources.ts";

export class ModuleArtifacts {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public get declarationsFile(): string {
    return path.join(this.root, Resources.moduleDeclarationsFile);
  }

  public get windowPartsFile(): string {
    return path.join(this.root, Resources.moduleWindowPartsFile);
  }

  public locateDeclarations(outputFolder: string | null): string {
    return Object.isNull(outputFolder) ? this.declarationsFile : path.join(outputFolder, ...Resources.moduleOutputDeclarationsSegments);
  }

  public async writeAsync(declarations: readonly ModuleDeclaration[], outputFolder: string | null, noldovaDesktop: string | null): Promise<void> {
    const document = { formatVersion: Resources.moduleDeclarationsFormatVersion, ...Object.isNull(noldovaDesktop) ? {} : { noldovaDesktop }, modules: declarations.map(t => t.toJson()) };
    await ModuleArtifacts.writeFileAsync(this.locateDeclarations(outputFolder), Resources.formatJsonDocument(document));

    const sources = declarations
      .filter(t => !Object.isNull(t.windowEntry))
      .map(t => Resources.formatWindowPartSource(
        t.id,
        t.dependencies,
        Resources.windowPartSourceKinds.map(u => t.contributions.get(u) ?? []),
        ModuleArtifacts.locateWindowImport(t),
        [t.contributions.get(Resources.placeholdersKind) ?? [], t.optionalDependencies, t.settingsPages, ModuleArtifacts.listFormerDocumentNames(t)]));
    const menus = declarations
      .filter(t => t.menus.places.length > 0 || t.menus.groups.length > 0)
      .map(t => Resources.formatModuleMenusEntry(t.id, t.menus.toJson()));
    await ModuleArtifacts.writeFileAsync(this.windowPartsFile, Resources.formatWindowPartsFile(sources, menus));
  }

  private static listFormerDocumentNames(declaration: ModuleDeclaration): readonly (readonly [string, string])[] {
    const documents = declaration.contributions.get(Resources.documentsKind) ?? [];
    return [...declaration.formerNames].filter(([name]) => documents.includes(name)).flatMap(([name, formers]) => formers.map(t => [t, name] as const));
  }

  private static locateWindowImport(declaration: ModuleDeclaration): string {
    const entry = String(declaration.windowEntry);
    return Object.isNull(declaration.packageName) ? path.posix.relative(path.posix.dirname(Resources.moduleWindowPartsFile), entry) : entry;
  }

  private static async writeFileAsync(file: string, text: string): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
}
