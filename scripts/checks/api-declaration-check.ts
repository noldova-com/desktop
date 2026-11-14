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

import type { ApiCatalog } from "../api/api-catalog.ts";
import { ApiDeclarationSession } from "../api/api-declaration-session.ts";
import type { ApiPackage } from "../api/api-package.ts";
import { ApiProgram } from "../api/api-program.ts";
import { ApiSurfaceReader } from "../api/api-surface.reader.ts";
import { ApiException } from "../api/api.exception.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ApiDeclarationCheck implements ICheck {
  private readonly catalog: ApiCatalog;
  private readonly session: ApiDeclarationSession;

  public readonly title: string = Resources.apiDeclarationCheckTitle;

  public constructor(root: string, catalog: ApiCatalog) {
    this.catalog = catalog;
    this.session = new ApiDeclarationSession(root);
  }

  public async runAsync(output: Writable): Promise<boolean> {
    return await this.catalog.inspectEachAsync(output, Resources.apiDeclarationNoPackages, Resources.apiDeclarationVerdict, t => this.inspectAsync(t));
  }

  private static readErrors(api: ApiProgram, file: string): readonly string[] {
    const [source] = api.readModule(file);
    const diagnostics = [...api.program.getSyntacticDiagnostics(source), ...api.program.getSemanticDiagnostics(source)];
    return diagnostics.filter(t => t.category === ts.DiagnosticCategory.Error).map(t => ApiProgram.describe(t));
  }

  private async inspectAsync(apiPackage: ApiPackage): Promise<readonly string[]> {
    try {
      const packed = apiPackage.packedDeclarations;
      const files = [apiPackage.implementation, apiPackage.declarations, ...Object.isNull(packed) ? [] : [packed]];
      return await this.session.useAsync(apiPackage, Resources.apiDeclarationPurpose, files, t => {
        const errors = ApiDeclarationCheck.readErrors(t, apiPackage.declarations);
        if (errors.length > 0)
          return errors;
        const reader = new ApiSurfaceReader(t, apiPackage.visibility);
        const implemented = reader.read(apiPackage.implementation);
        const differences = implemented.compare(reader.read(apiPackage.declarations));
        return Object.isNull(packed) ? differences : [...differences, ...implemented.compare(reader.read(packed)).map(u => Resources.formatApiDeclarationPacked(u))];
      });
    }
    catch (error) {
      return [ApiException.describe(error)];
    }
  }
}
