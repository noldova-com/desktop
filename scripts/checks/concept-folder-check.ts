/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/context.core";
import ts from "typescript";

import { ApiException } from "../api/api.exception.ts";
import { PackageNaming } from "../../src/noldova.desktop.build/src/services/packages/package-naming.ts";
import { Resources } from "../resources.ts";
import type { RepositoryFiles } from "../structure/repository-files.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ConceptFolderCheck implements ICheck {
  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = Resources.conceptFolderTitle;

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const files = (await this.files.listAsync()).filter(t => ConceptFolderCheck.isProductionScript(t));
    const findings = [...ConceptFolderCheck.inspectFolders(files)];
    try {
      findings.push(...await this.syntax.readAsync(files, (t, u) => ConceptFolderCheck.inspect(t, u)));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings.push(error.message);
    }

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatConceptFolderChecked(files.length));
    return findings.length === 0;
  }

  private static isProductionScript(file: string): boolean {
    return Resources.conceptScriptFile.test(file)
      && !file.endsWith(Resources.declarationsExtension)
      && !file.split(Resources.pathSeparator).some(t => Resources.sourceTestFolders.has(t));
  }

  private static inspectFolders(files: readonly string[]): ReadonlySet<string> {
    const findings = new Set<string>();
    for (const file of files) {
      const folders = file.split(Resources.pathSeparator).slice(0, -1);
      const packageFolder = PackageNaming.locatePackageFolder(file);
      for (const [index, folder] of folders.entries()) {
        const location = folders.slice(0, index + 1).join(Resources.pathSeparator);
        if (location !== packageFolder && !Resources.conceptFolderKebabCase.test(folder))
          findings.add(Resources.formatConceptFolderNotKebabCase(location));
      }
      const [root, category] = ConceptFolderCheck.locate(file);
      if (!Object.isNull(root) && !Object.isUndefined(category) && !Resources.conceptFolderCategories.has(category)
        && !(root.endsWith(`${Resources.pathSeparator}${Resources.angularAppFolder}`) && Resources.conceptFolderAngularFolders.has(category)))
        findings.add(Resources.formatConceptFolderNotCategory(root, category));
    }
    return findings;
  }

  private static locate(file: string): readonly [root: string | null, category: string | undefined] {
    const segments = file.split(Resources.pathSeparator);
    const source = segments.indexOf(Resources.sourceFolder, 1);
    if (segments[0] !== Resources.sourceFolder || source === -1)
      return [null, undefined];
    const start = segments.slice(source + 1, source + 2).some(t => Resources.conceptFolderSourceTrees.has(t)) ? source + 2 : source + 1;
    const [category] = segments.slice(start, -1);
    return [segments.slice(0, start).join(Resources.pathSeparator), category];
  }

  private static inspect(file: string, source: ts.SourceFile): readonly string[] {
    const [root, category] = ConceptFolderCheck.locate(file);
    const isScript = Object.isNull(root);
    const folders = file.split(Resources.pathSeparator).slice(0, -1);
    const holder = Resources.conceptFolderKinds.find(t => isScript ? t === Resources.conceptFolderInterfaces && folders.includes(t[0]) : t[0] === category) ?? null;
    const concepts = source.statements.filter(t => ConceptFolderCheck.isConcept(t));
    if (!Object.isNull(holder) && concepts.length === 0)
      return [Resources.formatConceptFolderNoConcept(file, holder[0])];

    const findings: string[] = [];
    for (const concept of concepts) {
      const kind = ConceptFolderCheck.findKind(concept, isScript);
      const location = Resources.formatFileLineLocation(file, source.getLineAndCharacterOfPosition(concept.getStart(source)).line + 1);
      const name = concept.name?.text ?? Resources.anonymousDeclarationName;
      if (!Object.isNull(kind) && kind !== holder)
        findings.push(Resources.formatConceptFolderOutside(location, name, kind[1], kind[0]));
      else if (!Object.isNull(holder) && kind !== holder)
        findings.push(Resources.formatConceptFolderWrongKind(location, name, holder[0], holder[1]));
    }
    return findings;
  }

  private static isConcept(statement: ts.Statement): statement is ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration {
    return ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement);
  }

  private static findKind(concept: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration, isScript: boolean): readonly [folder: string, kind: string] | null {
    if (ts.isInterfaceDeclaration(concept))
      return Resources.conceptFolderInterfaces;
    if (isScript)
      return null;
    if (ts.isEnumDeclaration(concept))
      return Resources.conceptFolderEnums;
    if (ts.isTypeAliasDeclaration(concept))
      return Resources.conceptFolderTypes;
    return concept.name?.text.endsWith(Resources.conceptFolderExceptionSuffix) === true ? Resources.conceptFolderExceptions : null;
  }
}
