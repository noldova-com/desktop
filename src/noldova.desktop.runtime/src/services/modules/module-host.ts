/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import type { Writable } from "node:stream";
import { inspect } from "node:util";

import "@noldova/context.core";
import { ModuleState, ModuleStatus, ModuleStatusList, QualifiedName, type SettingDefinition, SettingKey, ShellEvents } from "@noldova/desktop.protocol";

import type { IRuntimePart } from "../../interfaces/i-runtime-part.js";
import type { IRuntimePartLoader } from "../../interfaces/i-runtime-part-loader.js";
import type { ISecretBackend } from "../../interfaces/i-secret-backend.js";
import { ModuleActivationException } from "../../exceptions/module-activation.exception.js";
import { UnknownSchemaException } from "../../exceptions/unknown-schema.exception.js";
import type { EventChannel } from "../../models/event-channel.js";
import { ModuleActivation } from "../../models/module-activation.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { Resources } from "../../resources.js";
import { AppSurface } from "../app-surface/app-surface.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import type { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";
import { ClientClosures } from "../endpoint/client-closures.js";
import { FileGrantTable } from "../files/file-grant-table.js";
import type { NotificationCenter } from "../notifications/notification-center.js";
import { NotificationPolicy } from "../notifications/notification-policy.js";
import { PermissionCenter } from "../permissions/permission-center.js";
import type { ProcessSupervisor } from "../process/process-supervisor.js";
import type { CommandRegistry } from "../registry/command-registry.js";
import { ModuleDatabase } from "../database/module-database.js";
import type { EventRegistry } from "../registry/event-registry.js";
import type { MethodRegistry } from "../registry/method-registry.js";
import { ServiceRegistry } from "../registry/service-registry.js";
import { MachineSecretBackend } from "../secrets/machine-secret-backend.js";
import type { SettingsService } from "../settings/settings.service.js";
import { ToolRegistry } from "../tools/tool-registry.js";
import { ToolSchemaValidator } from "../tools/tool-schema.validator.js";
import { WebViewCenter } from "../web-views/web-view-center.js";
import type { WorkTracker } from "../work/work-tracker.js";
import { DependencyStates } from "./dependency-states.js";
import { ModuleContext } from "./module-context.js";

export class ModuleHost {
  private readonly declarations: readonly ModuleDeclaration[];
  private readonly dataDirectory: DataDirectory;
  private readonly methods: MethodRegistry;
  private readonly events: EventRegistry;
  private readonly commands: CommandRegistry;
  private readonly notifications: NotificationCenter;
  private readonly loader: IRuntimePartLoader;
  private readonly diagnostics: Writable;
  private readonly work: WorkTracker;
  private readonly redactor: DiagnosticRedactor;
  private readonly closures: ClientClosures;
  private readonly webViews: WebViewCenter;
  private readonly grants: FileGrantTable;
  private readonly secrets: ISecretBackend;
  private readonly appSurface: AppSurface;
  private readonly unavailable: ReadonlySet<string>;
  private readonly platformName: string;
  private readonly noldovaDesktop: string | null;
  private readonly statuses: Map<string, ModuleStatus> = new Map();
  private readonly activations: ModuleActivation[] = [];
  private readonly dependencyStates: DependencyStates = new DependencyStates(t => this.statuses.get(t));
  private readonly modulesChanged: EventChannel;
  private switchListener: Disposable | null = null;
  private switchingValue: Promise<void> = Promise.resolve();

  public readonly services: ServiceRegistry = new ServiceRegistry();
  public readonly notificationPolicy: NotificationPolicy;
  public readonly tools: ToolRegistry;

  public constructor(
    declarations: readonly ModuleDeclaration[],
    dataDirectory: DataDirectory,
    methods: MethodRegistry,
    events: EventRegistry,
    commands: CommandRegistry,
    notifications: NotificationCenter,
    loader: IRuntimePartLoader,
    diagnostics: Writable,
    work: WorkTracker,
    redactor: DiagnosticRedactor,
    closures: ClientClosures = new ClientClosures(diagnostics),
    webViews: WebViewCenter = new WebViewCenter(diagnostics),
    permissions: PermissionCenter = new PermissionCenter(),
    grants: FileGrantTable = new FileGrantTable(dataDirectory.stagedFolder, closures),
    secrets: ISecretBackend = new MachineSecretBackend(),
    appSurface: AppSurface = new AppSurface(closures, process.platform, diagnostics),
    platform: string = process.platform,
    noldovaDesktop: string | null = null) {
    this.declarations = declarations;
    this.noldovaDesktop = noldovaDesktop;
    this.dataDirectory = dataDirectory;
    this.methods = methods;
    this.events = events;
    this.commands = commands;
    this.notifications = notifications;
    this.notificationPolicy = new NotificationPolicy(declarations, t => this.statuses.get(t)?.state === ModuleState.Active);
    this.loader = loader;
    this.diagnostics = diagnostics;
    this.work = work;
    this.redactor = redactor;
    this.closures = closures;
    this.webViews = webViews;
    this.grants = grants;
    this.secrets = secrets;
    this.appSurface = appSurface;
    this.unavailable = new Set(declarations.filter(t => !t.runsOn(platform)).map(t => t.id));
    this.platformName = Resources.platformDisplayNames.get(Resources.modulePlatforms.get(platform) ?? platform) ?? Resources.otherPlatformName;
    this.tools = new ToolRegistry(randomUUID, new ToolSchemaValidator(), permissions);
    this.modulesChanged = events.declare(ShellEvents.modulesChanged);
  }

  public get report(): ModuleStatusList {
    return new ModuleStatusList([...this.statuses.values()]);
  }

  public get settingDefinitions(): readonly SettingDefinition[] {
    return this.declarations.filter(t => !this.unavailable.has(t.id)).flatMap(t => t.settings);
  }

  public get switching(): Promise<void> {
    return this.switchingValue;
  }

  public async activateAsync(settings: SettingsService, processes: ProcessSupervisor): Promise<void> {
    const switches = new Map(this.declarations.flatMap(t => Object.isNull(t.switchSetting) || this.unavailable.has(t.id) ? [] : [[t.switchSetting, t] as const]));
    const started = Promise.withResolvers<void>();
    this.switchingValue = started.promise;
    this.switchListener = settings.onChanged(change => {
      const declaration = switches.get(change.key.name.text);
      if (!Object.isUndefined(declaration))
        this.switchingValue = this.switchingValue.then(() => this.switchAsync(declaration, settings, processes));
    });
    try {
      for (const declaration of this.order())
        this.statuses.set(declaration.id, this.unavailable.has(declaration.id) ? ModuleHost.describe(declaration, ModuleState.Unavailable, Resources.formatModuleUnavailable(this.platformName))
          : ModuleHost.isOff(declaration, settings) ? ModuleHost.describe(declaration, ModuleState.Off, null) : await this.activateModuleAsync(declaration, settings, processes));
    }
    finally {
      started.resolve();
    }
  }

  public async deactivateAsync(): Promise<void> {
    this.switchListener?.[Symbol.dispose]();
    this.switchListener = null;
    await this.switchingValue;
    await this.stopAsync(this.activations.splice(0));
  }

  private async stopAsync(activations: readonly ModuleActivation[]): Promise<void> {
    const failures: unknown[] = [];
    const stops: Promise<void>[] = [];
    for (const activation of [...activations].reverse()) {
      this.tools.close(activation.declaration.id);
      try {
        await activation.part.deactivateAsync();
      }
      catch (error) {
        this.writeDiagnostic(activation.declaration, Resources.moduleDeactivationPartFailed, error);
        failures.push(error);
      }
      finally {
        stops.push(activation.processes.stopOwnedByAsync(activation.context.moduleId).finally(() => {
          activation.context[Symbol.dispose]();
          activation.database?.close();
        }));
      }
    }
    for (const stop of await Promise.allSettled(stops))
      if (stop.status === "rejected")
        failures.push(stop.reason);
    if (failures.length > 0)
      throw new AggregateError(failures, Resources.moduleDeactivationFailed);
  }

  private async switchAsync(declaration: ModuleDeclaration, settings: SettingsService, processes: ProcessSupervisor): Promise<void> {
    try {
      const isOff = ModuleHost.isOff(declaration, settings);
      if (isOff === (this.statuses.get(declaration.id)?.state === ModuleState.Off))
        return;
      if (isOff)
        await this.turnOffAsync(declaration);
      else
        await this.turnOnAsync(declaration, settings, processes);
    }
    catch (error) {
      this.writeDiagnostic(declaration, Resources.moduleSwitchFailed, error);
    }
    this.modulesChanged.publish(this.report.toJson());
  }

  private async turnOffAsync(declaration: ModuleDeclaration): Promise<void> {
    const reached = new Set([declaration.id]);
    for (const other of this.order())
      if (other.dependencies.some(t => reached.has(t)))
        reached.add(other.id);
    const stopping = this.activations.filter(t => reached.has(t.declaration.id));
    this.activations.splice(0, this.activations.length, ...this.activations.filter(t => !stopping.includes(t)));
    try {
      await this.stopAsync(stopping);
    }
    finally {
      this.statuses.set(declaration.id, ModuleHost.describe(declaration, ModuleState.Off, null));
      const changed = [declaration.id];
      for (const other of this.order().filter(t => t.id !== declaration.id && reached.has(t.id))) {
        const status = this.statuses.get(other.id);
        const blocked = this.findBlock(other);
        if (!Object.isNull(blocked) && (status?.state === ModuleState.Active || (status?.state === ModuleState.Blocked && reached.has(String(status.blockedBy))))) {
          this.statuses.set(other.id, blocked);
          changed.push(other.id);
        }
      }
      for (const id of changed)
        this.dependencyStates.announce(id);
    }
  }

  private async turnOnAsync(declaration: ModuleDeclaration, settings: SettingsService, processes: ProcessSupervisor): Promise<void> {
    const changed = new Set([declaration.id]);
    this.statuses.set(declaration.id, await this.activateModuleAsync(declaration, settings, processes));
    this.dependencyStates.announce(declaration.id);
    for (const other of this.order()) {
      const status = this.statuses.get(other.id);
      if (status?.state !== ModuleState.Blocked || !changed.has(String(status.blockedBy)))
        continue;
      this.statuses.set(other.id, await this.activateModuleAsync(other, settings, processes));
      this.dependencyStates.announce(other.id);
      changed.add(other.id);
    }
  }

  private order(): readonly ModuleDeclaration[] {
    const known = new Set(this.declarations.map(t => t.id));
    const ordered: ModuleDeclaration[] = [];
    let remaining = this.declarations;
    while (remaining.length > 0) {
      const ready = remaining.filter(t => [...t.dependencies, ...t.optionalDependencies].every(t => !known.has(t) || ordered.some(u => u.id === t)));
      const next = ready.length > 0 ? ready : remaining;
      ordered.push(...next);
      remaining = remaining.filter(t => !next.includes(t));
    }
    return ordered;
  }

  private findBlock(declaration: ModuleDeclaration): ModuleStatus | null {
    for (const dependency of declaration.dependencies) {
      const status = this.statuses.get(dependency);
      if (status?.state === ModuleState.Off)
        return ModuleHost.describe(declaration, ModuleState.Blocked, Resources.formatModuleBlockedOff(dependency), dependency);
      if (status?.state === ModuleState.Unavailable)
        return ModuleHost.describe(declaration, ModuleState.Blocked, Resources.formatModuleBlockedUnavailable(dependency, this.platformName), dependency);
      if (status?.state !== ModuleState.Active)
        return ModuleHost.describe(declaration, ModuleState.Blocked, Resources.formatModuleBlocked(dependency), dependency);
      if (!declaration.accepts(dependency, status.version))
        return ModuleHost.describe(
          declaration, ModuleState.Blocked, Resources.formatModuleOtherVersion(dependency, status.version, String(declaration.dependencyVersions.get(dependency))), dependency);
    }
    return null;
  }

  private async activateModuleAsync(declaration: ModuleDeclaration, settings: SettingsService, processes: ProcessSupervisor): Promise<ModuleStatus> {
    if (!declaration.acceptsNoldovaDesktop(this.noldovaDesktop)) {
      const cause = Resources.formatModuleOutsideNoldovaDesktop(String(declaration.noldovaDesktop), this.noldovaDesktop);
      this.diagnostics.write(Resources.formatModuleRefused(declaration.id, declaration.version, cause));
      return ModuleHost.describe(declaration, ModuleState.Failed, cause);
    }
    const blocked = this.findBlock(declaration);
    if (!Object.isNull(blocked))
      return blocked;
    for (const dependency of declaration.optionalDependencies) {
      const reason = this.explainUnavailable(declaration, dependency);
      if (!Object.isNull(reason))
        this.diagnostics.write(Resources.formatOptionalDependencyUnavailable(declaration.id, declaration.version, dependency, reason));
    }
    if (Object.isNull(declaration.runtimePackage))
      return ModuleHost.describe(declaration, ModuleState.Active, null);

    let part: IRuntimePart;
    try {
      part = await this.loader.loadAsync(declaration.runtimePackage);
    }
    catch (error) {
      this.writeDiagnostic(declaration, Resources.moduleLoadFailed, error);
      return ModuleHost.describe(declaration, ModuleState.Failed, Resources.moduleLoadFailed);
    }

    let database: ModuleDatabase | undefined;
    if (!Object.isUndefined(part.migrations))
      try {
        database = await ModuleDatabase.openAsync(this.dataDirectory, declaration.id, part.migrations, new Date(), this.diagnostics);
      }
      catch (error) {
        const cause = error instanceof UnknownSchemaException ? Resources.moduleDatabaseUnknown : Resources.moduleDatabaseFailed;
        this.writeDiagnostic(declaration, cause, error);
        return ModuleHost.describe(declaration, ModuleState.Failed, cause);
      }

    const context = new ModuleContext(
      declaration, this.dataDirectory, this.methods, this.events, this.commands, this.notifications, this.notificationPolicy, this.services, this.tools,
      settings, this.work, processes, this.diagnostics, this.redactor, database, this.closures, this.webViews, this.grants, this.dependencyStates, this.secrets,
      this.appSurface);
    try {
      await part.activateAsync(context);
    }
    catch (error) {
      await processes.stopOwnedByAsync(declaration.id);
      context[Symbol.dispose]();
      database?.close();
      const message: unknown = error instanceof ModuleActivationException ? error.message : null;
      const cause = Object.isString(message) && !String.isNullOrWhitespace(message) ? message : Resources.moduleActivationFailed;
      this.writeDiagnostic(declaration, cause, error);
      return ModuleHost.describe(declaration, ModuleState.Failed, cause);
    }
    this.activations.push(new ModuleActivation(declaration, context, part, processes, database));
    return ModuleHost.describe(declaration, ModuleState.Active, null);
  }

  private explainUnavailable(declaration: ModuleDeclaration, dependency: string): string | null {
    const status = this.statuses.get(dependency);
    if (Object.isUndefined(status))
      return Resources.optionalDependencyAbsent;
    if (status.state !== ModuleState.Active)
      return Resources.formatOptionalDependencyInactive(status.state);
    if (!declaration.accepts(dependency, status.version))
      return Resources.formatOptionalDependencyOtherVersion(dependency, status.version, String(declaration.optionalDependencyVersions.get(dependency)));
    return null;
  }

  private static isOff(declaration: ModuleDeclaration, settings: SettingsService): boolean {
    return !Object.isNull(declaration.switchSetting) && settings.read(new SettingKey(QualifiedName.parse(declaration.switchSetting))) === false;
  }

  private static describe(declaration: ModuleDeclaration, state: ModuleState, cause: string | null, blockedBy: string | null = null): ModuleStatus {
    return new ModuleStatus(
      declaration.id, declaration.version, declaration.displayName, declaration.description, declaration.dependencies, declaration.contributions, state, cause, blockedBy,
      declaration.optionalDependencies, state === ModuleState.Unavailable ? null : declaration.switchSetting);
  }

  private writeDiagnostic(declaration: ModuleDeclaration, cause: string, error: unknown): void {
    this.diagnostics.write(Resources.formatModuleDiagnostic(declaration.id, declaration.version, cause, inspect(error)));
  }
}
