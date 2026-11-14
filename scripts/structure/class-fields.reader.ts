/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { readFile } from "node:fs/promises";
import ts from "typescript";

import { Resources } from "../resources.ts";

export class ClassFieldsReader {
  private readonly fields: ReadonlyMap<string, ts.Expression>;

  private constructor(fields: ReadonlyMap<string, ts.Expression>) {
    this.fields = fields;
  }

  public static async readAsync(file: string): Promise<ClassFieldsReader> {
    const source = ts.createSourceFile(file, await readFile(file, Resources.encoding), ts.ScriptTarget.Latest);
    const fields = new Map<string, ts.Expression>();
    for (const statement of source.statements.filter(t => ts.isClassDeclaration(t)))
      for (const member of statement.members)
        if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && !Object.isUndefined(member.initializer))
          fields.set(member.name.text, member.initializer);
    return new ClassFieldsReader(fields);
  }

  public readList(name: string): readonly string[] | null {
    const list = this.fields.get(name);
    if (Object.isUndefined(list) || !ts.isArrayLiteralExpression(list))
      return null;
    const values = list.elements.map(t => this.readValue(t));
    return values.every(t => Object.isString(t)) ? values : null;
  }

  public readText(name: string): string | null {
    const value = this.fields.get(name);
    return Object.isUndefined(value) ? null : this.readValue(value);
  }

  private readValue(expression: ts.Expression): string | null {
    if (ts.isStringLiteral(expression) || ts.isRegularExpressionLiteral(expression))
      return expression.text;
    if (!ts.isPropertyAccessExpression(expression))
      return null;
    const target = this.fields.get(expression.name.text);
    return Object.isUndefined(target) ? null : this.readValue(target);
  }
}
