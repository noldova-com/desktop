/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { inspect } from "node:util";

import "@noldova/context.core";
import { type BuildIdentity, Failure, FailureCode, NotificationBroadcast, PreShellData, RuntimeHandover, ShellClients, ShellEvents, ShellMethods } from "@noldova/desktop.protocol";

import { DataDirectoryState } from "../../enums/data-directory-state.js";
import { UpdateBarrierStatus } from "../../enums/update-barrier-status.js";
import { WindowStateKind } from "../../enums/window-state-kind.js";
import { DataDirectoryOwnedException } from "../../exceptions/data-directory-owned.exception.js";
import { UpdateInProgressException } from "../../exceptions/update-in-progress.exception.js";
import type { IIdleParticipant } from "../../interfaces/i-idle-participant.js";
import { AppImageSource } from "../../models/app-image-source.js";
import { CapabilityToken } from "../../models/capability-token.js";
import type { Endpoint } from "../../models/endpoint.js";
import type { EventChannel } from "../../models/event-channel.js";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { ProductInfo } from "../../models/product-info.js";
import { Refusal } from "../../models/refusal.js";
import { RuntimeBuild } from "../../models/runtime-build.js";
import { RuntimeDiscovery } from "../../models/runtime-discovery.js";
import type { RunningProgram } from "../../models/running-program.js";
import type { RuntimeOptions } from "../../models/runtime-options.js";
import type { ServerSettings } from "../../models/server-settings.js";
import { Resources } from "../../resources.js";
import { AppShortcutsChangedMethod } from "../app-surface/app-shortcuts-changed-method.js";
import { AppSurface } from "../app-surface/app-surface.js";
import { AppWindowsChangedMethod } from "../app-surface/app-windows-changed-method.js";
import { MainWindowChangedMethod } from "../app-surface/main-window-changed-method.js";
import { MainWindowMethod } from "../app-surface/main-window-method.js";
import { SystemCommand } from "../commands/system-command.js";
import { DataDirectoryInspector } from "../data-directory/data-directory-inspector.js";
import { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";
import { StandardErrorCap } from "../diagnostics/standard-error-cap.js";
import { ShellDatabase } from "../database/shell-database.js";
import { ShellMigrations } from "../database/shell-migrations.js";
import { DiscoveryPublisher } from "../discovery/discovery-publisher.js";
import { FolderProtectorFactory } from "../discovery/folder-protector-factory.js";
import { DiscardFileGrantsMethod } from "../files/discard-file-grants-method.js";
import { EndFileGrantsMethod } from "../files/end-file-grants-method.js";
import { FileGrantTable } from "../files/file-grant-table.js";
import { FilePresence } from "../files/file-presence.js";
import { GrantFileMethod } from "../files/grant-file-method.js";
import { ResolveFileShareMethod } from "../files/resolve-file-share-method.js";
import { Installation } from "../installation/installation.js";
import type { ProcessPresence } from "../installation/process-presence.js";
import { MainProcessCheck } from "../endpoint/main-process-check.js";
import { RuntimeServer } from "../endpoint/runtime-server.js";
import { WindowClosedMethod } from "../endpoint/window-closed-method.js";
import { ModuleDeclarationReader } from "../modules/module-declaration.reader.js";
import { CommandsMethod } from "../modules/commands-method.js";
import { ModuleHost } from "../modules/module-host.js";
import { ModulesMethod } from "../modules/modules-method.js";
import { RunCommandMethod } from "../modules/run-command-method.js";
import { ClearNotificationsMethod } from "../notifications/clear-notifications-method.js";
import { DismissNotificationMethod } from "../notifications/dismiss-notification-method.js";
import { MarkNotificationsReadMethod } from "../notifications/mark-notifications-read-method.js";
import { NotificationCenter } from "../notifications/notification-center.js";
import { PermissionCenter } from "../permissions/permission-center.js";
import { RememberedPermissionStore } from "../permissions/remembered-permission-store.js";
import { NotificationSettings } from "../notifications/notification-settings.js";
import { NotificationsMethod } from "../notifications/notifications-method.js";
import { PostNotificationMethod } from "../notifications/post-notification-method.js";
import { PackageRuntimePartLoader } from "../modules/package-runtime-part-loader.js";
import { OwnershipLock } from "../ownership/ownership-lock.js";
import { ProcessSupervisor } from "../process/process-supervisor.js";
import { ProgramsMethod } from "../process/programs-method.js";
import { RecentCommandsMethod } from "../recent-commands/recent-commands-method.js";
import { RecentCommandsStore } from "../recent-commands/recent-commands-store.js";
import { RecordCommandMethod } from "../recent-commands/record-command-method.js";
import { CommandRegistry } from "../registry/command-registry.js";
import { EventRegistry } from "../registry/event-registry.js";
import { MethodRegistry } from "../registry/method-registry.js";
import { MachineSecretBackend } from "../secrets/machine-secret-backend.js";
import { RemoveSecretMethod } from "../secrets/remove-secret-method.js";
import { SaveSecretMethod } from "../secrets/save-secret-method.js";
import { SecretAnsweredMethod } from "../secrets/secret-answered-method.js";
import { SecretStatusMethod } from "../secrets/secret-status-method.js";
import { SecretTable } from "../secrets/secret-table.js";
import { SettingReadMethod } from "../settings/setting-read-method.js";
import { SettingResetMethod } from "../settings/setting-reset-method.js";
import { SettingWriteMethod } from "../settings/setting-write-method.js";
import { SettingsReadMethod } from "../settings/settings-read-method.js";
import { SettingsService } from "../settings/settings.service.js";
import { ShellSettings } from "../settings/shell-settings.js";
import { AgentControl } from "../tools/agent-control.js";
import { ReadWebViewBlockedPortsMethod } from "../web-views/read-web-view-blocked-ports-method.js";
import { WebViewAnsweredMethod } from "../web-views/web-view-answered-method.js";
import { WebViewCenter } from "../web-views/web-view-center.js";
import { WebViewEventsMethod } from "../web-views/web-view-events-method.js";
import { WebViewPortsBlockedMethod } from "../web-views/web-view-ports-blocked-method.js";
import { WindowStateReadMethod } from "../window-state/window-state-read-method.js";
import { WindowStateStore } from "../window-state/window-state-store.js";
import { WindowStateWriteMethod } from "../window-state/window-state-write-method.js";
import { WorkMethod } from "../work/work-method.js";
import { WorkTracker } from "../work/work-tracker.js";
import { AppImageCopyCleanup } from "./app-image-copy-cleanup.js";
import { IdleMonitor } from "./idle-monitor.js";
import { MoveAsideMethod } from "./move-aside-method.js";
import { QuitAnsweredMethod } from "./quit-answered-method.js";
import { QuitMethod } from "./quit-method.js";
import { QuitRelay } from "./quit-relay.js";
import { RuntimeLog } from "./runtime-log.js";
import { StopMethod } from "./stop-method.js";
import { UpdateMethod } from "./update-method.js";
import { UpdatePreparation } from "./update-preparation.js";
import { UpdateSavedMethod } from "./update-saved-method.js";

export class RuntimeHost implements IIdleParticipant {
  private readonly lock: OwnershipLock;
  private readonly token: CapabilityToken = CapabilityToken.generate();
  private readonly server: RuntimeServer;
  private readonly publisher: DiscoveryPublisher;
  private readonly idle: IdleMonitor;
  private readonly stopped: PromiseWithResolvers<string> = Promise.withResolvers<string>();
  private readonly platform: string;
  private readonly presence: ProcessPresence;
  private readonly environment: NodeJS.ProcessEnv;
  private database: ShellDatabase | null;
  private settings: SettingsService | null = null;
  private processes: ProcessSupervisor | null = null;
  private discovery: RuntimeDiscovery | null = null;
  private movingAside: Promise<void> | null = null;
  private isStopping: boolean = false;
  private notificationSettings: NotificationSettings = new NotificationSettings(null);
  private readonly workEvent: EventChannel;
  private readonly programsEvent: EventChannel;
  private readonly serverSettings: ServerSettings;
  private readonly installationFolder: string | null;
  private readonly copyRecord: string | null;
  private readonly errorsCap: StandardErrorCap | null;
  private readonly updating: EventChannel;
  private readonly updateEnded: EventChannel;
  private preparation: UpdatePreparation | null = null;
  private readonly quit: QuitRelay;
  private readonly webViews: WebViewCenter;
  private readonly grants: FileGrantTable;
  private readonly secrets: MachineSecretBackend;

  public readonly identity: BuildIdentity;
  public readonly work: WorkTracker;
  public readonly methods: MethodRegistry = new MethodRegistry();
  public readonly commands: CommandRegistry;
  public readonly events: EventRegistry;
  public readonly notifications: NotificationCenter;
  public readonly modules: ModuleHost;
  public readonly log: RuntimeLog;

  private constructor(
    options: RuntimeOptions,
    platform: string,
    environment: NodeJS.ProcessEnv,
    presence: ProcessPresence,
    lock: OwnershipLock,
    log: RuntimeLog,
    database: ShellDatabase | null,
    declarations: readonly ModuleDeclaration[],
    noldovaDesktop: string | null) {
    this.lock = lock;
    this.platform = platform;
    this.presence = presence;
    this.environment = environment;
    this.log = log;
    this.database = database;
    this.identity = RuntimeBuild.identity;
    this.work = new WorkTracker(() => this.workChanged());
    this.server = new RuntimeServer(
      this.identity,
      this.token,
      new RuntimeHandover(this.identity, AppImageSource.locateProgram(environment, process.execPath)),
      this.methods,
      options.serverSettings,
      () => this.clientsChanged(),
      log.diagnostics,
      MainProcessCheck.create(platform, process.execPath, environment));
    this.events = new EventRegistry(this.server);
    this.publisher = new DiscoveryPublisher(lock, FolderProtectorFactory.create(platform, new SystemCommand(), environment));
    this.idle = new IdleMonitor(options.idleGraceMilliseconds, this);
    this.workEvent = this.events.declare(ShellEvents.work);
    const commandsChanged = this.events.declare(ShellEvents.commandsChanged);
    this.programsEvent = this.events.declare(ShellEvents.programsChanged);
    this.commands = new CommandRegistry(t => commandsChanged.publish(t.toJson()));
    this.webViews = new WebViewCenter(log.diagnostics, this.events.declare(ShellEvents.webViewCommand), this.events.declare(ShellEvents.webViewBlockedPorts));
    this.grants = new FileGrantTable(lock.dataDirectory.stagedFolder, this.server.closures);
    this.secrets = new MachineSecretBackend(this.events.declare(ShellEvents.secretCommand));
    const appSurface = new AppSurface(this.server.closures, process.platform, log.diagnostics);
    const notificationsChanged = this.events.declare(ShellEvents.notifications);
    this.notifications = new NotificationCenter(
      t => notificationsChanged.publish(new NotificationBroadcast(t.notifications, this.notificationSettings.quietDevices, this.notificationSettings.mutedModules, this.notifications.sequence).toJson()), () => new Date(), randomUUID);
    this.modules = new ModuleHost(
      declarations, lock.dataDirectory, this.methods, this.events, this.commands, this.notifications, new PackageRuntimePartLoader(), log.diagnostics,
      this.work, new DiagnosticRedactor(homedir(), [ProductInfo.current.name]), this.server.closures, this.webViews, new PermissionCenter(ProductInfo.current.permissionsModule),
      this.grants, this.secrets, appSurface, platform, noldovaDesktop);
    this.quit = new QuitRelay(this.server, this.events.declare(ShellEvents.quitting));
    this.methods.register(ShellMethods.stop, new StopMethod(this.work, t => this.server.countOtherClients(t) - this.quit.countWaiting(t), t => this.quit.recordStop(t.connection), t => this.requestStop(t)));
    this.methods.register(ShellMethods.quit, new QuitMethod(this.quit));
    this.methods.register(ShellMethods.quitAnswered, new QuitAnsweredMethod(this.quit));
    this.methods.register(ShellMethods.modules, new ModulesMethod(this.modules));
    this.methods.register(ShellMethods.work, new WorkMethod(this.work));
    this.methods.register(ShellMethods.windowClosed, new WindowClosedMethod(this.server));
    this.methods.register(ShellMethods.appWindowsChanged, new AppWindowsChangedMethod(appSurface));
    this.methods.register(ShellMethods.appShortcutsChanged, new AppShortcutsChangedMethod(appSurface));
    this.methods.register(ShellMethods.mainWindowChanged, new MainWindowChangedMethod(appSurface));
    this.methods.register(ShellMethods.mainWindow, new MainWindowMethod(appSurface));
    this.methods.register(ShellMethods.webViewAnswered, new WebViewAnsweredMethod(this.webViews));
    this.methods.register(ShellMethods.webViewEvents, new WebViewEventsMethod(this.webViews));
    this.methods.register(ShellMethods.readWebViewBlockedPorts, new ReadWebViewBlockedPortsMethod(this.webViews));
    this.methods.register(ShellMethods.webViewPortsBlocked, new WebViewPortsBlockedMethod(this.webViews));
    this.methods.register(ShellMethods.grantFile, new GrantFileMethod(this.grants));
    this.methods.register(ShellMethods.discardFileGrants, new DiscardFileGrantsMethod(this.grants));
    this.methods.register(ShellMethods.endFileGrants, new EndFileGrantsMethod(this.grants));
    this.methods.register(ShellMethods.resolveFileShare, new ResolveFileShareMethod(this.grants));
    this.methods.register(ShellMethods.secretAnswered, new SecretAnsweredMethod(this.secrets));
    this.serverSettings = options.serverSettings;
    this.installationFolder = options.installationFolder;
    this.copyRecord = RuntimeHost.locateCopyRecord(options, lock);
    this.errorsCap = Object.isNull(options.startLogName)
      ? null
      : StandardErrorCap.start(process.stderr.fd, [path.join(lock.dataDirectory.logsFolder, options.startLogName), lock.dataDirectory.runtimeErrorsLog],
        lock.dataDirectory.previousRuntimeErrorsLog, new DiagnosticRedactor(homedir(), [ProductInfo.current.name]), log.diagnostics);
    this.updating = this.events.declare(ShellEvents.updating);
    this.updateEnded = this.events.declare(ShellEvents.updateEnded);
    this.methods.register(ShellMethods.commands, new CommandsMethod(this.commands));
    this.methods.register(ShellMethods.runCommand, new RunCommandMethod(this.commands));
    this.methods.register(ShellMethods.agentControl, new AgentControl(this.modules.tools, this.commands, this.events));
    if (!Object.isNull(database))
      this.registerShellFacilities(database);
    else {
      this.server.refuse(new Refusal(
        new Failure(FailureCode.PreShellData, Resources.formatPreShellDataFailure(ProductInfo.current.name), new PreShellData(lock.dataDirectory.root).toJson()),
        ShellMethods.moveAside));
      this.methods.register(ShellMethods.moveAside, new MoveAsideMethod(() => this.moveAsideAsync()));
    }
  }

  public get programs(): readonly RunningProgram[] {
    return this.processes?.programs ?? [];
  }

  public get isIdle(): boolean {
    return this.server.sessionCount === 0 && this.work.isEmpty;
  }

  public static async startAsync(options: RuntimeOptions, platform: string, environment: NodeJS.ProcessEnv, presence: ProcessPresence): Promise<RuntimeHost> {
    const declarations = await ModuleDeclarationReader.readAsync(options.declarationsFile);
    const noldovaDesktop = await ModuleDeclarationReader.readNoldovaDesktopAsync(options.declarationsFile);
    const lock = await RuntimeHost.acquireAsync(options);
    let log: RuntimeLog | null = null;
    let database: ShellDatabase | null = null;
    try {
      log = await RuntimeLog.openAsync(lock, options.startLogName);
      await RuntimeHost.joinInstallationAsync(options, lock, presence);
      await AppImageCopyCleanup.removeAsync(lock.dataDirectory, log.diagnostics, presence);
      const inspection = await DataDirectoryInspector.inspectAsync(options.dataDirectory);
      if (inspection.state !== DataDirectoryState.PreShell)
        database = await ShellDatabase.openAsync(lock, ShellMigrations.all, new Date(), log.diagnostics);
    }
    catch (error) {
      await RuntimeHost.closeAsync(log, RuntimeHost.locateCopyRecord(options, lock));
      lock.release();
      throw error;
    }

    const host = new RuntimeHost(options, platform, environment, presence, lock, log, database, declarations, noldovaDesktop);
    try {
      await host.openAsync(platform);
    }
    catch (error) {
      await host.stopAsync();
      throw error;
    }
    return host;
  }

  public handleIdle(): void {
    this.requestStop(Resources.stoppedByIdle);
  }

  public requestStop(reason: string): void {
    if (!this.isStopping)
      this.stopAsync().then(() => this.stopped.resolve(reason), (error: unknown) => this.stopped.reject(error));
  }

  public waitForStopAsync(): Promise<string> {
    return this.stopped.promise;
  }

  private clientsChanged(): void {
    this.idle.check();
    this.quit.check();
    const mainProcess = this.server.clients.find(t => t.client === ShellClients.mainProcess)?.connection ?? null;
    this.webViews.check(mainProcess);
    this.secrets.check(mainProcess);
  }

  private workChanged(): void {
    this.workEvent.publish(this.work.report.toJson());
    this.idle.check();
  }

  private static locateCopyRecord(options: RuntimeOptions, lock: OwnershipLock): string | null {
    return Object.isNull(options.startLogName)
      ? null
      : path.join(lock.dataDirectory.logsFolder, `${Resources.copyRecordPrefix}${options.startLogName.slice(Resources.startLogPrefix.length)}`);
  }

  private static async closeAsync(log: RuntimeLog | null, copyRecord: string | null): Promise<void> {
    if (!Object.isNull(log) && !Object.isNull(copyRecord))
      await AppImageCopyCleanup.removeOwnAsync(copyRecord, log.diagnostics);
    await log?.closeAsync();
  }

  private static async joinInstallationAsync(options: RuntimeOptions, lock: OwnershipLock, presence: ProcessPresence): Promise<void> {
    if (Object.isNull(options.installationFolder))
      return;
    const installation = new Installation(options.installationFolder, t => presence.isRunningAsync(t));
    await installation.recordAsync(lock.dataDirectory.root);
    const status = await installation.checkAsync(RuntimeBuild.identity.productVersion);
    if (status !== UpdateBarrierStatus.None)
      throw new UpdateInProgressException(status);
  }

  private static async acquireAsync(options: RuntimeOptions): Promise<OwnershipLock> {
    const deadline = Date.now() + options.takeoverMilliseconds;
    for (;;) {
      try {
        return OwnershipLock.acquire(options.dataDirectory);
      }
      catch (error) {
        if (!(error instanceof DataDirectoryOwnedException) || await FilePresence.existsAsync(options.dataDirectory.discoveryFile) || Date.now() >= deadline)
          throw error;
      }
      await delay(Resources.takeoverInterval);
    }
  }

  private async openAsync(platform: string): Promise<void> {
    await this.publisher.withdrawEarlierAsync();
    await this.grants.clearStagedAsync();
    if (!Object.isNull(this.database) && !Object.isNull(this.settings))
      await this.activateModulesAsync(this.database, this.settings);
    const endpoint = await this.listenAsync(platform);
    if (!Object.isNull(endpoint.port))
      this.webViews.blockPort(endpoint.port);
    const discovery = new RuntimeDiscovery(
      endpoint.toString(),
      this.token.value,
      process.pid,
      AppImageSource.locateProgram(this.environment, process.execPath),
      this.identity.productVersion,
      this.identity.protocolVersion,
      this.identity.fingerprint);
    await this.publisher.publishAsync(discovery);
    this.discovery = discovery;
    this.idle.check();
  }

  private moveAsideAsync(): Promise<void> {
    this.movingAside ??= this.performMoveAsideAsync().catch((error: unknown) => {
      if (Object.isNull(this.database))
        this.movingAside = null;
      throw error;
    });
    return this.movingAside;
  }

  private async performMoveAsideAsync(): Promise<void> {
    await DataDirectoryInspector.moveAsideAsync(this.lock);
    this.database = await ShellDatabase.openAsync(this.lock, ShellMigrations.all, new Date(), this.log.diagnostics);
    await this.activateModulesAsync(this.database, this.registerShellFacilities(this.database));
    setImmediate(() => this.server.admit());
  }

  private async activateModulesAsync(database: ShellDatabase, settings: SettingsService): Promise<void> {
    const processes = ProcessSupervisor.create(database, this.platform, this.environment, this.log.diagnostics);
    this.processes = processes;
    processes.onChanged(() => this.programsEvent.publish(processes.status.toJson()));
    this.methods.register(ShellMethods.programs, new ProgramsMethod(() => processes.status));
    const preparation = new UpdatePreparation(
      this.server, this.presence, processes, this.updating, this.updateEnded,
      this.serverSettings.updateSaveWait, this.serverSettings.updateBarrierHolderCheckInterval, this.installationFolder);
    this.preparation = preparation;
    this.methods.register(ShellMethods.update, new UpdateMethod(preparation));
    this.methods.register(ShellMethods.updateSaved, new UpdateSavedMethod(preparation));
    await processes.cleanUpAsync();
    await this.modules.activateAsync(settings, processes);
  }

  private registerShellFacilities(database: ShellDatabase): SettingsService {
    const store = new WindowStateStore(database);
    const settings = new SettingsService(database, [...ShellSettings.definitionsFor(this.platform), ...this.modules.settingDefinitions], this.log.diagnostics);
    const changed = this.events.declare(ShellEvents.settingsChanged);
    this.notificationSettings = new NotificationSettings(settings);
    settings.onChanged(t => {
      changed.publish(t.toJson());
      if (this.notificationSettings.isNotificationSetting(t.key.name.text))
        this.notifications.republish();
    });
    this.methods.register(ShellMethods.settings, new SettingsReadMethod(settings));
    this.methods.register(ShellMethods.readSetting, new SettingReadMethod(settings));
    this.methods.register(ShellMethods.setSetting, new SettingWriteMethod(settings));
    this.methods.register(ShellMethods.resetSetting, new SettingResetMethod(settings));
    this.settings = settings;
    this.methods.register(ShellMethods.readWindowBounds, new WindowStateReadMethod(store, WindowStateKind.Bounds));
    this.methods.register(ShellMethods.writeWindowBounds, new WindowStateWriteMethod(store, WindowStateKind.Bounds));
    this.methods.register(ShellMethods.readWindowLayout, new WindowStateReadMethod(store, WindowStateKind.Layout));
    this.methods.register(ShellMethods.writeWindowLayout, new WindowStateWriteMethod(store, WindowStateKind.Layout));
    this.methods.register(ShellMethods.notifications, new NotificationsMethod(this.notifications, this.notificationSettings));
    this.methods.register(ShellMethods.postNotification, new PostNotificationMethod(this.notifications, this.modules.notificationPolicy));
    this.methods.register(ShellMethods.dismissNotification, new DismissNotificationMethod(this.notifications));
    this.methods.register(ShellMethods.markNotificationsRead, new MarkNotificationsReadMethod(this.notifications));
    this.methods.register(ShellMethods.clearNotifications, new ClearNotificationsMethod(this.notifications));
    this.modules.tools.permissions.open(new RememberedPermissionStore(database));
    this.secrets.open(new SecretTable(database));
    this.methods.register(ShellMethods.saveSecret, new SaveSecretMethod(this.secrets));
    this.methods.register(ShellMethods.removeSecret, new RemoveSecretMethod(this.secrets));
    this.methods.register(ShellMethods.secretStatus, new SecretStatusMethod(this.secrets));
    const recent = new RecentCommandsStore(database);
    this.methods.register(ShellMethods.recentCommands, new RecentCommandsMethod(recent));
    this.methods.register(ShellMethods.recordCommand, new RecordCommandMethod(recent, this.events.declare(ShellEvents.recentCommandsChanged)));
    return settings;
  }

  private async listenAsync(platform: string): Promise<Endpoint> {
    if (platform === Resources.windowsPlatform)
      return this.server.listenTcpAsync();

    const folder = this.lock.dataDirectory.discoveryFolder;
    await mkdir(folder, { recursive: true, mode: Resources.privateFolderMode });
    return this.server.listenSocketAsync(path.join(folder, Resources.socketFileName));
  }

  private async stopAsync(): Promise<void> {
    this.isStopping = true;
    this.idle[Symbol.dispose]();
    await this.errorsCap?.[Symbol.asyncDispose]();
    this.preparation?.[Symbol.dispose]();
    this.grants.dispose();
    this.work.cancelAll();
    try {
      await this.quit.endAsync();
      await this.server.closeAsync();
      try {
        await this.modules.deactivateAsync();
      }
      finally {
        await this.processes?.stopAllAsync();
        if (!Object.isNull(this.discovery))
          await this.publisher.withdrawAsync(this.discovery);
      }
    }
    catch (error) {
      this.log.writeLine(inspect(error));
      throw error;
    }
    finally {
      try {
        this.database?.close();
        await RuntimeHost.closeAsync(this.log, this.copyRecord);
      }
      finally {
        this.lock.release();
      }
    }
  }
}
