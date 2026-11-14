/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { PermissionRecord } from "./permission-record.js";
import type { ToolContent } from "./tool-content.js";

export class ToolResult {
  public readonly isFailure: false = false;
  public readonly content: readonly ToolContent[];
  public readonly structured: JsonObject | null;
  public readonly requests: readonly PermissionRecord[];

  public constructor(content: readonly ToolContent[], structured: JsonObject | null = null, requests: readonly PermissionRecord[] = []) {
    this.content = [...content];
    this.structured = structured;
    this.requests = [...requests];
  }

  public toJson(): JsonObject {
    return { isFailure: this.isFailure, content: this.content.map(t => t.toJson()), structured: this.structured, requests: this.requests.map(t => t.toJson()) };
  }
}
