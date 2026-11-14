/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import type { ToolFailureCode } from "../enums/tool-failure-code.js";
import { Resources } from "../resources.js";
import type { PermissionRecord } from "./permission-record.js";
import type { ToolContent } from "./tool-content.js";

export class ToolFailure {
  public readonly isFailure: true = true;
  public readonly code: ToolFailureCode;
  public readonly message: string;
  public readonly moduleCode: string | null;
  public readonly content: readonly ToolContent[];
  public readonly nextTool: string | null;
  public readonly requests: readonly PermissionRecord[];

  public constructor(
    code: ToolFailureCode,
    message: string,
    moduleCode: string | null = null,
    content: readonly ToolContent[] = [],
    nextTool: string | null = null,
    requests: readonly PermissionRecord[] = []) {
    ArgumentException.throwIfNullOrWhitespace(message, Resources.messageParameterName);

    this.code = code;
    this.message = message;
    this.moduleCode = moduleCode;
    this.content = [...content];
    this.nextTool = nextTool;
    this.requests = [...requests];
  }

  public toJson(): JsonObject {
    return {
      isFailure: this.isFailure,
      code: this.code,
      message: this.message,
      moduleCode: this.moduleCode,
      content: this.content.map(t => t.toJson()),
      nextTool: this.nextTool,
      requests: this.requests.map(t => t.toJson())
    };
  }
}
