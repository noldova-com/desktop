/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import ts from "typescript";

import { Resources } from "../resources.ts";
import type { ApiProgram } from "./api-program.ts";
import { ApiReach } from "./api-reach.ts";
import { ApiValue } from "./api-value.ts";
import type { ApiVisibility } from "./api-visibility.ts";
import type { IApiSymbolVisitor } from "./interfaces/i-api-symbol-visitor.ts";

export class ApiSymbolWalker {
  private static readonly CONTAINERS: number = ts.SymbolFlags.Class | ts.SymbolFlags.Interface | ts.SymbolFlags.Module | ts.SymbolFlags.Enum;

  private readonly api: ApiProgram;
  private readonly hidden: number;
  private readonly reach: ApiReach;

  public constructor(api: ApiProgram, visibility: ApiVisibility, reach: ApiReach = ApiReach.OWN) {
    this.api = api;
    this.hidden = visibility.includesProtected ? ts.ModifierFlags.Private : ts.ModifierFlags.Private | ts.ModifierFlags.Protected;
    this.reach = reach;
  }

  public walk(file: string, visit: IApiSymbolVisitor): void {
    const [source, module] = this.api.readModule(file);
    for (const exported of this.api.checker.getExportsOfModule(module))
      this.visit(exported.name, exported, this.reach.followsReExports ? null : source.fileName, visit);
  }

  private static nameMember(path: string, name: string): string {
    const special = Resources.apiSymbolMemberNames.get(name);
    return Object.isUndefined(special) ? Resources.formatApiMemberPath(path, name) : `${path}${special}`;
  }

  private visit(path: string, exported: ts.Symbol, fileName: string | null, visit: IApiSymbolVisitor): void {
    const symbol = (exported.flags & ts.SymbolFlags.Alias) === 0 ? exported : this.api.checker.getAliasedSymbol(exported);
    if ((symbol.flags & ts.SymbolFlags.TypeParameter) !== 0)
      return;
    const declarations = (symbol.declarations ?? []).filter(t => !this.api.program.isSourceFileFromExternalLibrary(t.getSourceFile()));
    const owned = Object.isNull(fileName) ? declarations : declarations.filter(t => t.getSourceFile().fileName === fileName);
    if (owned.length === 0 || owned.some(t => (ApiValue.readModifierFlags(t) & this.hidden) !== 0))
      return;
    visit(path, symbol, owned);
    if ((symbol.flags & ApiSymbolWalker.CONTAINERS) === 0)
      return;
    for (const [name, member] of ApiValue.listMembers(symbol.members))
      if (!name.startsWith(Resources.apiGeneratedPrefix))
        this.visit(ApiSymbolWalker.nameMember(path, name), member, fileName, visit);
    for (const [name, member] of ApiValue.listMembers(symbol.exports))
      if (name !== Resources.apiPrototypeMember && !name.startsWith(Resources.apiGeneratedPrefix))
        this.visit(Resources.formatApiExportPath(path, name), member, fileName, visit);
  }
}
