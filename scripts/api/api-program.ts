/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ts from "typescript";

import { Resources } from "../resources.ts";
import { ApiNotModuleException } from "./api-not-module.exception.ts";
import { ApiProgramUnreadableException } from "./api-program-unreadable.exception.ts";

export class ApiProgram {
  private readonly printer: ts.Printer = ts.createPrinter({ removeComments: true });

  public readonly program: ts.Program;
  public readonly checker: ts.TypeChecker;

  private constructor(program: ts.Program) {
    this.program = program;
    this.checker = program.getTypeChecker();
  }

  public static open(projectFile: string): ApiProgram {
    const problems: string[] = [];
    const parsed = ts.getParsedCommandLineOfConfigFile(projectFile, undefined, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: t => {
        problems.push(ApiProgram.describe(t));
      }
    });
    problems.push(...(parsed?.errors ?? []).map(t => ApiProgram.describe(t)));
    if (parsed === undefined || problems.length > 0)
      throw new ApiProgramUnreadableException(projectFile, problems);
    return new ApiProgram(ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options }));
  }

  public static describe(diagnostic: ts.Diagnostic): string {
    return Resources.formatApiDiagnostic(diagnostic.code, ts.flattenDiagnosticMessageText(diagnostic.messageText, Resources.lineEnd));
  }

  public readModule(file: string): readonly [ts.SourceFile, ts.Symbol] {
    const source = this.program.getSourceFile(file);
    const module = source === undefined ? undefined : this.checker.getSymbolAtLocation(source);
    if (source === undefined || module === undefined)
      throw new ApiNotModuleException(file);
    return [source, module];
  }

  public print(node: ts.Node): string {
    return this.printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());
  }
}
