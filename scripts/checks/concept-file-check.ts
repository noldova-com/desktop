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
import ts from "typescript";

import { ApiException } from "../api/api.exception.ts";
import { Resources } from "../resources.ts";
import type { RepositoryFiles } from "../structure/repository-files.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ConceptFileCheck implements ICheck {
  private readonly root: string;
  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = Resources.conceptFileTitle;

  public constructor(root: string, files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.root = root;
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const commands = await this.readCommandsAsync();
    if (Object.isNull(commands)) {
      output.write(Resources.conceptFileNotManifest);
      return false;
    }

    const entries = new Set(commands.flatMap(t => t.split(Resources.conceptFileCommandSeparator)));
    const files = (await this.files.listAsync()).filter(t => ConceptFileCheck.isProductionScript(t) && !entries.has(t));
    let findings: readonly string[];
    try {
      findings = await this.syntax.readAsync(files, (t, u) => ConceptFileCheck.inspect(t, u));
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings = [error.message];
    }

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(Resources.formatConceptFileChecked(files.length));
    return findings.length === 0;
  }

  private static isProductionScript(file: string): boolean {
    return Resources.conceptScriptFile.test(file)
      && !file.endsWith(Resources.declarationsExtension)
      && !file.split(Resources.pathSeparator).some(t => Resources.sourceTestFolders.has(t));
  }

  private static inspect(file: string, source: ts.SourceFile): readonly string[] {
    const concepts = source.statements.filter(t => ConceptFileCheck.isConcept(t));
    const [concept, ...others] = concepts;
    if (Object.isUndefined(concept))
      return [];
    if (others.length > 0)
      return [Resources.formatConceptFileConcepts(file, concepts.map(t => ConceptFileCheck.readName(t) ?? Resources.anonymousDeclarationName))];

    const name = ConceptFileCheck.readName(concept);
    const location = Resources.formatFileLineLocation(file, source.getLineAndCharacterOfPosition(concept.getStart(source)).line + 1);
    if (Object.isNull(name))
      return [Resources.formatConceptFileUnnamed(location)];
    const expected = Resources.formatConceptFileName(name, path.posix.extname(file));
    return path.posix.basename(file) === expected ? [] : [Resources.formatConceptFileMisplaced(location, name, expected)];
  }

  private static isConcept(statement: ts.Statement): statement is ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration {
    return ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement);
  }

  private static readName(concept: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration): string | null {
    return ts.isClassDeclaration(concept) ? concept.name?.text ?? null : concept.name.text;
  }

  private async readCommandsAsync(): Promise<readonly string[] | null> {
    try {
      const manifest = JsonReader.parse(await readFile(path.join(this.root, Resources.manifestFile), Resources.encoding));
      if (!manifest.hasField(Resources.conceptFileScriptsField))
        return [];
      return Object.values(manifest.readObject(Resources.conceptFileScriptsField).toJson()).filter(t => Object.isString(t)).map(t => String(t));
    }
    catch {
      return null;
    }
  }
}
