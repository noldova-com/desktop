/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { dirname, isAbsolute, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type Event, type RuntimeHandover, ShellMethods, WindowClosed } from "@noldova/desktop.protocol";
import {
  AppImageSource,
  type DataDirectory,
  DataDirectoryLocator,
  DeviceFolder,
  DiagnosticRedactor,
  Installation,
  LaunchSettings,
  RuntimeBuild,
  RuntimeEntry,
  ShellCommands,
  ShellSettings
} from "@noldova/desktop.runtime";

import { UnusableFolderException } from "../exceptions/unusable-folder.exception.js";
import type { IMainProcessEnvironment } from "../interfaces/i-main-process-environment.js";
import type { IMainProcessOptions } from "../interfaces/i-main-process-options.js";
import type { IDeviceFileStore } from "../interfaces/i-device-file-store.js";
import type { IElectron } from "../interfaces/i-electron.js";
import type { IPreventableEvent } from "../interfaces/i-preventable-event.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import type { IUpdateHost } from "../interfaces/i-update-host.js";
import type { IUpdateCheckLock } from "../interfaces/i-update-check-lock.js";
import type { ICreatedUpdater } from "../interfaces/i-created-updater.js";
import type { IUpdateSetup } from "../interfaces/i-update-setup.js";
import { UpdateStatus } from "../models/update-status.js";
import { MainProcessFailureKind } from "../enums/main-process-failure-kind.js";
import { StartupStateKind } from "../enums/startup-state-kind.js";
import { UpdateStateKind } from "../enums/update-state-kind.js";
import { KnownDevice } from "../models/known-device.js";
import { MainProcessPhase } from "../models/main-process-phase.js";
import { MainProcessSettings } from "../models/main-process-settings.js";
import { ScreenArea } from "../models/screen-area.js";
import { TaskbarIdentity } from "../models/taskbar-identity.js";
import type { StartupState } from "../models/startup-state.js";
import { WindowRegistry } from "../models/window-registry.js";
import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import { AgentController } from "./agent-controller.js";
import { AppIcons } from "./app-icons.js";
import { AppImageEnvironment } from "./app-image-environment.js";
import { AppSurfaceFeed } from "./app-surface-feed.js";
import { AppearanceKeeper } from "./appearance-keeper.js";
import { ApplicationMenu } from "./application-menu.js";
import { DeviceSettingFollower } from "./device-setting-follower.js";
import { DeviceState } from "./device-state.js";
import { IpcRouter } from "./ipc-router.js";
import { LayoutKeeper } from "./layout-keeper.js";
import { LocalWindowStateStore } from "./local-window-state-store.js";
import { MainProcessLog } from "./main-process-log.js";
import { MainProcessRecovery } from "./main-process-recovery.js";
import { MainProcessServices } from "./main-process-services.js";
import { MainProcessTray } from "./main-process-tray.js";
import { MainProcessUpdates } from "./main-process-updates.js";
import { OpenWindow } from "./open-window.js";
import type { PathCommand } from "./path-command.js";
import { QuitControl } from "./quit-control.js";
import { RestartArguments } from "./restart-arguments.js";
import { RuntimeCaller } from "./runtime-caller.js";
import { RuntimeEvents } from "./runtime-events.js";
import { RuntimeRequests } from "./runtime-requests.js";
import { RuntimeStartup } from "./runtime-startup.js";
import { SenderPolicy } from "./sender-policy.js";
import { SharedFileServer } from "./shared-file-server.js";
import { SpellChecker } from "./spell-checker.js";
import { SpellingDictionaries } from "./spelling-dictionaries.js";
import { SystemNotifier } from "./system-notifier.js";
import { TerminalRelaunch } from "./terminal-relaunch.js";
import { UpdateTargetConnector } from "./update-target-connector.js";
import { WebViewBridge } from "./web-view-bridge.js";
import { WindowControls } from "./window-controls.js";
import { WindowFactory } from "./window-factory.js";
import { WindowPlacement } from "./window-placement.js";
import { WindowRecovery } from "./window-recovery.js";
import { WindowTextLog } from "./window-text-log.js";

export class MainProcess {
  private static readonly UNOWNED_STATES: readonly StartupStateKind[] = [StartupStateKind.Connecting, StartupStateKind.PreShellData, StartupStateKind.Failed];

  private readonly options: IMainProcessOptions;
  private readonly launchArguments: readonly string[];
  private readonly windows: WindowRegistry;
  private readonly phase: MainProcessPhase;
  private readonly device: KnownDevice;
  private readonly factory: WindowFactory;
  private readonly appearance: AppearanceKeeper;
  private readonly notifier: SystemNotifier;
  private readonly startup: RuntimeStartup;
  private readonly runtime: RuntimeCaller;
  private readonly placement: WindowPlacement;
  private readonly quits: QuitControl;
  private readonly deviceState: DeviceState;
  private readonly trays: MainProcessTray;
  private readonly surface: AppSurfaceFeed;
  private readonly agents: AgentController;
  private readonly updates: MainProcessUpdates;
  private readonly webViews: WebViewBridge;
  private readonly services: MainProcessServices;
  private readonly controls: WindowControls;
  private readonly router: IpcRouter;
  private readonly events: RuntimeEvents;
  private readonly earlyEvents: Event[] = [];
  private readonly policy: SenderPolicy;

  private constructor(options: IMainProcessOptions) {
    const { electron, process, settings, installation, log } = options;
    this.options = options;
    this.launchArguments = options.argv.filter(t => Resources.handoverArguments.some(u => t.startsWith(u)));
    const policy = new SenderPolicy(settings.windowUrl);
    this.policy = policy;
    this.windows = new WindowRegistry(policy);
    this.phase = new MainProcessPhase();
    this.device = new KnownDevice();
    this.factory = new WindowFactory(settings, policy, electron, options.taskbar, options.icons, t => log.write(t));
    this.appearance = new AppearanceKeeper(options.createDeviceFile(options.deviceFolder, Resources.appearanceFile), this.factory, t => log.write(t));
    this.notifier = new SystemNotifier(electron.notifications, log, () => options.icons.window, () => this.windows.isAnyFocused, t => this.openNotification(t));
    const updateHost: IUpdateHost = {
      processId: process.processId,
      readBarrierAsync: () => installation.readAsync(),
      hasUpdateEndedAsync: () => installation.hasEndedAsync(),
      saveAsync: () => this.saveForUpdateAsync(),
      passBarrierAsync: t => this.updates.askAsync(t),
      quit: () => this.exitNow()
    };
    this.startup = new RuntimeStartup(options.launcher, t => this.publish(t), t => this.handOver(t), Resources.workWaitInterval, t => this.forward(t), t => log.write(t), Date.now, (t, signal) => delay(t, undefined, { signal }), updateHost);
    this.runtime = new RuntimeCaller(() => this.startup.connection);
    this.placement = new WindowPlacement(new LocalWindowStateStore(options.createDeviceFile(options.deviceFolder, Resources.windowStateFile), t => log.write(t)), this.startup, this.device, t => log.write(t));
    this.quits = new QuitControl({
      startup: this.startup,
      runtime: this.runtime,
      phase: this.phase,
      windows: this.windows,
      keepsRunningWithoutWindows: () => this.keepsRunningWithoutWindows(),
      findPromptAsync: () => this.findPromptAsync(),
      quit: () => electron.app.quit(),
      exit: () => this.exit(),
      whenRestartedAsync: () => this.updates.restart.whenRestartedAsync()
    }, t => log.write(t));
    this.deviceState = new DeviceState(options.createDeviceFile(options.deviceFolder, Resources.deviceStateFile), t => log.write(t));
    this.trays = new MainProcessTray(options, {
      deviceState: this.deviceState,
      windows: this.windows,
      runtime: this.runtime,
      device: this.device,
      notifier: this.notifier,
      open: () => this.reopen(),
      openNotification: t => this.openNotification(t),
      stopAgents: () => void this.agents.runCommandAsync(ShellCommands.stopAgentControl),
      resumeAgents: () => void this.agents.runCommandAsync(ShellCommands.resumeAgentControl),
      restartToUpdate: () => void this.updates.bridge.act(Resources.updateRestartAction),
      quit: () => electron.app.quit(),
      followTrayIcon: t => this.followTrayIcon(t)
    });
    this.surface = new AppSurfaceFeed(process.platform, process.processId, (method, payload) => this.runtime.callAsync(method, payload), t => log.write(t));
    this.surface.receiveStopKey(this.trays.stopKey.boundKey);
    const keyBindings = new DeviceSettingFollower(ShellSettings.keyBindings, {}, t => this.runtime.callAsync(ShellMethods.readSetting, t.toJson()),
      t => this.followKeyBindings(t), t => log.write(t));
    this.agents = new AgentController(this.runtime, this.trays.stopKey, this.trays.tray, keyBindings, t => log.write(t));
    this.updates = new MainProcessUpdates(options, {
      host: updateHost,
      startup: this.startup,
      windows: this.windows,
      phase: this.phase,
      deviceState: this.deviceState,
      tray: this.trays.tray,
      runtime: this.runtime,
      device: this.device,
      launchArguments: this.launchArguments,
      handoverFolders: MainProcess.readHandoverFolders(process, options.argv),
      findPromptAsync: () => this.findPromptAsync()
    });
    this.webViews = new WebViewBridge(options, this.windows, this.runtime, () => this.phase.isReady && !Object.isNull(this.startup.connection));
    this.services = new MainProcessServices(options, this.windows, this.runtime, this.device);
    this.controls = new WindowControls(electron.menu, settings, this.windows, options.spelling, t => log.write(t));
    this.router = new IpcRouter(electron.ipcMain, this.windows, {
      appearance: this.appearance,
      spelling: options.spelling,
      trayHosts: this.trays.hosts,
      controls: this.controls,
      textLog: new WindowTextLog(t => log.write(t)),
      startup: this.startup,
      layout: new LayoutKeeper(this.windows, this.runtime, this.device),
      requests: new RuntimeRequests(this.windows, this.runtime, this.device, this.notifier, t => log.write(t)),
      runtime: this.runtime,
      clipboard: this.services.clipboard,
      shellOpener: this.services.shellOpener,
      fileDialogs: this.services.fileDialogs,
      commandInstaller: this.services.commandInstaller,
      surface: this.surface,
      webViews: this.webViews.host,
      readUpdate: () => this.updates.bridge.status,
      actOnUpdate: t => this.updates.bridge.act(t),
      answerQuit: (open, choice) => this.updates.restart.answer(open, choice) || this.quits.coordinator.answer(open, choice)
    });
    this.events = new RuntimeEvents(this.windows, this.device, {
      notifier: this.notifier,
      tray: this.trays.tray,
      quit: this.quits.coordinator,
      agents: this.agents,
      secrets: this.services.secrets,
      trayIcon: this.trays.icon,
      keyBindings,
      updateChecks: this.updates.checks,
      answerWebView: t => void this.webViews.answerAsync(t),
      blockWebViewPorts: t => void this.webViews.blockPortsAsync(t),
      quitForRuntime: () => this.quits.quitForRuntime()
    }, t => log.write(t));
  }

  public static async startAsync(
    electron: IElectron,
    process: IMainProcessEnvironment,
    moduleUrl: string,
    createLauncher: (settings: LaunchSettings, installation: Installation, log: (text: string) => void) => IRuntimeLauncher,
    readDeviceAsync: (folder: string) => Promise<string>,
    createDeviceFile: (folder: string, fileName: string) => IDeviceFileStore,
    createPathCommand: (executablePath: string) => PathCommand,
    recordMainProcessAsync: (installation: Installation) => Promise<boolean>,
    createUpdater: (installation: Installation, isPackaged: boolean, logsFolder: string, log: (text: string) => void) => IUpdateSetup | null,
    createUpdateLock: (installation: Installation, log: (text: string) => void) => IUpdateCheckLock): Promise<void> {
    const recovery = new MainProcessRecovery(electron.app, electron.dialog, process.errorOutput, new DiagnosticRedactor(process.homeFolder));
    TerminalRelaunch.forgetConsole(process);
    process.onUncaughtException(t => recovery.receive(t, MainProcessFailureKind.UncaughtException));
    process.onUnhandledRejection(t => recovery.receive(t, MainProcessFailureKind.UnhandledRejection));
    electron.app.setName(Resources.applicationName);
    const moduleDirectory = dirname(fileURLToPath(moduleUrl));
    const isPackaged = MainProcess.isPackagedBuild(electron, process);
    const program = AppImageSource.locateProgram(process.env, process.execPath);
    const restartArguments = new RestartArguments(MainProcess.locateRestartFolder(process, isPackaged), program, process.platform);
    const unread: unknown[] = [];
    const kept = isPackaged ? restartArguments.read(RuntimeBuild.identity.productVersion, Date.now(), t => unread.push(t)) : [];
    const handedOver = process.argv.some(t => Resources.handoverArguments.some(u => t.startsWith(u))) ? [] : kept;
    const argv = [...process.argv, ...handedOver];
    const dataDirectory = DataDirectoryLocator.locate(
      isPackaged,
      process.env,
      process.homeFolder,
      join(moduleDirectory, ...Resources.repositoryRootSegments),
      MainProcess.readFolderArgument(process, argv, Resources.dataDirectoryArgument));
    const userData = MainProcess.readFolderArgument(process, argv, Resources.userDataArgument);
    const keptProfile = MainProcess.readFolderArgument(process, handedOver, Resources.userDataArgument);
    if (Object.isUndefined(userData))
      MainProcess.keepProfileIn(electron, dataDirectory.root, dataDirectory.profileFolder);
    else if (!Object.isUndefined(keptProfile))
      MainProcess.keepProfileIn(electron, keptProfile, keptProfile);
    const log = new MainProcessLog(dataDirectory, process.errorOutput, new DiagnosticRedactor(process.homeFolder, [Resources.applicationName]));
    for (const failure of unread)
      log.write(Resources.formatRestartArgumentsUnread(String(failure)));
    if (!MainProcess.prepareBeforeReady(electron, process, log))
      return;
    if (isPackaged)
      await restartArguments.removeAsync().catch((failure: unknown) => log.write(Resources.formatRestartArgumentsNotForgotten(String(failure))));
    const launchSettings = new LaunchSettings(
      dataDirectory,
      process.execPath,
      RuntimeEntry.entryPath,
      { ...process.env, [Resources.runAsNodeVariable]: Resources.runAsNodeValue },
      process.platform);
    const presence = process.presence;
    const deviceFolder = MainProcess.locateDeviceFolder(process, argv);
    const installation = new Installation(Installation.locate(deviceFolder, program, process.platform), t => presence.isRunningAsync(t));
    const icons = await AppIcons.locateAsync(join(moduleDirectory, ...Resources.repositoryRootSegments, ...Resources.iconFolderSegments), process.platform, electron.theme);
    const taskbar = await TaskbarIdentity.createAsync(isPackaged, process.execPath, icons.window, fileURLToPath(moduleUrl), argv, process.workingDirectory);
    if (handedOver.length > 0)
      log.writeKept(Resources.formatRestartArgumentsTaken(handedOver));
    const connector = new UpdateTargetConnector(installation.folder, t => Installation.locate(deviceFolder, t, process.platform),
      root => createLauncher(new LaunchSettings(root, launchSettings.executablePath, launchSettings.entryPath, launchSettings.environment, process.platform), installation, t => log.write(t)),
      presence,
      Date.now, delay);
    const profileFolder = userData ?? dataDirectory.profileFolder;
    const languages = process.platform === Resources.macPlatform
      ? []
      : await SpellingDictionaries.installAsync(join(moduleDirectory, ...Resources.repositoryRootSegments, ...Resources.dictionaryFolderSegments), profileFolder, t => log.write(t));
    const spelling = new SpellChecker(
      () => electron.session.defaultSession, languages, SpellingDictionaries.addressOf(profileFolder), process.platform, () => electron.app.getPreferredSystemLanguages(), t => log.write(t));
    const updater = MainProcess.createUpdater(createUpdater, installation, isPackaged, dataDirectory, log);
    const application = new MainProcess({
      electron,
      process,
      argv,
      restartArguments,
      settings: MainProcessSettings.fromModule(moduleDirectory, process.platform),
      taskbar,
      dataDirectory,
      deviceFolder,
      isPackaged,
      log,
      launcher: createLauncher(launchSettings, installation, t => log.write(t)),
      icons,
      spelling,
      installation,
      presence,
      connector,
      updater,
      updateLock: createUpdateLock(installation, t => log.write(t)),
      readDeviceAsync,
      createDeviceFile,
      createPathCommand,
      recordMainProcessAsync: () => recordMainProcessAsync(installation)
    });
    recovery.attach(log, () => application.services.shellOpener.openLogFolderAsync(), () => {
      try {
        application.release();
      }
      finally {
        log.flush();
      }
    });
    application.run();
  }

  private static prepareBeforeReady(electron: IElectron, process: IMainProcessEnvironment, log: MainProcessLog): boolean {
    const app = electron.app;
    if (process.platform === Resources.linuxPlatform) {
      const features = app.commandLine.getSwitchValue(Resources.enableFeaturesSwitch);
      app.commandLine.appendSwitch(Resources.enableFeaturesSwitch,
        features.length === 0 ? Resources.globalShortcutsPortalFeature : Resources.formatFeatureList(features, Resources.globalShortcutsPortalFeature));
    }
    if (!app.requestSingleInstanceLock()) {
      log.writeShared(Resources.formatSingleInstanceLockRefused(process.processId));
      app.quit();
      return false;
    }
    app.enableSandbox();
    electron.protocol.registerSchemesAsPrivileged([SharedFileServer.scheme]);
    return true;
  }

  private run(): void {
    const { electron, settings, taskbar } = this.options;
    const app = electron.app;
    app.setAppUserModelId(taskbar.appId);
    if (settings.platform === Resources.linuxPlatform)
      app.setDesktopName(`${taskbar.appId}${Resources.mainProcessFileSuffix}`);
    const relaunch = TerminalRelaunch.find(this.options.process, this.options.argv, this.options.isPackaged);
    if (Object.isNull(relaunch)) {
      this.listen();
      return;
    }
    app.releaseSingleInstanceLock();
    void relaunch.startAsync(() => app.whenReady()).then(() => {
      this.options.log.flush();
      app.exit(Resources.quitExitCode);
    }, (error: unknown) => this.stayInTerminal(error));
  }

  private stayInTerminal(error: unknown): void {
    this.options.log.write(Resources.formatRelaunchFailed(String(error)));
    if (this.options.electron.app.requestSingleInstanceLock())
      this.listen();
    else
      this.options.electron.app.quit();
  }

  private listen(): void {
    const app = this.options.electron.app;
    app.on(Resources.secondInstanceEvent, () => this.reopen());
    app.on(Resources.beforeQuitEvent, (event: IPreventableEvent) => this.beforeQuit(event));
    app.on(Resources.windowAllClosedEvent, () => {
      if (!this.keepsRunningWithoutWindows())
        app.quit();
    });
    app.on(Resources.willQuitEvent, () => {
      this.release();
      this.startup.close();
      this.options.log.flush();
    });
    const barrier = this.passBarrierAsync();
    void app.whenReady().then(() => this.ready(barrier));
  }

  private async passBarrierAsync(): Promise<boolean> {
    const [isClear] = await Promise.all([this.updates.passAsync(), this.recordSelfAsync()]);
    if (isClear)
      void this.startup.startAsync();
    return isClear;
  }

  private ready(barrier: Promise<boolean>): void {
    const { electron, log } = this.options;
    this.options.spelling.start();
    const session = electron.session.defaultSession;
    ApplicationMenu.install(electron.menu, this.options.settings);
    electron.app.dock?.setIcon(this.options.icons.dock);
    this.device.begin(this.options.readDeviceAsync(this.options.deviceFolder), t => log.write(t));
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.setPermissionCheckHandler(() => false);
    this.router.listen();
    electron.app.on(Resources.activateEvent, () => {
      if (this.phase.hasPassedBarrier && this.windows.size === 0 && !this.quits.isQuitting)
        this.open();
    });
    void Promise.all([barrier, this.appearance.readAsync(), this.deviceState.readAsync(),
      this.placement.readStateAsync()]).then(([isClear, , state, saved]) => {
      if (this.phase.isExiting)
        return;
      if (!isClear) {
        this.exitNow();
        return;
      }
      this.phase.hasPassedBarrier = true;
      this.trays.start(state);
      this.open(saved);
      this.updates.start(state);
      this.publish(this.startup.current);
      for (const event of this.earlyEvents.splice(0))
        this.events.forward(event);
    });
  }

  private async recordSelfAsync(): Promise<void> {
    try {
      if (!await this.options.recordMainProcessAsync())
        this.options.log.write(Resources.formatMainProcessUnrecorded(Resources.updateHolderNotFound));
    }
    catch (error) {
      this.options.log.write(Resources.formatMainProcessUnrecorded(String(error)));
    }
  }

  private isWayland(): boolean {
    return this.options.settings.platform === Resources.linuxPlatform &&
      this.options.electron.app.commandLine.getSwitchValue(Resources.ozonePlatformSwitch) === Resources.waylandPlatform;
  }

  private open(saved: WindowState | null = null): OpenWindow {
    const { electron, process, log } = this.options;
    const window = this.factory.create(saved ?? WindowState.createDefault(ScreenArea.of(electron.screen.getPrimaryDisplay().workArea)), this.appearance.current);
    const contentsId = window.webContents.id;
    this.services.sharedFiles.serveOn(window.webContents.session);
    const open = new OpenWindow(window, electron.screen, log, this.quits.flow, this.options.settings.platform, this.isWayland());
    if (!Object.isNull(saved))
      this.placement.begin(open, saved);
    window.webContents.on(Resources.didStartNavigationEvent, t => {
      if (!t.isMainFrame || t.isSameDocument || !this.policy.isWindowUrl(t.url))
        return;
      this.notifier.hold();
      this.webViews.host.closeWindow(contentsId);
    });
    window.webContents.on(Resources.renderProcessGoneEvent, () => this.windows.endPage(contentsId));
    window.webContents.on(Resources.contextMenuEvent, (_event, params) => this.controls.forwardFieldMenu(open, params));
    new WindowRecovery(open, electron.dialog, log, process, () => electron.app.quit(), () => this.services.shellOpener.openLogFolderAsync(), Resources.reloadCrashLimit, Resources.rendererEndLimit);
    this.windows.add(contentsId, open);
    this.surface.openWindow(contentsId, this.isWayland() ? null : window.getMediaSourceId());
    const describe = (title: string): void => this.surface.describeWindow(contentsId, title, window.isVisible(), open.isPagePainted);
    describe(window.getTitle());
    void open.whenPaintedAsync().then(() => {
      if (!window.isDestroyed())
        describe(window.getTitle());
    });
    window.on(Resources.showEvent, () => describe(window.getTitle()));
    window.on(Resources.hideEvent, () => describe(window.getTitle()));
    window.on(Resources.pageTitleUpdatedEvent, (_event, title) => describe(title));
    window.once(Resources.closedEvent, () => {
      this.windows.remove(contentsId);
      this.surface.closeWindow(contentsId);
      this.windows.endPage(contentsId);
      this.webViews.host.closeWindow(contentsId);
      void this.runtime.callAsync(ShellMethods.windowClosed, new WindowClosed(contentsId).toJson());
      this.closeToBackground();
    });
    if (Object.isNull(saved))
      open.settleWithin(Resources.connectingShowLimit);
    else
      open.settle();
    open.showUnpaintedWithin(Resources.paintShowLimit);
    void this.placement.prepareAsync(open);
    return open;
  }

  private forward(event: Event): void {
    if (this.phase.hasPassedBarrier)
      this.events.forward(event);
    else
      this.earlyEvents.push(event);
  }

  private publish(state: StartupState): void {
    if (!this.phase.hasPassedBarrier)
      return;
    if (!MainProcess.UNOWNED_STATES.includes(state.kind))
      void this.options.log.openAsync();
    const isReady = state.kind === StartupStateKind.Ready;
    if (isReady !== this.phase.isReady)
      this.notifier.reset();
    if (!isReady)
      this.quits.coordinator.release();
    if (isReady && !this.phase.isReady) {
      this.trays.connect();
      this.updates.connect();
      void this.agents.refreshAsync();
      this.surface.connect();
      void this.webViews.connectAsync();
    }
    else if (!isReady) {
      this.webViews.disconnect();
      this.surface.disconnect();
      this.agents.disconnect();
      this.trays.disconnect();
      this.updates.disconnect();
    }
    this.phase.isReady = isReady;
    if (isReady)
      this.webViews.host.flush();
    for (const open of this.windows.all)
      if (!open.window.isDestroyed()) {
        open.window.webContents.send(Resources.startupStateChannel, state.toJson());
        void this.placement.prepareAsync(open);
      }
  }

  private beforeQuit(event: IPreventableEvent): void {
    if (this.phase.isExiting)
      return;
    event.preventDefault();
    if (!this.updates.restart.holdQuit())
      void this.quits.flow.quitAsync();
  }

  private keepsRunningWithoutWindows(): boolean {
    return this.options.settings.platform === Resources.macPlatform || this.trays.tray.isShown;
  }

  private closeToBackground(): void {
    if (this.windows.size === 0 && !this.quits.isQuitting && this.options.settings.platform !== Resources.macPlatform && this.trays.tray.isShown)
      this.trays.showCloseHint();
  }

  private followTrayIcon(isShown: boolean): void {
    if (!isShown && this.windows.size === 0 && !this.quits.isQuitting && !this.keepsRunningWithoutWindows())
      this.open();
  }

  private async findPromptAsync(): Promise<IQuitPrompt | null> {
    const open = this.focus() ?? this.open();
    return await open.whenPaintedAsync() ? open : null;
  }

  private exit(): void {
    this.phase.isExiting = true;
    this.startup.close();
    for (const open of this.windows.all)
      open.closeNow();
    this.options.electron.app.quit();
  }

  private openNotification(id: string): void {
    this.focus()?.window.webContents.send(Resources.notificationOpenedChannel, id);
  }

  private exitNow(): void {
    this.phase.isExiting = true;
    this.startup.close();
    this.release();
    this.options.log.flush();
    this.options.electron.app.exit(Resources.quitExitCode);
  }

  private release(): void {
    this.updates.stop();
    this.trays.release();
  }

  private followKeyBindings(value: JsonValue): void {
    this.trays.stopKey.receiveBindings(value);
    this.surface.receiveStopKey(this.trays.stopKey.boundKey);
  }

  private reopen(): void {
    if (this.phase.hasPassedBarrier && !this.phase.isExiting && Object.isNull(this.focus()) && !this.quits.flow.isQuitting)
      this.open();
  }

  private handOver(handover: RuntimeHandover): boolean {
    if (!this.options.isPackaged)
      return false;
    this.options.process.startDetached(handover.executablePath, this.launchArguments, t => this.options.log.write(Resources.formatHandoverFailed(String(t))));
    this.exit();
    return true;
  }

  private async saveForUpdateAsync(): Promise<readonly string[]> {
    const problems = await Promise.all(this.windows.all.map(async (t, index) => {
      const saved = await t.updateSaves.requestAsync(index + 1);
      await this.placement.holdAsync(t);
      return saved;
    }));
    return problems.flat();
  }

  private focus(): OpenWindow | null {
    const open = this.windows.first;
    open?.focus();
    return open;
  }

  private static createUpdater(
    create: (installation: Installation, isPackaged: boolean, logsFolder: string, log: (text: string) => void) => IUpdateSetup | null,
    installation: Installation,
    isPackaged: boolean,
    dataDirectory: DataDirectory,
    log: MainProcessLog): ICreatedUpdater {
    try {
      return { setup: create(installation, isPackaged, dataDirectory.logsFolder, t => log.write(t)), status: UpdateStatus.off };
    }
    catch (error) {
      log.write(Resources.formatUpdaterNotCreated(String(error)));
      return { setup: null, status: new UpdateStatus(UpdateStateKind.Failed, null, null, null, Resources.updaterNotCreated, false) };
    }
  }

  private static isPackagedBuild(electron: IElectron, process: IMainProcessEnvironment): boolean {
    return electron.app.isPackaged && !process.isDefaultApp;
  }

  private static keepProfileIn(electron: IElectron, folder: string, profile: string): void {
    try {
      electron.app.setPath(Resources.userDataPath, profile);
    }
    catch (error) {
      throw new UnusableFolderException(folder, error);
    }
  }

  private static locateRestartFolder(process: IMainProcessEnvironment, isPackaged: boolean): string {
    return isPackaged && process.platform !== Resources.linuxPlatform ? DeviceFolder.locate(process.platform, {}, process.readAccountHomeFolder()) : process.temporaryFolder;
  }

  private static locateDeviceFolder(process: IMainProcessEnvironment, argv: readonly string[]): string {
    return MainProcess.readFolderArgument(process, argv, Resources.deviceDirectoryArgument) ?? DeviceFolder.locate(process.platform, process.env, process.homeFolder);
  }

  private static readHandoverFolders(process: IMainProcessEnvironment, argv: readonly string[]): readonly string[] {
    return Resources.handoverArguments.flatMap(t => {
      const folder = MainProcess.readFolderArgument(process, argv, t);
      return Object.isUndefined(folder) ? [] : [`${t}${folder}`];
    });
  }

  private static readFolderArgument(process: IMainProcessEnvironment, argv: readonly string[], prefix: string): string | undefined {
    const folder = argv.find(t => t.startsWith(prefix))?.slice(prefix.length);
    return Object.isUndefined(folder) || String.isNullOrWhitespace(folder) || isAbsolute(folder) ? folder : resolve(AppImageEnvironment.locateStartFolder(process), folder);
  }
}
