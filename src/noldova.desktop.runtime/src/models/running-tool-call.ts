/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";

import "@noldova/context.core";

import { PermissionDecision } from "../enums/permission-decision.js";
import { ToolAbortReason } from "../enums/tool-abort-reason.js";
import { ToolRisk } from "../enums/tool-risk.js";
import type { IPermissionRequest } from "../interfaces/i-permission-request.js";
import type { IToolCallPermissions } from "../interfaces/i-tool-call-permissions.js";
import { Resources } from "../resources.js";
import { PermissionOutcome } from "./permission-outcome.js";
import { PermissionRecord } from "./permission-record.js";
import type { RegisteredTool } from "./registered-tool.js";
import type { ToolCall } from "./tool-call.js";
import type { ToolSession } from "./tool-session.js";

export class RunningToolCall implements IToolCallPermissions {
  private readonly ask: (request: IPermissionRequest, signal: AbortSignal, id: string) => Promise<PermissionOutcome>;
  private readonly records: (PermissionRecord | null)[] = [];
  private call: ToolCall | undefined;
  private timer: NodeJS.Timeout | undefined;
  private remaining: number;
  private deadline: number;
  private isEnded: boolean;
  private isWaitingForPermission: boolean;
  private answered: PromiseWithResolvers<void> | null;
  private readonly withdrawal: AbortController;

  public readonly tool: RegisteredTool;
  public readonly session: ToolSession;
  public readonly controller: AbortController;

  public constructor(tool: RegisteredTool, session: ToolSession, ask: (request: IPermissionRequest, signal: AbortSignal, id: string) => Promise<PermissionOutcome>) {
    this.ask = ask;
    this.call = undefined;
    this.timer = undefined;
    this.remaining = 0;
    this.deadline = 0;
    this.isEnded = false;
    this.isWaitingForPermission = false;
    this.answered = null;
    this.withdrawal = new AbortController();
    this.tool = tool;
    this.session = session;
    this.controller = new AbortController();
  }

  public get isPastPointOfNoReturn(): boolean {
    if (!this.tool.descriptor.canBeUncertain || Object.isUndefined(this.call))
      return false;
    return !this.tool.descriptor.marksSending || (this.call.hasMarkedSending && !this.call.hasMarkedNothingSent);
  }

  public get isStarted(): boolean {
    return !Object.isUndefined(this.call);
  }

  public get isWaiting(): boolean {
    return this.isWaitingForPermission;
  }

  public get requests(): readonly PermissionRecord[] {
    return this.records.filter(t => !Object.isNull(t));
  }

  public start(call: ToolCall): void {
    this.call = call;
  }

  public startDeadline(milliseconds: number): void {
    this.remaining = milliseconds;
    this.resumeDeadline();
  }

  public end(): void {
    this.isEnded = true;
    clearTimeout(this.timer);
  }

  public abort(reason: ToolAbortReason): void {
    this.controller.abort(reason);
  }

  public withdraw(reason: ToolAbortReason): void {
    this.withdrawal.abort(reason);
  }

  public whenAnsweredAsync(): Promise<void> {
    return this.answered?.promise ?? Promise.resolve();
  }

  public async requestAsync(request: IPermissionRequest, signal: AbortSignal): Promise<PermissionOutcome> {
    const id = randomUUID();
    const slot = this.records.push(null) - 1;
    const asked = AbortSignal.any([signal, this.withdrawal.signal]);
    const outcome = this.refuse(request, asked, id) ?? await this.askAsync(request, asked, id);
    this.records[slot] = new PermissionRecord(id, this.riskOf(request), outcome.decision, outcome.isRemembered);
    return outcome;
  }

  private refuse(request: IPermissionRequest, signal: AbortSignal, id: string): PermissionOutcome | null {
    if (signal.aborted)
      return new PermissionOutcome(PermissionDecision.Withdrawn, false, id);
    const refusal = this.isEnded ? Resources.permissionCallEnded : this.isWaitingForPermission ? Resources.permissionAlreadyWaiting : null;
    if (Object.isNull(refusal))
      return null;
    this.tool.log.write(Resources.formatPermissionDenied(request.action, refusal));
    return new PermissionOutcome(PermissionDecision.Denied, false, id);
  }

  private async askAsync(request: IPermissionRequest, signal: AbortSignal, id: string): Promise<PermissionOutcome> {
    const answered = Promise.withResolvers<void>();
    this.isWaitingForPermission = true;
    this.answered = answered;
    clearTimeout(this.timer);
    this.remaining = Math.max(0, this.deadline - Date.now());
    try {
      return await this.ask(request, signal, id);
    }
    finally {
      this.isWaitingForPermission = false;
      this.answered = null;
      answered.resolve();
      if (!this.isEnded)
        this.resumeDeadline();
    }
  }

  private riskOf(request: IPermissionRequest): ToolRisk {
    try {
      return Resources.toolRisks.includes(request.risk) ? request.risk : ToolRisk.High;
    }
    catch {
      this.tool.log.write(Resources.formatPermissionRiskUnreadable(this.tool.descriptor.name));
      return ToolRisk.High;
    }
  }

  private resumeDeadline(): void {
    this.deadline = Date.now() + this.remaining;
    this.timer = setTimeout(() => this.abort(ToolAbortReason.DeadlineReached), this.remaining);
  }
}
