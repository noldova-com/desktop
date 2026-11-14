/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import type { IPseudoTerminalLibrary } from "../interfaces/i-pseudo-terminal-library.js";
import type { IPseudoTerminalStartOptions } from "../interfaces/i-pseudo-terminal-start-options.js";
import { Resources } from "../resources.js";
import { TerminalSize } from "./terminal-size.js";

export class PseudoTerminalRequest {
  public readonly library: IPseudoTerminalLibrary;
  public readonly program: string;
  public readonly arguments: readonly string[];
  public readonly commandLine: string | undefined;
  public readonly workingFolder: string;
  public readonly columns: number;
  public readonly rows: number;
  public readonly environment: Readonly<Record<string, string>>;
  public readonly inheritsCursor: boolean;
  public readonly signal: AbortSignal | undefined;

  public constructor(
    library: IPseudoTerminalLibrary,
    program: string,
    launchArguments: readonly string[],
    workingFolder: string,
    columns: number,
    rows: number,
    environment: Readonly<Record<string, string>>,
    options: IPseudoTerminalStartOptions = {}) {
    ArgumentException.throwIfNullOrWhitespace(program, Resources.programParameterName);
    if (!path.isAbsolute(workingFolder))
      throw new ArgumentException(Resources.workingFolderNotAbsolute, Resources.workingFolderParameterName);
    const invalid = Object.keys(environment).find(t => !Resources.environmentNamePattern.test(t));
    if (!Object.isUndefined(invalid))
      throw new ArgumentException(Resources.formatEnvironmentNameInvalid(invalid), Resources.environmentParameterName);
    TerminalSize.check(columns, rows);
    this.library = library;
    this.program = program;
    this.arguments = [...launchArguments];
    this.commandLine = options.commandLine;
    this.workingFolder = workingFolder;
    this.columns = columns;
    this.rows = rows;
    this.environment = { ...environment };
    this.inheritsCursor = options.inheritCursor ?? false;
    this.signal = options.signal;
  }
}
