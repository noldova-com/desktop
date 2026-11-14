/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "../interfaces/i-module-log.js";
import type { IToolHandler } from "../interfaces/i-tool-handler.js";
import type { ToolDescriptor } from "./tool-descriptor.js";

export class RegisteredTool {
  public readonly moduleId: string;
  public readonly descriptor: ToolDescriptor;
  public readonly handler: IToolHandler;
  public readonly moduleTools: readonly string[];
  public readonly log: IModuleLog;

  public constructor(moduleId: string, descriptor: ToolDescriptor, handler: IToolHandler, moduleTools: readonly string[], log: IModuleLog) {
    this.moduleId = moduleId;
    this.descriptor = descriptor;
    this.handler = handler;
    this.moduleTools = [...moduleTools];
    this.log = log;
  }
}
