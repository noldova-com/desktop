/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir } from "node:fs/promises";
import type { Writable } from "node:stream";
import { inspect } from "node:util";

import "@noldova/context.core";
import { type NotificationPost, QualifiedName } from "@noldova/desktop.protocol";

import { ModuleDatabaseException } from "../../exceptions/module-database.exception.js";
import { NotContributedException } from "../../exceptions/not-contributed.exception.js";
import { PseudoTerminalsUndeclaredException } from "../../exceptions/pseudo-terminals-undeclared.exception.js";
import { ServiceMissingException } from "../../exceptions/service-missing.exception.js";
import { ServiceNotAllowedException } from "../../exceptions/service-not-allowed.exception.js";
import { ServiceNotOwnedException } from "../../exceptions/service-not-owned.exception.js";
import { ServiceTypeMismatchException } from "../../exceptions/service-type-mismatch.exception.js";
import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import type { IModuleDatabase } from "../../interfaces/i-module-database.js";
import type { IModuleLog } from "../../interfaces/i-module-log.js";
import type { IModuleSecrets } from "../../interfaces/i-module-secrets.js";
import type { IModuleSettings } from "../../interfaces/i-module-settings.js";
import type { IPermissionsContext } from "../../interfaces/i-permissions-context.js";
import type { IRuntimePartContext } from "../../interfaces/i-runtime-part-context.js";
import type { IAppShortcuts } from "../../interfaces/i-app-shortcuts.js";
import type { IAppWindows } from "../../interfaces/i-app-windows.js";
import type { IRuntimeFiles } from "../../interfaces/i-runtime-files.js";
import type { IRuntimeWebViews } from "../../interfaces/i-runtime-web-views.js";
import type { ISecretBackend } from "../../interfaces/i-secret-backend.js";
import type { IToolsContext } from "../../interfaces/i-tools-context.js";
import type { ClientClosure } from "../../models/client-closure.js";
import type { EventChannel } from "../../models/event-channel.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { NotificationHandle } from "../../models/notification-handle.js";
import { Registration } from "../../models/registration.js";
import { RequestContext } from "../../models/request-context.js";
import type { OwnedProcess } from "../../models/owned-process.js";
import type { ProcessRequest } from "../../models/process-request.js";
import type { PseudoTerminal } from "../../models/pseudo-terminal.js";
import type { PseudoTerminalRequest } from "../../models/pseudo-terminal-request.js";
import type { RuntimeCommand } from "../../models/runtime-command.js";
import type { WorkItem } from "../../models/work-item.js";
import { Resources } from "../../resources.js";
import { AppSurface } from "../app-surface/app-surface.js";
import { ModuleAppShortcuts } from "../app-surface/module-app-shortcuts.js";
import { ModuleAppWindows } from "../app-surface/module-app-windows.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import type { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";
import { ClientClosures } from "../endpoint/client-closures.js";
import { FileGrantTable } from "../files/file-grant-table.js";
import { ModuleFiles } from "../files/module-files.js";
import type { NotificationCenter } from "../notifications/notification-center.js";
import type { NotificationPolicy } from "../notifications/notification-policy.js";
import { ModulePermissions } from "../permissions/module-permissions.js";
import type { ProcessSupervisor } from "../process/process-supervisor.js";
import type { CommandRegistry } from "../registry/command-registry.js";
import type { EventRegistry } from "../registry/event-registry.js";
import type { MethodRegistry } from "../registry/method-registry.js";
import type { ServiceRegistry } from "../registry/service-registry.js";
import { MachineSecretBackend } from "../secrets/machine-secret-backend.js";
import { ModuleSecrets } from "../secrets/module-secrets.js";
import { ModuleSettings } from "../settings/module-settings.js";
import type { SettingsService } from "../settings/settings.service.js";
import { ModuleTools } from "../tools/module-tools.js";
import type { ToolRegistry } from "../tools/tool-registry.js";
import { ModuleWebViews } from "../web-views/module-web-views.js";
import { WebViewCenter } from "../web-views/web-view-center.js";
import type { WorkTracker } from "../work/work-tracker.js";
import { DependencyStates } from "./dependency-states.js";
import { ModuleLog } from "./module-log.js";

export class ModuleContext implements IRuntimePartContext, Disposable {
  private readonly declaration: ModuleDeclaration;
  private readonly methods: MethodRegistry;
  private readonly events: EventRegistry;
  private readonly commands: CommandRegistry;
  private readonly notifications: NotificationCenter;
  private readonly notificationPolicy: NotificationPolicy;
  private readonly services: ServiceRegistry;
  private readonly work: WorkTracker;
  private readonly processes: ProcessSupervisor;
  private readonly workFolder: string;
  private readonly registrations: Disposable[] = [];
  private readonly stopping: AbortController = new AbortController();
  private readonly moduleDatabase: IModuleDatabase | undefined;
  private readonly closures: ClientClosures;
  private readonly dependencyStates: DependencyStates;
  private readonly refusedServices: Set<string> = new Set();
  private isDisposed: boolean = false;

  public readonly moduleFolder: string;
  public readonly settings: IModuleSettings;
  public readonly log: IModuleLog;
  public readonly tools: IToolsContext;
  public readonly permissions: IPermissionsContext;
  public readonly webViews: IRuntimeWebViews;
  public readonly files: IRuntimeFiles;
  public readonly secrets: IModuleSecrets;
  public readonly appWindows: IAppWindows;
  public readonly shortcuts: IAppShortcuts;

  public constructor(
    declaration: ModuleDeclaration,
    dataDirectory: DataDirectory,
    methods: MethodRegistry,
    events: EventRegistry,
    commands: CommandRegistry,
    notifications: NotificationCenter,
    notificationPolicy: NotificationPolicy,
    services: ServiceRegistry,
    tools: ToolRegistry,
    settings: SettingsService,
    work: WorkTracker,
    processes: ProcessSupervisor,
    diagnostics: Writable,
    redactor: DiagnosticRedactor,
    database?: IModuleDatabase,
    closures: ClientClosures = new ClientClosures(diagnostics),
    webViews: WebViewCenter = new WebViewCenter(diagnostics),
    grants: FileGrantTable = new FileGrantTable(dataDirectory.stagedFolder, closures),
    dependencyStates: DependencyStates = new DependencyStates(() => undefined),
    secrets: ISecretBackend = new MachineSecretBackend(),
    appSurface: AppSurface = new AppSurface(closures, process.platform, diagnostics)) {
    this.declaration = declaration;
    this.dependencyStates = dependencyStates;
    this.moduleDatabase = database;
    this.methods = methods;
    this.events = events;
    this.commands = commands;
    this.notifications = notifications;
    this.notificationPolicy = notificationPolicy;
    this.services = services;
    this.work = work;
    this.processes = processes;
    this.closures = closures;
    this.moduleFolder = dataDirectory.locateModuleFolder(declaration.id);
    this.workFolder = dataDirectory.locateWorkFolder(declaration.id);
    this.settings = new ModuleSettings(declaration, settings, this.registrations);
    this.log = new ModuleLog(declaration.id, diagnostics, redactor);
    this.tools = new ModuleTools(declaration, tools, this.log, this.registrations, this.stopping.signal, webViews);
    this.permissions = new ModulePermissions(declaration.id, tools.permissions, this.log, this.registrations, this.stopping.signal);
    this.webViews = new ModuleWebViews(declaration.id, webViews);
    this.files = new ModuleFiles(declaration.id, grants, [this.moduleFolder, this.workFolder]);
    this.secrets = new ModuleSecrets(declaration.id, secrets);
    this.appWindows = new ModuleAppWindows(appSurface, this.registrations);
    this.shortcuts = new ModuleAppShortcuts(appSurface, this.registrations);
    if (!Object.isNull(declaration.webViews))
      this.registrations.push(webViews.attach(declaration.id));
  }

  public get moduleId(): string {
    return this.declaration.id;
  }

  public get database(): IModuleDatabase {
    if (Object.isUndefined(this.moduleDatabase))
      throw new ModuleDatabaseException(this.declaration.id);
    return this.moduleDatabase;
  }

  public async getWorkFolderAsync(): Promise<string> {
    await mkdir(this.workFolder, { recursive: true });
    return this.workFolder;
  }

  public beginWork(description: string): WorkItem {
    return this.work.begin(description, this.declaration.id);
  }

  public readEnvironmentAsync(): Promise<Readonly<Record<string, string>>> {
    return this.processes.readEnvironmentAsync();
  }

  public startProcessAsync(request: ProcessRequest): Promise<OwnedProcess> {
    return this.processes.startAsync(this.declaration.id, request);
  }

  public startPseudoTerminalAsync(request: PseudoTerminalRequest): Promise<PseudoTerminal> {
    if (!this.declaration.usesPseudoTerminals)
      return Promise.reject(new PseudoTerminalsUndeclaredException(this.declaration.id, request.program));
    return this.processes.startPseudoTerminalAsync(this.declaration.id, request);
  }

  public registerMethod(name: string, handler: IMethodHandler): void {
    this.registrations.push(this.methods.register(this.requireContributed(Resources.methodsKind, name), {
      handleAsync: t => handler.handleAsync(new RequestContext(t.client, t.payload, AbortSignal.any([t.signal, this.stopping.signal]), t.connection, t.window, t.page))
    }));
  }

  public declareEvent(name: string): EventChannel {
    const channel = this.events.declare(this.requireContributed(Resources.eventsKind, name));
    this.registrations.push(channel);
    return channel;
  }

  public registerCommand(command: RuntimeCommand): void {
    this.requireContributed(Resources.commandsKind, command.info.name.text);
    this.registrations.push(this.commands.register(command));
  }

  public onClientClosed(listener: (closure: ClientClosure) => void | Promise<void>): void {
    this.registrations.push(this.closures.listen(listener));
  }

  public postNotification(post: NotificationPost): NotificationHandle {
    this.notificationPolicy.requireDeclared(this.declaration, post);
    const id = this.notifications.post(post);
    return new NotificationHandle(id, t => this.updateNotification(id, t), () => this.notifications.dismiss(id));
  }

  public publishService(name: string, service: object): void {
    const qualified = QualifiedName.parse(name);
    if (qualified.owner !== this.declaration.id)
      throw new ServiceNotOwnedException(this.declaration.id, name);

    this.registrations.push(this.services.publish(qualified, service));
  }

  public getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T {
    const qualified = QualifiedName.parse(name);
    if (!qualified.isShell && !this.declaration.dependencies.includes(qualified.owner))
      throw new ServiceNotAllowedException(this.declaration.id, name);

    const service = this.services.find(qualified);
    if (Object.isUndefined(service))
      throw new ServiceMissingException(name);
    if (!(service instanceof type))
      throw new ServiceTypeMismatchException(name, type.name);
    return service;
  }

  public findService<T extends object>(name: string, guard: (service: object) => service is T): T | null {
    const qualified = QualifiedName.parse(name);
    const isOptional = this.declaration.optionalDependencies.includes(qualified.owner);
    if (!qualified.isShell && !isOptional && !this.declaration.dependencies.includes(qualified.owner))
      throw new ServiceNotAllowedException(this.declaration.id, name);

    const service = isOptional && !this.dependencyStates.isAvailable(this.declaration, qualified.owner) ? undefined : this.services.find(qualified);
    if (Object.isUndefined(service))
      return null;
    if (guard(service))
      return service;
    if (!this.refusedServices.has(name)) {
      this.refusedServices.add(name);
      this.log.write(Resources.formatServiceRefused(name));
    }
    return null;
  }

  public onDependencyChanged(listener: (moduleId: string, isActive: boolean) => void): () => void {
    if (this.isDisposed)
      return () => undefined;
    const registration = new Registration(this.dependencyStates.listen(this.declaration, (moduleId, isActive) => {
      try {
        listener(moduleId, isActive);
      }
      catch (error) {
        this.log.write(Resources.formatDependencyListenerFailed(moduleId, inspect(error)));
      }
    }));
    this.registrations.push(registration);
    return () => registration[Symbol.dispose]();
  }

  public [Symbol.dispose](): void {
    this.isDisposed = true;
    this.stopping.abort();
    for (const registration of this.registrations.splice(0).reverse())
      registration[Symbol.dispose]();
    this.notifications.dismissOwnedBy(this.declaration.id);
    this.work.endOwnedBy(this.declaration.id);
  }

  private updateNotification(id: string, post: NotificationPost): boolean {
    this.notificationPolicy.requireDeclared(this.declaration, post);
    return this.notifications.update(id, post);
  }

  private requireContributed(kind: string, name: string): QualifiedName {
    if (!this.declaration.listContributions(kind).includes(name))
      throw new NotContributedException(this.declaration.id, kind, name);
    return QualifiedName.parse(name);
  }
}
