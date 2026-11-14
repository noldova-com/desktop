/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type { ILineProcess } from "../../interfaces/i-line-process.js";
import type { ILineProcessListener } from "../../interfaces/i-line-process-listener.js";
import type { ILineProcessStarter } from "../../interfaces/i-line-process-starter.js";
import { LineProcess } from "./line-process.js";

export class LineProcessStarter implements ILineProcessStarter {
  private readonly diagnostics: Writable;

  public constructor(diagnostics: Writable) {
    this.diagnostics = diagnostics;
  }

  public start(file: string, launchArguments: readonly string[], environment: Readonly<Record<string, string>>, listener: ILineProcessListener): ILineProcess {
    return new LineProcess(file, launchArguments, environment, listener, this.diagnostics);
  }

  public startGroup(file: string, launchArguments: readonly string[], environment: Readonly<Record<string, string>>, listener: ILineProcessListener): ILineProcess {
    return new LineProcess(file, launchArguments, environment, listener, this.diagnostics, true);
  }
}
