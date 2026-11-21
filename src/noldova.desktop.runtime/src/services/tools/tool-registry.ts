/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { inspect } from "node:util";

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import type { JsonObject, JsonValue } from "@noldova/context.json";

import { AgentControlFailure } from "../../enums/agent-control-failure.js";
import { ToolAbortReason } from "../../enums/tool-abort-reason.js";
import { ToolFailureCode } from "../../enums/tool-failure-code.js";
import { AgentControlException } from "../../exceptions/agent-control.exception.js";
import { ToolFailureException } from "../../exceptions/tool-failure.exception.js";
import { ToolRegisteredException } from "../../exceptions/tool-registered.exception.js";
import type { IModuleLog } from "../../interfaces/i-module-log.js";
import type { IToolCallOptions } from "../../interfaces/i-tool-call-options.js";
import type { IToolHandler } from "../../interfaces/i-tool-handler.js";
import type { IToolSchemaValidator } from "../../interfaces/i-tool-schema.validator.js";
import type { IToolSessionHost } from "../../interfaces/i-tool-session-host.js";
import type { PermissionRecord } from "../../models/permission-record.js";
import { RegisteredTool } from "../../models/registered-tool.js";
import { Registration } from "../../models/registration.js";
import { RunningToolCall } from "../../models/running-tool-call.js";
import { ToolCall } from "../../models/tool-call.js";
import type { ToolDescriptor } from "../../models/tool-descriptor.js";
import { ToolFailure } from "../../models/tool-failure.js";
import { ToolResult } from "../../models/tool-result.js";
import { ToolSession } from "../../models/tool-session.js";
import { ToolTurns } from "../../models/tool-turns.js";
import { Resources } from "../../resources.js";
import { PermissionCenter } from "../permissions/permission-center.js";
import { ToolResultValidator } from "./tool-result.validator.js";
import { ToolSchemaValidator } from "./tool-schema.validator.js";

export class ToolRegistry implements IToolSessionHost {
  private static readonly ABORTS: ReadonlyMap<unknown, readonly [ToolFailureCode, string]> = new Map<unknown, readonly [ToolFailureCode, string]>([
    [ToolAbortReason.Stopped, [ToolFailureCode.Stopped, Resources.toolStopped]],
    [ToolAbortReason.DeadlineReached, [ToolFailureCode.TimedOut, Resources.toolTimedOut]],
    [ToolAbortReason.SwitchedOff, [ToolFailureCode.Unavailable, Resources.toolSwitchedOff]]
  ]);

  private readonly tools: Map<string, RegisteredTool> = new Map();
  private readonly sessions: Set<ToolSession> = new Set();
  private readonly running: Set<RunningToolCall> = new Set();
  private readonly handling: Set<RunningToolCall> = new Set();
  private readonly answering: Set<RunningToolCall> = new Set();
  private readonly endListeners: Set<(session: string) => void> = new Set();
  private readonly stopListeners: Set<(reason: string) => void> = new Set();
  private readonly sessionStopListeners: Set<(session: string, reason: string) => void> = new Set();
  private readonly resumeListeners: Set<() => void> = new Set();
  private readonly controlListeners: Set<() => void> = new Set();
  private readonly turns: ToolTurns = new ToolTurns();
  private readonly closedModules: Set<string> = new Set();
  private readonly createId: () => string;
  private readonly schemas: IToolSchemaValidator;
  private readonly validator: ToolResultValidator;
  private readonly endGraceMilliseconds: number;
  private isStoppedValue: boolean;
  private stopDepth: number = 0;
  private controlChanges: number = 0;

  public readonly permissions: PermissionCenter;

  public constructor(
    createId: () => string = randomUUID,
    schemas: IToolSchemaValidator = new ToolSchemaValidator(),
    permissions: PermissionCenter = new PermissionCenter(),
    endGraceMilliseconds: number = Resources.toolEndGraceMilliseconds) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(endGraceMilliseconds, Resources.endGraceParameterName);
    this.createId = createId;
    this.schemas = schemas;
    this.permissions = permissions;
    this.validator = new ToolResultValidator(schemas);
    this.endGraceMilliseconds = endGraceMilliseconds;
    this.isStoppedValue = false;
  }

  public get isStopped(): boolean {
    return this.isStoppedValue;
  }

  public get isActing(): boolean {
    return this.sessions.size > 0;
  }

  public register(moduleId: string, descriptor: ToolDescriptor, handler: IToolHandler, moduleTools: readonly string[], log: IModuleLog): Registration {
    if (this.tools.has(descriptor.name))
      throw new ToolRegisteredException(descriptor.name);
    this.schemas.checkSchema(descriptor.inputSchema, Resources.inputSchemaParameterName);
    if (!Object.isNull(descriptor.outputSchema))
      this.schemas.checkSchema(descriptor.outputSchema, Resources.outputSchemaParameterName);

    const tool = new RegisteredTool(moduleId, descriptor, handler, moduleTools, log);
    this.tools.set(descriptor.name, tool);
    return new Registration(() => this.unregister(tool));
  }

  public onSessionEnded(listener: (session: string) => void, log: IModuleLog): Registration {
    const handle = (session: string): void => {
      try {
        listener(session);
      }
      catch (error) {
        log.write(Resources.formatToolSessionListenerFailed(inspect(error)));
      }
    };
    this.endListeners.add(handle);
    return new Registration(() => this.endListeners.delete(handle));
  }

  public onStopped(listener: (reason: string) => void, log: IModuleLog): Registration {
    return ToolRegistry.listen(this.stopListeners, listener, log);
  }

  public onSessionStopped(listener: (session: string, reason: string) => void, log: IModuleLog): Registration {
    return ToolRegistry.listen(this.sessionStopListeners, listener, log);
  }

  public onResumed(listener: () => void, log: IModuleLog): Registration {
    return ToolRegistry.listen(this.resumeListeners, listener, log);
  }

  public onControlChanged(listener: () => void): Registration {
    const entry = (): void => listener();
    this.controlListeners.add(entry);
    return new Registration(() => this.controlListeners.delete(entry));
  }

  public stopAll(reason: string): void {
    ToolRegistry.checkReason(reason);
    if (this.isStoppedValue)
      return;
    this.isStoppedValue = true;
    const change = ++this.controlChanges;
    this.stopDepth++;
    try {
      for (const run of [...this.running])
        run.abort(ToolAbortReason.Stopped);
      this.permissions.withdrawAll();
      for (const listener of [...this.stopListeners])
        if (this.controlChanges === change && this.stopListeners.has(listener))
          listener(reason);
    }
    finally {
      this.stopDepth--;
    }
    if (this.controlChanges === change)
      this.reportControl();
  }

  public stopSession(moduleId: string, session: string, reason: string): void {
    ToolRegistry.checkReason(reason);
    if (this.stopDepth > 0)
      throw new AgentControlException(AgentControlFailure.SessionStopRefused, moduleId);
    const stopped = [...this.sessions].find(t => t.id === session);
    if (Object.isUndefined(stopped))
      return;
    this.stopDepth++;
    try {
      for (const run of [...this.running].filter(t => t.session === stopped))
        run.abort(ToolAbortReason.Stopped);
      for (const run of [...this.answering].filter(t => t.session === stopped))
        run.withdraw(ToolAbortReason.Stopped);
      for (const listener of [...this.sessionStopListeners])
        if (this.sessionStopListeners.has(listener))
          listener(session, reason);
    }
    finally {
      this.stopDepth--;
    }
  }

  public resumeAll(moduleId: string | null): void {
    if (!Object.isNull(moduleId) && (this.stopDepth > 0 || [...this.handling].some(t => t.tool.moduleId === moduleId)))
      throw new AgentControlException(AgentControlFailure.ResumeRefused, moduleId);
    if (!this.isStoppedValue)
      return;
    this.isStoppedValue = false;
    const change = ++this.controlChanges;
    for (const listener of [...this.resumeListeners])
      if (this.controlChanges === change && this.resumeListeners.has(listener))
        listener();
    if (this.controlChanges === change)
      this.reportControl();
  }

  public openSession(scope: string, bindings: JsonObject): ToolSession {
    if (scope.length > Resources.maximumToolScopeLength)
      throw new ArgumentOutOfRangeException(Resources.scopeParameterName, scope.length, Resources.formatToolScopeTooLong(Resources.maximumToolScopeLength));

    const session = new ToolSession(this.createId(), scope, bindings, this);
    this.sessions.add(session);
    if (this.sessions.size === 1)
      this.reportControl();
    return session;
  }

  public isOpen(session: ToolSession): boolean {
    return this.sessions.has(session);
  }

  public listTools(): readonly ToolDescriptor[] {
    return [...this.tools.values()].filter(t => !this.closedModules.has(t.moduleId)).map(t => t.descriptor);
  }

  public close(moduleId: string): void {
    this.closedModules.add(moduleId);
  }

  public callAsync(session: ToolSession, name: string, input: JsonObject, options: IToolCallOptions): Promise<ToolResult | ToolFailure> {
    const tool = this.tools.get(name);
    if (!this.sessions.has(session))
      return Promise.resolve(new ToolFailure(ToolFailureCode.Unavailable, Resources.toolSessionEnded));
    if (this.isStoppedValue)
      return Promise.resolve(new ToolFailure(ToolFailureCode.Stopped, Resources.toolsStopped));
    if (Object.isUndefined(tool))
      return Promise.resolve(new ToolFailure(ToolFailureCode.Unavailable, Resources.formatToolUnavailable(name)));
    if (this.closedModules.has(tool.moduleId))
      return Promise.resolve(new ToolFailure(ToolFailureCode.Unavailable, Resources.formatToolClosed(name)));

    const milliseconds = options.deadlineMilliseconds ?? tool.descriptor.deadline.default;
    const refusal = this.findRefusal(tool, session, input, milliseconds);
    if (!Object.isNull(refusal))
      return Promise.resolve(new ToolFailure(ToolFailureCode.Refused, refusal));

    const resource = tool.descriptor.resource;
    let turn: Promise<Registration | null> | null = Promise.resolve(null);
    if (!Object.isNull(resource)) {
      const target = ToolRegistry.resolve(resource, input, session.bindings);
      if (Object.isNullOrUndefined(target))
        return Promise.resolve(new ToolFailure(ToolFailureCode.Refused, Resources.formatToolResourceMissing(resource)));
      turn = this.turns.takeAsync(JSON.stringify([tool.moduleId, target], ToolRegistry.sortKeys), session.id);
    }
    if (Object.isNull(turn))
      return Promise.resolve(new ToolFailure(ToolFailureCode.Unavailable, Resources.toolResourceHeld));

    const run = new RunningToolCall(tool, session, (r, s, id) => this.permissions.requestAsync(tool.moduleId, tool.descriptor, tool.log, session, r, s, id));
    const taking = turn;
    this.running.add(run);
    return new Promise(resolve => this.start(run, input, milliseconds, taking, options.signal, t => resolve(ToolRegistry.withRequests(t, run.requests))));
  }

  public end(session: ToolSession): void {
    if (!this.sessions.delete(session))
      return;
    for (const run of [...this.running].filter(t => t.session === session))
      run.abort(ToolAbortReason.SessionEnded);
    for (const run of [...this.answering].filter(t => t.session === session))
      run.withdraw(ToolAbortReason.SessionEnded);
    for (const listener of [...this.endListeners])
      if (this.endListeners.has(listener))
        listener(session.id);
    if (!this.isActing)
      this.reportControl();
  }

  private start(
    run: RunningToolCall,
    input: JsonObject,
    milliseconds: number,
    turn: Promise<Registration | null>,
    caller: AbortSignal | undefined,
    resolve: (outcome: ToolResult | ToolFailure) => void): void {
    const cancel = (): void => run.abort(ToolAbortReason.Cancelled);
    run.startDeadline(milliseconds);
    let isSettled = false;
    let answerEnd: ((own: ToolFailureException | null) => void) | null = null;
    const end = (): void => {
      isSettled = true;
      run.end();
      caller?.removeEventListener(Resources.abortEvent, cancel);
      this.running.delete(run);
      this.answering.add(run);
      void Promise.all([turn, run.whenAnsweredAsync()]).then(([t]) => {
        this.answering.delete(run);
        t?.[Symbol.dispose]();
      });
    };
    const settle = (outcome: ToolResult | ToolFailure): void => {
      if (isSettled)
        return;
      end();
      resolve(outcome);
    };
    run.controller.signal.addEventListener(Resources.abortEvent, () => {
      const aborted = this.describeAbort(run);
      end();
      if (!run.isStarted) {
        resolve(this.describeEnd(run, aborted, null));
        return;
      }
      const own = Promise.withResolvers<ToolFailureException | null>();
      const timer = setTimeout(own.resolve, this.endGraceMilliseconds, null);
      answerEnd = own.resolve;
      void own.promise.then(t => {
        clearTimeout(timer);
        answerEnd = null;
        resolve(this.describeEnd(run, aborted, t));
      });
    }, { once: true });
    if (caller?.aborted === true)
      cancel();
    else
      caller?.addEventListener(Resources.abortEvent, cancel, { once: true });
    this.handling.add(run);
    this.runAsync(run, input, Date.now() + milliseconds, turn).finally(() => this.handling.delete(run)).then(
      t => {
        if (!Object.isNull(t))
          settle(t);
        answerEnd?.(null);
      },
      (error: unknown) => {
        if (!isSettled)
          settle(this.describeFailure(run, error));
        else if (!Object.isNull(answerEnd) && error instanceof ToolFailureException)
          answerEnd(error);
        else {
          answerEnd?.(null);
          if (error !== run.controller.signal.reason)
            ToolRegistry.writeDetail(run.tool, error, t => Resources.formatToolFailedLate(run.tool.descriptor.name, t));
        }
      });
  }

  private async runAsync(run: RunningToolCall, input: JsonObject, deadline: number, turn: Promise<Registration | null>): Promise<ToolResult | ToolFailure | null> {
    await turn;
    if (run.controller.signal.aborted)
      return null;
    if (this.closedModules.has(run.tool.moduleId))
      return new ToolFailure(ToolFailureCode.Unavailable, Resources.formatToolClosed(run.tool.descriptor.name));
    const session = run.session;
    const call = new ToolCall(session.id, session.scope, session.bindings, input, deadline, run.controller.signal, run);
    run.start(call);
    return this.validator.checkResult(run.tool, await run.tool.handler.handleAsync(call), run.isPastPointOfNoReturn);
  }

  private describeFailure(run: RunningToolCall, error: unknown): ToolFailure {
    const tool = run.tool;
    if (error instanceof ToolFailureException) {
      ToolRegistry.writeCause(tool, error);
      return this.validator.checkFailure(tool, error.failure, run.isPastPointOfNoReturn);
    }
    ToolRegistry.writeDetail(tool, error, t => Resources.formatToolHandlerFailed(tool.descriptor.name, t));
    const failure = new ToolFailure(ToolFailureCode.Unavailable, Resources.toolInternalFailure, Resources.formatModuleCode(tool.moduleId, Resources.internalFailureCode));
    return this.validator.checkFailure(tool, failure, run.isPastPointOfNoReturn);
  }

  private describeAbort(run: RunningToolCall): ToolFailure {
    const [code, message] = run.isWaiting
      ? [ToolFailureCode.Withdrawn, Resources.toolWithdrawn]
      : ToolRegistry.ABORTS.get(run.controller.signal.reason) ?? [ToolFailureCode.Cancelled, Resources.toolCancelled];
    return new ToolFailure(code, message);
  }

  private describeEnd(run: RunningToolCall, aborted: ToolFailure, own: ToolFailureException | null): ToolFailure {
    if (Object.isNull(own))
      return this.validator.checkFailure(run.tool, aborted, run.isPastPointOfNoReturn);
    const { message, moduleCode, content, nextTool } = own.failure;
    if (this.validator.isWellFormed(run.tool, new ToolFailure(aborted.code, message, moduleCode, content, nextTool))) {
      ToolRegistry.writeCause(run.tool, own);
      return this.validator.checkFailure(run.tool, new ToolFailure(aborted.code, message, moduleCode, content, aborted.nextTool), run.isPastPointOfNoReturn);
    }
    ToolRegistry.writeDetail(run.tool, own, t => Resources.formatToolFailedLate(run.tool.descriptor.name, t));
    return this.validator.checkFailure(run.tool, aborted, run.isPastPointOfNoReturn);
  }

  private findRefusal(tool: RegisteredTool, session: ToolSession, input: JsonObject, milliseconds: number): string | null {
    if ([...this.running].filter(t => t.session === session).length >= Resources.maximumToolCallsInFlight)
      return Resources.formatToolCallsInFlight(Resources.maximumToolCallsInFlight);
    if (Buffer.byteLength(JSON.stringify(input), Resources.utf8Encoding) > Resources.maximumToolArgumentBytes)
      return Resources.toolArgumentsTooLarge;
    if (!Number.isInteger(milliseconds) || milliseconds < 1 || milliseconds > tool.descriptor.deadline.maximum)
      return Resources.formatToolDeadlineInvalid(tool.descriptor.deadline.maximum);
    return this.schemas.findProblem(tool.descriptor.inputSchema, input);
  }

  private reportControl(): void {
    for (const listener of [...this.controlListeners])
      if (this.controlListeners.has(listener))
        listener();
  }

  private unregister(tool: RegisteredTool): void {
    if (this.tools.get(tool.descriptor.name) !== tool)
      return;
    this.tools.delete(tool.descriptor.name);
    for (const run of [...this.running].filter(t => t.tool === tool))
      run.abort(ToolAbortReason.SwitchedOff);
    for (const run of [...this.answering].filter(t => t.tool === tool))
      run.withdraw(ToolAbortReason.SwitchedOff);
  }

  private static checkReason(reason: string): void {
    if (String.isNullOrWhitespace(reason) || reason.length > Resources.maximumStopReasonLength || Resources.lineBreakPattern.test(reason))
      throw new ArgumentException(Resources.stopReasonInvalid, Resources.reasonParameterName);
  }

  private static writeCause(tool: RegisteredTool, error: ToolFailureException): void {
    if (!Object.isUndefined(error.cause))
      ToolRegistry.writeDetail(tool, error.cause, t => Resources.formatToolFailureCause(tool.descriptor.name, error.failure.message, t));
  }

  private static withRequests(outcome: ToolResult | ToolFailure, requests: readonly PermissionRecord[]): ToolResult | ToolFailure {
    return outcome.isFailure
      ? new ToolFailure(outcome.code, outcome.message, outcome.moduleCode, outcome.content, outcome.nextTool, requests)
      : new ToolResult(outcome.content, outcome.structured, requests);
  }

  private static writeDetail(tool: RegisteredTool, value: unknown, format: (detail: string) => string): void {
    let line: string;
    try {
      line = format(inspect(value));
    }
    catch {
      line = Resources.formatToolFailureUnwritable(tool.descriptor.name);
    }
    tool.log.write(line);
  }

  private static listen<T extends unknown[]>(listeners: Set<(...values: T) => void>, listener: (...values: T) => void, log: IModuleLog): Registration {
    const handle = (...values: T): void => {
      try {
        listener(...values);
      }
      catch (error) {
        log.write(Resources.formatAgentControlListenerFailed(inspect(error)));
      }
    };
    listeners.add(handle);
    return new Registration(() => listeners.delete(handle));
  }

  private static resolve(resource: string, input: JsonObject, bindings: JsonObject): JsonValue | undefined {
    if (resource.startsWith(Resources.bindingResourcePrefix))
      return new Map(Object.entries(bindings)).get(resource.slice(Resources.bindingResourcePrefix.length));
    let value: JsonValue | undefined = input;
    for (const token of resource.slice(1).split(Resources.pointerSeparator))
      value = ToolRegistry.step(value, token.replaceAll(Resources.escapedSlash, Resources.pointerSeparator).replaceAll(Resources.escapedTilde, Resources.tilde));
    return value;
  }

  private static step(value: JsonValue | undefined, token: string): JsonValue | undefined {
    if (Array.isArray(value))
      return Resources.pointerIndexPattern.test(token) ? value[Number(token)] : undefined;
    return Object.isObject(value) ? new Map(Object.entries(value)).get(token) : undefined;
  }

  private static sortKeys(_key: string, value: unknown): unknown {
    if (!Object.isObject(value) || Array.isArray(value))
      return value;
    const entries = new Map(Object.entries(value));
    return Object.fromEntries([...entries.keys()].sort().map(t => [t, entries.get(t)]));
  }
}
