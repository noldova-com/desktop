/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { PermissionDecision } from "../enums/permission-decision.js";
import type { IPermissionRequest } from "../interfaces/i-permission-request.js";
import type { IToolCallPermissions } from "../interfaces/i-tool-call-permissions.js";
import { PermissionOutcome } from "./permission-outcome.js";

export class ToolCall {
  private readonly permissions: IToolCallPermissions | undefined;
  private readonly now: () => number;
  private isSendingMarked: boolean;
  private isNothingSentMarked: boolean;
  private waited: number;
  private readonly firstDeadline: number;

  public readonly session: string;
  public readonly scope: string;
  public readonly bindings: JsonObject;
  public readonly arguments: JsonObject;
  public readonly signal: AbortSignal;

  public constructor(session: string, scope: string, bindings: JsonObject, input: JsonObject, deadline: number, signal: AbortSignal, permissions?: IToolCallPermissions,
    now: () => number = () => Date.now()) {
    this.permissions = permissions;
    this.now = now;
    this.isSendingMarked = false;
    this.isNothingSentMarked = false;
    this.waited = 0;
    this.firstDeadline = deadline;
    this.session = session;
    this.scope = scope;
    this.bindings = bindings;
    this.arguments = input;
    this.signal = signal;
  }

  public get deadline(): number {
    return this.firstDeadline + this.waited;
  }

  public get hasMarkedSending(): boolean {
    return this.isSendingMarked;
  }

  public get hasMarkedNothingSent(): boolean {
    return this.isNothingSentMarked;
  }

  public markSending(): void {
    this.signal.throwIfAborted();
    this.isSendingMarked = true;
    this.isNothingSentMarked = false;
  }

  public markNothingSent(): void {
    this.isNothingSentMarked = true;
  }

  public async requestPermissionAsync(request: IPermissionRequest): Promise<PermissionOutcome> {
    if (Object.isUndefined(this.permissions))
      return new PermissionOutcome(PermissionDecision.Denied);
    const started = this.now();
    try {
      return await this.permissions.requestAsync(request, this.signal);
    }
    finally {
      this.waited += this.now() - started;
    }
  }
}
