/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { NotContributedException } from "../../exceptions/not-contributed.exception.js";
import type { IModuleLog } from "../../interfaces/i-module-log.js";
import type { IPortBlocker } from "../../interfaces/i-port-blocker.js";
import type { IToolDescriptor } from "../../interfaces/i-tool-descriptor.js";
import type { IToolEndpoint } from "../../interfaces/i-tool-endpoint.js";
import type { IToolEndpointHandler } from "../../interfaces/i-tool-endpoint-handler.js";
import type { IToolHandler } from "../../interfaces/i-tool-handler.js";
import type { IToolsContext } from "../../interfaces/i-tools-context.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { Registration } from "../../models/registration.js";
import { ToolDescriptor } from "../../models/tool-descriptor.js";
import type { ToolSession } from "../../models/tool-session.js";
import { Resources } from "../../resources.js";
import { ToolEndpoint } from "./tool-endpoint.js";
import type { ToolRegistry } from "./tool-registry.js";

export class ModuleTools implements IToolsContext {
  private readonly declaration: ModuleDeclaration;
  private readonly registry: ToolRegistry;
  private readonly log: IModuleLog;
  private readonly registrations: Disposable[];
  private readonly stopping: AbortSignal;
  private readonly blocker: IPortBlocker;
  private readonly sessions: WeakSet<ToolSession> = new WeakSet();

  public constructor(declaration: ModuleDeclaration, registry: ToolRegistry, log: IModuleLog, registrations: Disposable[], stopping: AbortSignal, blocker: IPortBlocker) {
    this.declaration = declaration;
    this.registry = registry;
    this.log = log;
    this.registrations = registrations;
    this.stopping = stopping;
    this.blocker = blocker;
  }

  public get isStopped(): boolean {
    return this.registry.isStopped;
  }

  public register(descriptor: IToolDescriptor, handler: IToolHandler): Registration {
    const tools = this.declaration.listContributions(Resources.toolsKind);
    if (!tools.includes(descriptor.name))
      throw new NotContributedException(this.declaration.id, Resources.toolsKind, descriptor.name);

    const registration = this.registry.register(this.declaration.id, new ToolDescriptor(descriptor, tools), handler, tools, this.log);
    this.registrations.push(registration);
    return registration;
  }

  public openSession(scope: string, bindings: JsonObject): ToolSession {
    const session = this.registry.openSession(scope, bindings);
    this.sessions.add(session);
    this.registrations.push(new Registration(() => session.end()));
    return session;
  }

  public openEndpointAsync(handler: IToolEndpointHandler): Promise<IToolEndpoint> {
    return ToolEndpoint.openAsync(handler, t => this.sessions.has(t) && this.registry.isOpen(t), this.log, this.stopping, t => this.registrations.push(t), this.blocker);
  }

  public onSessionEnded(listener: (session: string) => void): Registration {
    const registration = this.registry.onSessionEnded(listener, this.log);
    this.registrations.push(registration);
    return registration;
  }

  public stopAll(reason: string): void {
    this.registry.stopAll(reason);
  }

  public stopSession(session: string, reason: string): void {
    this.registry.stopSession(this.declaration.id, session, reason);
  }

  public onSessionStopped(listener: (session: string, reason: string) => void): Registration {
    const registration = this.registry.onSessionStopped(listener, this.log);
    this.registrations.push(registration);
    return registration;
  }

  public resumeAll(): void {
    this.registry.resumeAll(this.declaration.id);
  }

  public onStopped(listener: (reason: string) => void): Registration {
    const registration = this.registry.onStopped(listener, this.log);
    this.registrations.push(registration);
    return registration;
  }

  public onResumed(listener: () => void): Registration {
    const registration = this.registry.onResumed(listener, this.log);
    this.registrations.push(registration);
    return registration;
  }
}
