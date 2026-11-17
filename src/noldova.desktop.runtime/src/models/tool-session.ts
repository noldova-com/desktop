/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { TurnOutcome } from "../enums/turn-outcome.js";
import type { IToolCallOptions } from "../interfaces/i-tool-call-options.js";
import type { IToolSessionHost } from "../interfaces/i-tool-session-host.js";
import type { ToolDescriptor } from "./tool-descriptor.js";
import type { ToolFailure } from "./tool-failure.js";
import type { ToolResult } from "./tool-result.js";

export class ToolSession {
  private readonly host: IToolSessionHost;

  public readonly id: string;
  public readonly scope: string;
  public readonly bindings: JsonObject;

  public constructor(id: string, scope: string, bindings: JsonObject, host: IToolSessionHost) {
    this.host = host;
    this.id = id;
    this.scope = scope;
    this.bindings = bindings;
  }

  public listTools(): readonly ToolDescriptor[] {
    return this.host.listTools();
  }

  public callAsync(name: string, input: JsonObject, options: IToolCallOptions = {}): Promise<ToolResult | ToolFailure> {
    return this.host.callAsync(this, name, input, options);
  }

  public endTurn(outcome: TurnOutcome): void {
    this.host.endTurn(this, outcome);
  }

  public end(): void {
    this.host.end(this);
  }
}
