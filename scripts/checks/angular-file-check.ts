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
import ts from "typescript";

import { ApiException } from "../api/api.exception.ts";
import type { RepositoryFiles } from "../structure/repository-files.ts";
import type { SyntaxTreeReader } from "../structure/syntax-tree.reader.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import { Resources } from "../resources.ts";
import { AngularFileCheckResources } from "./angular-file-check.resources.ts";

export class AngularFileCheck implements ICheck {
  private readonly files: RepositoryFiles;
  private readonly syntax: SyntaxTreeReader;

  public readonly title: string = AngularFileCheckResources.title;

  public constructor(files: RepositoryFiles, syntax: SyntaxTreeReader) {
    this.files = files;
    this.syntax = syntax;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const listed = await this.files.listAsync();
    const tracked = new Set(listed);
    const files = listed.filter(t => AngularFileCheck.isAppFile(t));
    const sources = listed.filter(t => AngularFileCheckResources.sourceFile.test(t) && !t.endsWith(Resources.declarationsExtension));
    let findings: readonly string[];
    try {
      findings = await this.syntax.readAsync(sources,
        (t, u) => [...AngularFileCheck.isAppFile(t) ? AngularFileCheck.inspect(t, u, tracked) : [], ...AngularFileCheck.findOnPush(t, u)]);
    }
    catch (error) {
      if (!(error instanceof ApiException))
        throw error;
      findings = [error.message];
    }

    for (const finding of findings)
      output.write(`${finding}${Resources.lineEnd}`);
    output.write(AngularFileCheckResources.formatChecked(files.length, sources.length));
    return findings.length === 0;
  }

  private static isAppFile(file: string): boolean {
    return AngularFileCheckResources.appFile.test(file)
      && !file.endsWith(Resources.declarationsExtension)
      && !file.split(Resources.pathSeparator).some(t => Resources.sourceTestFolders.has(t));
  }

  private static inspect(file: string, source: ts.SourceFile, tracked: ReadonlySet<string>): readonly string[] {
    const fileName = path.posix.basename(file);
    const findings: string[] = [];
    let components = 0;
    let services = 0;
    for (const declaration of source.statements.filter(t => ts.isClassDeclaration(t))) {
      const className = declaration.name?.text ?? Resources.anonymousDeclarationName;
      const location = Resources.formatFileLineLocation(file, source.getLineAndCharacterOfPosition(declaration.getStart(source)).line + 1);
      const component = AngularFileCheck.findDecorator(declaration, AngularFileCheckResources.componentDecorator);
      if (!Object.isNull(component)) {
        components++;
        findings.push(...AngularFileCheck.inspectComponent(file, location, className, component, tracked));
      }
      if (!Object.isNull(AngularFileCheck.findDecorator(declaration, AngularFileCheckResources.injectableDecorator)) && className.endsWith(AngularFileCheckResources.serviceRole)) {
        services++;
        const expected = `${className.slice(0, -AngularFileCheckResources.serviceRole.length).replace(AngularFileCheckResources.wordStart, Resources.dash).toLowerCase()}${AngularFileCheckResources.serviceSuffix}`;
        if (fileName !== expected)
          findings.push(AngularFileCheckResources.formatMisplacedService(location, className, expected));
      }
    }
    if (fileName.endsWith(AngularFileCheckResources.componentSuffix) && components === 0)
      findings.push(AngularFileCheckResources.formatNoComponent(file));
    if (fileName.endsWith(AngularFileCheckResources.serviceSuffix) && services === 0)
      findings.push(AngularFileCheckResources.formatNoService(file));
    return findings;
  }

  private static inspectComponent(file: string, location: string, className: string, component: ts.CallExpression, tracked: ReadonlySet<string>): readonly string[] {
    const fileName = path.posix.basename(file);
    if (!fileName.endsWith(AngularFileCheckResources.componentSuffix))
      return [AngularFileCheckResources.formatComponentFile(location, className)];

    const name = fileName.slice(0, -AngularFileCheckResources.componentSuffix.length);
    const findings: string[] = [];
    const expected = `${AngularFileCheckResources.formatPascalCase(name)}${AngularFileCheckResources.componentDecorator}`;
    if (className !== expected)
      findings.push(AngularFileCheckResources.formatComponentName(location, className, expected));
    const folder = path.posix.basename(path.posix.dirname(file));
    const segments = file.split(Resources.pathSeparator);
    if (segments.at(AngularFileCheckResources.componentsFolderIndex) !== AngularFileCheckResources.componentsFolder || segments.at(AngularFileCheckResources.appFolderIndex) !== Resources.angularAppFolder
      || name !== folder && !name.startsWith(`${folder}${Resources.dash}`))
      findings.push(AngularFileCheckResources.formatComponentFolder(location, className));
    const template = AngularFileCheckResources.formatTemplate(name);
    if (AngularFileCheck.readTemplateUrl(component) !== template)
      findings.push(AngularFileCheckResources.formatTemplateUnnamed(location, className, template));
    else if (!tracked.has(path.posix.join(path.posix.dirname(file), template)))
      findings.push(AngularFileCheckResources.formatTemplateMissing(location, className, template));
    return findings;
  }

  private static findOnPush(file: string, source: ts.SourceFile): readonly string[] {
    const names = new Set<string>();
    const namespaces = new Set<string>();
    for (const statement of source.statements)
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === Resources.angularCorePackage) {
        const bindings = statement.importClause?.namedBindings;
        if (!Object.isUndefined(bindings) && ts.isNamespaceImport(bindings))
          namespaces.add(bindings.name.text);
        for (const element of !Object.isUndefined(bindings) && ts.isNamedImports(bindings) ? bindings.elements : [])
          if ((element.propertyName ?? element.name).text === AngularFileCheckResources.componentDecorator)
            names.add(element.name.text);
      }

    const findings: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isDecorator(node) && ts.isCallExpression(node.expression) && AngularFileCheck.isComponent(node.expression.expression, names, namespaces)) {
        const options = node.expression.arguments.at(0);
        for (const property of !Object.isUndefined(options) && ts.isObjectLiteralExpression(options) ? options.properties : [])
          if (ts.isShorthandPropertyAssignment(property) && AngularFileCheck.readKey(property.name) === AngularFileCheckResources.changeDetectionField
            || ts.isPropertyAssignment(property) && AngularFileCheck.readKey(property.name) === AngularFileCheckResources.changeDetectionField && AngularFileCheck.isOnPush(property.initializer))
            findings.push(AngularFileCheckResources.formatOnPush(Resources.formatFileLineLocation(file, source.getLineAndCharacterOfPosition(property.getStart(source)).line + 1)));
      }
      node.forEachChild(visit);
    };
    source.forEachChild(visit);
    return findings;
  }

  private static isComponent(callee: ts.Node, names: ReadonlySet<string>, namespaces: ReadonlySet<string>): boolean {
    return ts.isIdentifier(callee) && names.has(callee.text)
      || ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text) && callee.name.text === AngularFileCheckResources.componentDecorator;
  }

  private static readKey(key: ts.Node): string | null {
    return ts.isIdentifier(key) || ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key) ? key.text : null;
  }

  private static isOnPush(value: ts.Node): boolean {
    return ts.isIdentifier(value) && value.text === AngularFileCheckResources.onPush
      || ts.isPropertyAccessExpression(value) && value.name.text === AngularFileCheckResources.onPush
      || ts.isElementAccessExpression(value) && AngularFileCheck.readKey(value.argumentExpression) === AngularFileCheckResources.onPush
      || ts.isNumericLiteral(value) && Number(value.text) === AngularFileCheckResources.onPushValue;
  }

  private static findDecorator(declaration: ts.ClassDeclaration, name: string): ts.CallExpression | null {
    for (const modifier of declaration.modifiers ?? [])
      if (ts.isDecorator(modifier) && ts.isCallExpression(modifier.expression) && ts.isIdentifier(modifier.expression.expression) && modifier.expression.expression.text === name)
        return modifier.expression;
    return null;
  }

  private static readTemplateUrl(component: ts.CallExpression): string | null {
    const options = component.arguments.at(0);
    if (Object.isUndefined(options) || !ts.isObjectLiteralExpression(options))
      return null;
    for (const property of options.properties)
      if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === AngularFileCheckResources.templateUrlField && ts.isStringLiteral(property.initializer))
        return property.initializer.text;
    return null;
  }
}
