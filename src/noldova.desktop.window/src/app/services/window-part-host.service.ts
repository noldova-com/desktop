/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, ErrorHandler, Injectable, Injector, type Signal, type Type, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import {
  type AgentControlState, type CommandInfo, CommandList, CommandRun, ModuleState, ModuleStatus, ModuleStatusList, type NotificationPost, NotificationReference,
  type SettingChange, type SettingEntry, type SettingOption, type SettingScope, ShellEvents, ShellMethods, type WebViewPane
} from "@noldova/desktop.protocol";

import { ContentPadding } from "../enums/content-padding.js";
import { DockSide } from "../enums/dock-side.js";
import type { FileSaveOutcome } from "../enums/file-save-outcome.js";
import { DependencyNotFollowedException } from "../exceptions/dependency-not-followed.exception.js";
import { FileNotOpenedException } from "../exceptions/file-not-opened.exception.js";
import { FileNotShownException } from "../exceptions/file-not-shown.exception.js";
import { RuntimeDisconnectedException } from "../exceptions/runtime-disconnected.exception.js";
import { WindowPartActivationFailedException } from "../exceptions/window-part-activation-failed.exception.js";
import { WindowPartLoadFailedException } from "../exceptions/window-part-load-failed.exception.js";
import { WindowPartReconnectionFailedException } from "../exceptions/window-part-reconnection-failed.exception.js";
import type { ICommandKey } from "../interfaces/i-command-key.js";
import type { IDocumentUpdate } from "../interfaces/i-document-update.js";
import type { IFileChoiceOptions } from "../interfaces/i-file-choice-options.js";
import type { IFilePathChoiceOptions } from "../interfaces/i-file-path-choice-options.js";
import type { IFileGrantOptions } from "../interfaces/i-file-grant-options.js";
import type { IInAppBrowser } from "../interfaces/i-in-app-browser.js";
import type { ILinkOpenOptions } from "../interfaces/i-link-open-options.js";
import type { ISelectionSource } from "../interfaces/i-selection-source.js";
import type { IWebViewHandle } from "../interfaces/i-web-view-handle.js";
import type { IWindowPalette } from "../interfaces/i-window-palette.js";
import type { IWindowPart } from "../interfaces/i-window-part.js";
import type { IWindowPartContext } from "../interfaces/i-window-part-context.js";
import type { IWindowPartHost } from "../interfaces/i-window-part-host.js";
import { BuildTokens } from "../models/build-tokens.js";
import { CommandContribution } from "../models/command-contribution.js";
import { ContentPaddingRef } from "../models/content-padding-ref.js";
import { ContributionMatch } from "../models/contribution-match.js";
import type { DocumentContribution } from "../models/document-contribution.js";
import type { DocumentHeading } from "../models/document-heading.js";
import { DocumentLook } from "../models/document-look.js";
import type { IssuedFileGrants } from "../models/issued-file-grants.js";
import { DocumentTab } from "../models/layout/document-tab.js";
import type { Tab } from "../models/layout/tab.js";
import { TabLabel } from "../models/layout/tab-label.js";
import { ViewRegistry } from "../models/layout/view-registry.js";
import { ViewTab } from "../models/layout/view-tab.js";
import { ViewType } from "../models/layout/view-type.js";
import type { MenuItem } from "../models/menu-item.js";
import { ShellDocuments } from "../models/shell-documents.js";
import { ModuleFailure } from "../models/module-failure.js";
import { PendingDocument } from "../models/pending-document.js";
import { PendingViewChange } from "../models/pending-view-change.js";
import type { PlaceholderContribution } from "../models/placeholder-contribution.js";
import { ProductName } from "../models/product-name.js";
import type { SearchSourceContribution } from "../models/search-source-contribution.js";
import { SettingsPageEntry } from "../models/settings/settings-page-entry.js";
import type { StartupState } from "../models/startup-state.js";
import type { ViewBadge } from "../models/view-badge.js";
import type { ViewContribution } from "../models/view-contribution.js";
import { WindowPartActivation } from "../models/window-part-activation.js";
import { WindowPartContext } from "../models/window-part-context.js";
import type { WindowPartSource } from "../models/window-part-source.js";
import { WindowPartTokens } from "../models/window-part-tokens.js";
import { Resources } from "../../resources.js";
import { AgentControlService } from "./agent-control.service.js";
import { BarItemsService } from "./bar-items.service.js";
import { ClosingService } from "./closing.service.js";
import { CommandService } from "./command.service.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";
import { DockGrowthService } from "./dock-growth.service.js";
import { DocumentHistoryService } from "./document-history.service.js";
import { DocumentInstancesService } from "./document-instances.service.js";
import { DocumentOpenerService } from "./document-opener.service.js";
import { EditTargetService } from "./edit-target.service.js";
import { LayoutService } from "./layout.service.js";
import { LinkService } from "./link.service.js";
import { LiveViewService } from "./live-view.service.js";
import { MenuService } from "./menu.service.js";
import { ModuleStatusService } from "./module-status.service.js";
import { SettingCheckService } from "./setting-check.service.js";
import { SettingOptionsService } from "./setting-options.service.js";
import { SettingsService } from "./settings.service.js";
import { TabLabelService } from "./tab-label.service.js";
import { TabRenameService } from "./tab-rename.service.js";
import { ViewDialogService } from "./view-dialog.service.js";
import { ViewInstancesService } from "./view-instances.service.js";
import { WebViewService } from "./web-view.service.js";
import { WindowRowOverlayService } from "./window-row-overlay.service.js";

@Injectable({ providedIn: "root" })
export class WindowPartHostService implements IWindowPartHost {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly links: LinkService = inject(LinkService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly liveViews: LiveViewService = inject(LiveViewService);
  private readonly opener: DocumentOpenerService = inject(DocumentOpenerService);
  private readonly documentInstances: DocumentInstancesService = inject(DocumentInstancesService);
  private readonly history: DocumentHistoryService = inject(DocumentHistoryService);
  private readonly edits: EditTargetService = inject(EditTargetService);
  private readonly labels: TabLabelService = inject(TabLabelService);
  private readonly renames: TabRenameService = inject(TabRenameService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly bars: BarItemsService = inject(BarItemsService);
  private readonly menus: MenuService = inject(MenuService);
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly settingOptions: SettingOptionsService = inject(SettingOptionsService);
  private readonly settingChecks: SettingCheckService = inject(SettingCheckService);
  private readonly viewDialogs: ViewDialogService = inject(ViewDialogService);
  private readonly webViews: WebViewService = inject(WebViewService);
  private readonly instances: ViewInstancesService = inject(ViewInstancesService);
  private readonly growth: DockGrowthService = inject(DockGrowthService);
  private readonly overlays: WindowRowOverlayService = inject(WindowRowOverlayService);
  private readonly injector: Injector = inject(Injector);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly sources: readonly WindowPartSource[] = inject(BuildTokens.sources);
  private readonly activations: WindowPartActivation[] = [];
  private readonly posting: Set<Promise<JsonValue>> = new Set();
  private startOpens: PendingDocument[] = [];
  private pendingOpens: PendingDocument[] = [];
  private pendingCloses: (readonly [string, string, string, boolean])[] = [];
  private pendingUpdates: (readonly [string, string, string, string | null, readonly string[] | null, string | null])[] = [];
  private viewChanges: PendingViewChange[] = [];
  private documentLists: (readonly [string, string, (instances: readonly string[] | null) => void])[] = [];
  private readonly activatingModules: Set<string> = new Set();
  private readonly startedModules: Set<string> = new Set();
  private moduleOrder: readonly string[] = [];
  private runtimeActive: ReadonlySet<string> = new Set();
  private runtimeCommands: readonly CommandContribution[] = [];
  private readonly runtimeStates: WritableSignal<CommandList | null> = signal(null);
  private readonly failuresValue: WritableSignal<readonly ModuleFailure[]> = signal([]);
  private readonly generationValue: WritableSignal<number> = signal(0);
  private readonly placeholderValue: WritableSignal<ContributionMatch | null> = signal(null);
  private readonly placeholderMatches: WeakMap<PlaceholderContribution, ContributionMatch> = new WeakMap();
  private readonly settingsPagesValue: WritableSignal<readonly SettingsPageEntry[]> = signal([]);
  private readonly searchSourcesValue: WritableSignal<readonly SearchSourceContribution[]> = signal([]);
  private readonly revisionsValue: WritableSignal<ReadonlyMap<string, number>> = signal(new Map());
  private readonly changedModules: Set<string> = new Set();
  private connection: number = 0;
  private isReady: boolean = false;
  private isLayoutLoaded: boolean = false;
  private isActivating: boolean = true;
  private reloading: Promise<void> = Promise.resolve();

  public readonly failures: Signal<readonly ModuleFailure[]> = computed(() => this.failuresValue().filter(t => !t.isTurnedOff));
  public readonly generation: Signal<number> = this.generationValue.asReadonly();
  public readonly agentControl: Signal<AgentControlState | null> = computed(() => this.injector.get(AgentControlService).state());
  public readonly placeholder: Signal<ContributionMatch | null> = this.placeholderValue.asReadonly();
  public readonly settingsPages: Signal<readonly SettingsPageEntry[]> = this.settingsPagesValue.asReadonly();
  public readonly searchSources: Signal<readonly SearchSourceContribution[]> = this.searchSourcesValue.asReadonly();

  public constructor() {
    this.labels.register(ShellDocuments.settings.name, ShellDocuments.settingsLabel);
    this.labels.register(ShellDocuments.modules.name, ShellDocuments.modulesLabel);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.bridge.onStartup(t => this.follow(t)));
    destroyRef.onDestroy(this.bridge.onEvent((name, payload) => this.receiveCommands(name, payload)));
    destroyRef.onDestroy(this.bridge.onNamedEvent(ShellEvents.modulesChanged.text, t => this.followModules(t)));
    void this.bridge.readStartupAsync().then(t => this.follow(t));
  }

  public get platform(): string {
    return this.bridge.platform;
  }

  public findContribution(tab: Tab): ContributionMatch | null {
    const shellDocument = ShellDocuments.find(tab);
    if (!Object.isNull(shellDocument))
      return WindowPartHostService.match(shellDocument, null);
    for (const activation of this.activations) {
      const contributions = tab instanceof DocumentTab ? activation.context.documents : activation.context.views;
      const contribution = contributions.find(t => t.name === tab.name);
      if (!Object.isUndefined(contribution))
        return WindowPartHostService.match(contribution, activation.context, activation.part.padding);
    }
    return null;
  }

  public findFailure(tab: Tab): ModuleFailure | null {
    return this.findFailures().find(t => (tab instanceof ViewTab ? t.viewNames : t.documentNames).includes(tab.name)) ?? null;
  }

  public revisionOf(tab: Tab): number {
    const revisions = this.revisionsValue();
    const owner = this.findContribution(tab)?.context?.moduleId ?? this.findFailure(tab)?.moduleId;
    return Object.isUndefined(owner) ? 0 : revisions.get(owner) ?? 0;
  }

  public requestAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    return this.bridge.requestAsync(method, payload);
  }

  public onEvent(name: string, listener: (payload: JsonValue) => void): () => void {
    return this.bridge.onNamedEvent(name, listener);
  }

  public readSetting(name: string): JsonValue | undefined {
    return this.settings.read(name);
  }

  public readSettingAsync(name: string, scope: SettingScope | null): Promise<SettingEntry> {
    return this.settings.readAsync(name, scope);
  }

  public writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null): Promise<void> {
    return this.settings.setAsync(name, value, scope);
  }

  public resetSettingAsync(name: string, scope: SettingScope | null): Promise<void> {
    return this.settings.resetAsync(name, scope);
  }

  public onSettingChanged(listener: (change: SettingChange) => void): () => void {
    return this.settings.onChanged(listener);
  }

  public openDocument(moduleId: string, name: string, instance: string, heading: DocumentHeading, isPreview: boolean, after: string | null = null): void {
    this.pendingCloses = this.pendingCloses.filter(([owner, contribution, key]) => owner !== moduleId || contribution !== name || key !== instance);
    this.pendingUpdates = this.pendingUpdates.filter(([owner, contribution, key]) => owner !== moduleId || contribution !== name || key !== instance);
    if (this.activatingModules.has(moduleId) && this.documentInstances.isUnheard(name, instance))
      return;
    this.documentInstances.reopen(name, instance);
    if (this.isActivating)
      this.pendingOpens.push(new PendingDocument(moduleId, name, instance, heading, isPreview, after, this.activatingModules.has(moduleId)));
    else
      this.opener.open(moduleId, name, instance, heading, isPreview, after);
  }

  public listSaves(): ReadonlyMap<string, readonly (() => Promise<void>)[]> {
    return new Map(this.activations.filter(t => t.context.saves.length > 0).map(t => [t.context.moduleId, [...t.context.saves]]));
  }

  public log(moduleId: string, message: string): void {
    this.bridge.logModule(moduleId, message);
  }

  public openLinkAsync(url: string, options: ILinkOpenOptions): Promise<void> {
    return this.links.openAsync(url, options);
  }

  public showLinkMenu(url: string, event: MouseEvent): void {
    this.links.showMenu(url, event);
  }

  public registerInAppBrowser(browser: IInAppBrowser, log: (message: string) => void): () => void {
    return this.links.register(browser, log);
  }

  public async showInFolderAsync(path: string): Promise<void> {
    const refusal = await this.bridge.showInFolderAsync(path);
    if (!Object.isNull(refusal))
      throw new FileNotShownException(ProductName.current, refusal);
  }

  public async openFileAsync(path: string): Promise<void> {
    const refusal = await this.bridge.openFileAsync(path);
    if (!Object.isNull(refusal))
      throw new FileNotOpenedException(ProductName.current, refusal);
  }

  public openWebViewAsync(context: IWindowPartContext, moduleId: string, pane: WebViewPane, tab: Tab, profileKey: string): Promise<IWebViewHandle> {
    return this.webViews.openAsync(moduleId, pane, tab, profileKey, this.createPartInjector(context));
  }

  public chooseFolderAsync(): Promise<string | null> {
    return this.bridge.chooseFolderAsync();
  }

  public chooseFilePathAsync(options: IFilePathChoiceOptions): Promise<string | null> {
    return this.bridge.chooseFilePathAsync(options);
  }

  public saveFileAsync(name: string, bytes: Uint8Array): Promise<FileSaveOutcome> {
    return this.bridge.saveFileAsync(name, bytes);
  }

  public chooseFilesAsync(moduleId: string, options: IFileChoiceOptions): Promise<IssuedFileGrants> {
    return this.bridge.chooseFilesAsync(moduleId, options);
  }

  public grantFilesAsync(moduleId: string, files: readonly File[], options: IFileGrantOptions): Promise<IssuedFileGrants> {
    return this.bridge.grantFilesAsync(moduleId, files, options);
  }

  public discardFileGrants(grants: readonly string[]): void {
    this.bridge.discardFileGrantsAsync(grants).catch((error: unknown) => this.errors.handleError(error));
  }

  public keepDocument(moduleId: string, name: string, instance: string): void {
    this.startOpens = this.startOpens.map(t => t.kept(moduleId, name, instance));
    this.pendingOpens = this.pendingOpens.map(t => t.kept(moduleId, name, instance));
    if (this.isLayoutLoaded)
      this.opener.keep(moduleId, name, instance);
  }

  public closeDocument(moduleId: string, name: string, instance: string): void {
    this.endDocument(moduleId, name, instance, false);
  }

  public forgetDocument(moduleId: string, name: string, instance: string): void {
    this.endDocument(moduleId, name, instance, true);
  }

  public onDocumentClosed(name: string, listener: (instance: string) => void): () => void {
    return this.documentInstances.onClosed(name, listener);
  }

  public onTabRenamed(name: string, listener: (instance: string, title: string) => void): () => void {
    return this.renames.onRenamed(name, listener);
  }

  public listOpenDocumentsAsync(moduleId: string, name: string): Promise<readonly string[] | null> {
    if (!this.isActivating)
      return Promise.resolve(this.documentInstances.instancesOf(name));
    return new Promise(resolve => this.documentLists.push([moduleId, name, resolve]));
  }

  public openDocumentLook(moduleId: string, name: string, instance: string, change: IDocumentUpdate): void {
    const tab = new DocumentTab(name, instance);
    const isOpen = this.documentInstances.instancesOf(name).includes(instance) || [...this.startOpens, ...this.pendingOpens].some(t => t.isFor(moduleId, name, instance));
    const look = isOpen ? this.labels.lookOf(tab) : DocumentLook.none;
    this.labels.setLook(tab, look.updated(change));
  }

  public updateDocumentLook(name: string, instance: string, change: IDocumentUpdate): void {
    const tab = new DocumentTab(name, instance);
    this.labels.setLook(tab, this.labels.lookOf(tab).updated(change));
  }

  public updateDocument(moduleId: string, name: string, instance: string, title: string | null, breadcrumb: readonly string[] | null, breadcrumbIcon: string | null = null): void {
    this.startOpens = this.startOpens.map(t => t.updated(moduleId, name, instance, title, breadcrumb, breadcrumbIcon));
    this.pendingOpens = this.pendingOpens.map(t => t.updated(moduleId, name, instance, title, breadcrumb, breadcrumbIcon));
    if (this.isLayoutLoaded)
      this.opener.update(moduleId, name, instance, title, breadcrumb, breadcrumbIcon);
    else
      this.pendingUpdates.push([moduleId, name, instance, title, breadcrumb, breadcrumbIcon]);
  }

  public openView(moduleId: string, name: string, instance: string, heading: DocumentHeading, icon: string | null, tabGroup: string | null): void {
    const isEarly = this.activatingModules.has(moduleId);
    this.changeView(new PendingViewChange(moduleId, isEarly, new ViewTab(name, instance).key, () => isEarly
      ? this.instances.restore(name, instance, heading, icon, tabGroup)
      : this.instances.openInstance(name, instance, heading, icon, tabGroup)));
  }

  public updateView(moduleId: string, name: string, instance: string, title: string | null, icon: string | null, breadcrumb: readonly string[] | null, breadcrumbIcon: string | null = null): void {
    this.changeView(new PendingViewChange(moduleId, this.activatingModules.has(moduleId), null, () => this.instances.update(name, instance, title, icon, breadcrumb, breadcrumbIcon)));
  }

  public closeView(moduleId: string, name: string, instance: string): void {
    this.changeView(new PendingViewChange(moduleId, this.activatingModules.has(moduleId), null, () => this.instances.close(name, instance)));
  }

  public showView(moduleId: string, name: string): void {
    this.changeView(new PendingViewChange(moduleId, this.activatingModules.has(moduleId), null, () => this.instances.show(new ViewTab(name))));
  }

  public hideViewDock(moduleId: string, name: string, instance: string | null): void {
    this.changeView(new PendingViewChange(moduleId, this.activatingModules.has(moduleId), null, () => this.instances.hideDock(new ViewTab(name, instance ?? undefined))));
  }

  public growViewDock(name: string, instance: string | null, minimum: number): () => void {
    return this.growth.grow(new ViewTab(name, instance ?? undefined), minimum);
  }

  public viewDockOf(name: string, instance: string | null): Signal<DockSide | null> {
    return this.instances.dockOf(new ViewTab(name, instance ?? undefined));
  }

  public onViewClosed(name: string, listener: (instance: string) => void): () => void {
    return this.instances.onClosed(name, listener);
  }

  public async showInDialogAsync(name: string, instance: string | null, title: string | null): Promise<void> {
    const tab = this.layout.registry().hasDocument(name) ? new DocumentTab(name, instance ?? undefined) : new ViewTab(name, instance ?? undefined);
    await this.viewDialogs.showAsync(tab, title);
  }

  public openBelowWindowRow<T>(context: IWindowPartContext, component: Type<T>): IWindowPalette<T> | null {
    return this.overlays.open(component, this.createPartInjector(context), Resources.windowPalettePaneClass);
  }

  public declaresDynamicMenuGroup(moduleId: string, group: string): boolean {
    return this.menus.declaresDynamicGroup(moduleId, group);
  }

  public provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuItem[]): () => void {
    return this.menus.provideGroup(group, provider);
  }

  public declaresDynamicSetting(setting: string): boolean {
    return this.settingOptions.isDynamic(setting);
  }

  public provideSettingOptions(setting: string, provider: (values: JsonObject) => readonly SettingOption[] | null): () => void {
    return this.settingOptions.provide(setting, provider);
  }

  public refreshSettingOptions(setting: string): void {
    this.settingOptions.refresh(setting);
  }

  public declaresCheckedSetting(setting: string): boolean {
    return this.settingChecks.isChecked(setting);
  }

  public provideSettingCheck(setting: string, check: (value: string) => string | null): () => void {
    return this.settingChecks.provide(setting, check);
  }

  public findPlaceholderName(): string | null {
    return this.activations.flatMap(t => t.context.placeholders)[0]?.name ?? null;
  }

  public isCommandRegistered(name: string): boolean {
    return this.runtimeCommands.some(t => t.name === name) || this.activations.some(t => t.context.commands.some(u => u.name === name));
  }

  public runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue> {
    return this.commands.runAsync(name, commandArguments);
  }

  public findWindowCommand(event: KeyboardEvent): string | null {
    return this.commands.findWindowCommand(event);
  }

  public keyOf(name: string): Signal<ICommandKey | null> {
    return computed(() => this.commands.keyOf(name), { equal: (first, second) => first?.label === second?.label && first?.ariaKeyShortcuts === second?.ariaKeyShortcuts });
  }

  public async postNotificationAsync(post: NotificationPost): Promise<string> {
    const request = this.bridge.requestAsync(ShellMethods.postNotification.text, post.toJson());
    this.posting.add(request);
    try {
      return NotificationReference.fromJson(await request).id;
    }
    finally {
      this.posting.delete(request);
    }
  }

  public dismissNotification(id: string): void {
    this.bridge.requestAsync(ShellMethods.dismissNotification.text, new NotificationReference(id).toJson()).catch((error: unknown) => this.errors.handleError(error));
  }

  public setViewBadge(view: string, badge: ViewBadge | null): void {
    this.labels.setBadge(view, badge);
  }

  public setTabWorking(tabKey: string, isWorking: boolean): void {
    this.labels.setWorking(tabKey, isWorking);
  }

  public setTabWaiting(tabKey: string, isWaiting: boolean): void {
    this.labels.setWaiting(tabKey, isWaiting);
  }

  public registerSelectionSource(element: HTMLElement, source: ISelectionSource): () => void {
    return this.edits.registerSource(element, source);
  }

  public refresh(): void {
    this.commands.setCommands([Resources.shellOwner, ...this.moduleOrder].flatMap(t => [
      ...this.runtimeCommands.filter(u => u.name.startsWith(`${t}${Resources.contributionSeparator}`)),
      ...this.activations.find(u => u.context.moduleId === t)?.context.commands ?? []
    ]));
    const ordered = this.moduleOrder.flatMap(t => this.activations.filter(u => u.context.moduleId === t));
    this.bars.set(ordered.flatMap(t => t.context.statusBarItems), ordered.flatMap(t => t.context.topBarActions));
    this.placeholderValue.set(ordered.flatMap(t => t.context.placeholders.map(u => this.matchPlaceholder(u, t)))[0] ?? null);
    this.searchSourcesValue.set(ordered.flatMap(t => t.context.searchSources));
    this.setSettingsPages(this.moduleOrder.flatMap(t => this.settingsPagesOf(t)));
    const failures = this.findFailures();
    const notStarted = new Set(failures.map(t => t.moduleId));
    this.menus.setActiveModules(this.moduleOrder.filter(t => !notStarted.has(t)));
    const views = this.activations.flatMap(t => t.context.views);
    for (const view of views)
      this.labels.register(view.name, new TabLabel(view.title, view.icon));
    const failed = failures.flatMap(t => t.viewNames.map(u => ({ name: u, failure: t })));
    for (const view of failed)
      this.labels.register(view.name, new TabLabel(view.failure.displayName, view.failure.glyph));
    this.layout.setRegistry(new ViewRegistry(
      [...views.map(t => new ViewType(t.name, t.defaultSide, t.isShownByDefault, t.hasInstances, t.tabRowPlace, t.isRenamable)), ...failed.map(t => new ViewType(t.name, DockSide.Left, false))],
      [...ShellDocuments.all.map(t => t.name), ...this.activations.flatMap(t => t.context.documents.map(u => u.name))],
      new Map(this.activations.flatMap(t => t.context.documents.flatMap((u): [string, string][] => Object.isNull(u.tabRowPlace) ? [] : [[u.name, u.tabRowPlace]]))),
      new Set(this.activations.flatMap(t => t.context.documents.filter(u => u.isRenamable).map(u => u.name)))));
  }

  private createPartInjector(context: IWindowPartContext): Injector {
    return Injector.create({
      providers: [
        { provide: WindowPartTokens.context, useValue: context },
        { provide: WindowPartTokens.contentPadding, useValue: new ContentPaddingRef() },
        { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() }
      ],
      parent: this.injector
    });
  }

  private follow(state: StartupState): void {
    if (!state.isReady)
      this.runtimeStates.set(null);
    if (state.isReady && !this.isReady) {
      const connection = ++this.connection;
      this.reloading = this.reloading.then(() => this.reloadAsync(connection)).catch((error: unknown) => this.errors.handleError(error));
    }
    this.isReady = state.isReady;
  }

  private followModules(payload: JsonValue): void {
    const connection = this.connection;
    this.reloading = this.reloading.then(() => this.reloadAsync(connection, ModuleStatusList.fromJson(payload))).catch((error: unknown) => this.errors.handleError(error));
  }

  private isConnected(connection: number): boolean {
    return this.isReady && this.connection === connection;
  }

  private async reloadAsync(connection: number, report: ModuleStatusList | null = null): Promise<void> {
    if (!this.isConnected(connection))
      return;
    this.isActivating = true;
    try {
      if (!await (Object.isNull(report) ? this.activateReportedAsync(connection) : this.switchModulesAsync(report, connection)))
        return;
    }
    catch (error) {
      if (!this.isConnected(connection) || RuntimeDisconnectedException.isIn(error))
        return;
      this.errors.handleError(error);
      await this.deactivateAsync(this.activations.slice());
      this.setFailures([]);
      this.moduleOrder = [];
      this.runtimeCommands = [];
    }
    const isReconnect = this.isLayoutLoaded;
    this.startOpens = this.pendingOpens.splice(0);
    const restore = (pending: PendingDocument): void => this.opener.restore(pending.moduleId, pending.name, pending.instance, pending.heading, pending.isPreview);
    const restoreEarly = (pending: PendingDocument): void => pending.isEarly ? restore(pending) : this.openPending(pending);
    let openAtStart: (pending: PendingDocument) => void = !isReconnect ? t => this.openPending(t) : Object.isNull(report) ? restore : restoreEarly;
    try {
      await Promise.allSettled(this.posting);
      this.refresh();
      this.revise();
      if (Object.isNull(report))
        this.generationValue.update(t => t + 1);
      if (!isReconnect && await this.loadLayoutAsync())
        openAtStart = t => this.opener.restoreSaved(t.moduleId, t.name, t.instance, t.heading, t.isPreview);
    }
    catch (error) {
      if (this.isLayoutLoaded || !RuntimeDisconnectedException.isIn(error))
        this.replayPending(openAtStart);
      else
        this.pendingOpens.unshift(...this.startOpens.splice(0));
      throw error;
    }
    this.replayPending(openAtStart);
  }

  private async activateReportedAsync(connection: number): Promise<boolean> {
    await this.settings.loadAsync();
    const report = ModuleStatusList.fromJson(await this.bridge.requestAsync(ShellMethods.modules.text, null));
    this.statuses.report(report.modules);
    const commands = CommandList.fromJson(await this.bridge.requestAsync(ShellMethods.commands.text, null));
    const kept = await this.reconnectPartsAsync(report.modules, connection);
    if (!this.isConnected(connection))
      return false;
    this.moduleOrder = report.modules.map(t => t.id);
    this.takeRuntimeCommands(commands);
    return await this.applyReportAsync(report, kept, connection);
  }

  private async switchModulesAsync(report: ModuleStatusList, connection: number): Promise<boolean> {
    const held = this.statuses.modules();
    const kept = new Map(report.modules
      .filter(t => t.state === ModuleState.Active && this.runtimeActive.has(t.id))
      .flatMap(t => held.filter(u => u.id === t.id))
      .map(t => [t.id, t] as const));
    this.statuses.report(report.modules);
    const commands = CommandList.fromJson(await this.bridge.requestAsync(ShellMethods.commands.text, null));
    if (!this.isConnected(connection))
      return false;
    this.takeRuntimeCommands(commands);
    await this.injector.get(ClosingService).saveModulesAsync(
      new Set(this.activations.map(t => t.context.moduleId).filter(t => !kept.has(t))), t => Resources.formatPartSaveFailedBeforeStop(t));
    return await this.applyReportAsync(report, kept, connection);
  }

  private async applyReportAsync(report: ModuleStatusList, kept: ReadonlyMap<string, ModuleStatus>, connection: number): Promise<boolean> {
    this.runtimeActive = new Set(report.modules.filter(t => t.state === ModuleState.Active).map(t => t.id));
    await this.deactivateAsync(this.activations.filter(t => !kept.has(t.context.moduleId)));
    this.announceWithdrawn(t => !this.runtimeActive.has(t));
    const active = new Set<string>();
    const statuses: ModuleStatus[] = [];
    for (const status of report.modules) {
      if (!this.isConnected(connection))
        return false;
      const keptStatus = kept.get(status.id);
      const result = status.state === ModuleState.Active && Object.isUndefined(keptStatus) ? await this.activateAsync(status, active) : keptStatus ?? status;
      if (result.state === ModuleState.Active)
        active.add(result.id);
      statuses.push(result);
    }
    this.statuses.set(statuses);
    this.announceDependencies(kept, active);
    const turnedOff = new Set<string>();
    for (const status of statuses)
      if (status.state === ModuleState.Off || status.state === ModuleState.Unavailable || (status.state === ModuleState.Blocked && turnedOff.has(String(status.blockedBy))))
        turnedOff.add(status.id);
    this.setFailures(statuses.filter(t => t.state !== ModuleState.Active).map(t => this.describeFailure(t, turnedOff.has(t.id))));
    return this.isConnected(connection);
  }

  private async reconnectPartsAsync(modules: readonly ModuleStatus[], connection: number): Promise<ReadonlyMap<string, ModuleStatus>> {
    const kept = new Map<string, ModuleStatus>();
    for (const status of modules) {
      if (!this.isConnected(connection))
        break;
      const activation = this.activations.find(t => t.context.moduleId === status.id);
      if (Object.isUndefined(activation) || status.state !== ModuleState.Active)
        continue;
      if (activation.source.dependencies.every(t => kept.has(t) || !this.sources.some(u => u.moduleId === t)) && await this.reconnectPartAsync(activation))
        kept.set(status.id, status);
    }
    return kept;
  }

  private announceDependencies(kept: ReadonlyMap<string, ModuleStatus>, active: ReadonlySet<string>): void {
    for (const activation of this.activations.filter(t => kept.has(t.context.moduleId)))
      for (const dependency of activation.source.optionalDependencies.filter(t => activation.context.isDependencyActive(t) !== active.has(t)))
        activation.context.announceDependency(dependency, active.has(dependency), this.dependencyListenerFailure(activation.context.moduleId));
  }

  private dependencyListenerFailure(moduleId: string): (error: unknown) => void {
    return error => this.errors.handleError(new DependencyNotFollowedException(moduleId, error));
  }

  private async reconnectPartAsync(activation: WindowPartActivation): Promise<boolean> {
    try {
      return await activation.part.reconnectAsync();
    }
    catch (error) {
      if (RuntimeDisconnectedException.isIn(error))
        throw error;
      this.errors.handleError(new WindowPartReconnectionFailedException(activation.context.moduleId, error));
      return false;
    }
  }

  private settingsPagesOf(moduleId: string): readonly SettingsPageEntry[] {
    const context = this.activations.find(t => t.context.moduleId === moduleId)?.context ?? null;
    const failure = Object.isNull(context) ? this.failuresValue().find(t => t.moduleId === moduleId) ?? null : null;
    if (failure?.isTurnedOff === true)
      return [];
    const isSettled = !Object.isNull(context) && !this.activatingModules.has(moduleId);
    return (this.sources.find(t => t.moduleId === moduleId)?.settingsPages ?? [])
      .map(t => new SettingsPageEntry(t.name, t.title, moduleId, context?.settingsPages.find(u => u.name === t.name) ?? null, context, failure))
      .filter(t => !isSettled || !Object.isNull(t.page));
  }

  private setSettingsPages(pages: readonly SettingsPageEntry[]): void {
    const previous = this.settingsPagesValue();
    const kept = pages.map(t => previous.find(u => u.isSame(t)) ?? t);
    if (kept.length !== previous.length || kept.some((t, index) => t !== previous[index]))
      this.settingsPagesValue.set(kept);
  }

  private findFailures(): readonly ModuleFailure[] {
    return this.failuresValue().filter(t => !this.activations.some(u => u.context.moduleId === t.moduleId));
  }

  private setFailures(failures: readonly ModuleFailure[]): void {
    const previous = this.failuresValue();
    for (const id of new Set([...previous, ...failures].map(t => t.moduleId))) {
      const before = previous.find(t => t.moduleId === id);
      const after = failures.find(t => t.moduleId === id);
      if (before?.state !== after?.state || before?.cause !== after?.cause)
        this.changedModules.add(id);
    }
    this.failuresValue.set(failures);
  }

  private revise(): void {
    const changed = [...this.changedModules];
    this.changedModules.clear();
    if (changed.length > 0)
      this.revisionsValue.update(t => new Map([...t, ...changed.map(u => [u, (t.get(u) ?? 0) + 1] as const)]));
  }

  private async loadLayoutAsync(): Promise<boolean> {
    try {
      const isRestored = await this.layout.loadAsync();
      this.isLayoutLoaded = true;
      return isRestored;
    }
    catch (error) {
      this.isLayoutLoaded = !RuntimeDisconnectedException.isIn(error);
      throw error;
    }
  }

  private replayPending(openAtStart: (pending: PendingDocument) => void): void {
    this.isActivating = false;
    for (const pending of this.startOpens.splice(0))
      this.replay(pending, openAtStart);
    for (const pending of this.pendingOpens.splice(0))
      this.replay(pending, t => this.openPending(t));
    this.layout.reopenEarlyDocuments();
    for (const [moduleId, name, instance, title, breadcrumb, breadcrumbIcon] of this.pendingUpdates.splice(0))
      this.later(() => this.opener.update(moduleId, name, instance, title, breadcrumb, breadcrumbIcon));
    for (const [moduleId, name, instance, isForgotten] of this.pendingCloses.splice(0))
      this.later(() => this.closeNow(moduleId, name, instance, isForgotten));
    const started = new Set(this.activations.filter(t => this.startedModules.has(t.context.moduleId)).flatMap(t => t.context.documents).map(t => t.name));
    this.replayViews();
    this.documentInstances.reconcile(started);
    for (const [, name, resolve] of this.documentLists.splice(0))
      resolve(this.documentInstances.instancesOf(name));
  }

  private endDocument(moduleId: string, name: string, instance: string, isForgotten: boolean): void {
    this.startOpens = this.startOpens.filter(t => !t.isFor(moduleId, name, instance));
    this.pendingOpens = this.pendingOpens.filter(t => !t.isFor(moduleId, name, instance));
    this.pendingUpdates = this.pendingUpdates.filter(([owner, contribution, key]) => owner !== moduleId || contribution !== name || key !== instance);
    if (this.isLayoutLoaded)
      this.closeNow(moduleId, name, instance, isForgotten);
    else
      this.pendingCloses.push([moduleId, name, instance, isForgotten]);
  }

  private closeNow(moduleId: string, name: string, instance: string, isForgotten: boolean): void {
    try {
      this.opener.close(moduleId, name, instance);
      this.documentInstances.hush(name, instance);
    }
    finally {
      if (isForgotten)
        this.history.forget(new DocumentTab(name, instance));
    }
  }

  private dropPending(moduleId: string): void {
    this.pendingOpens = this.pendingOpens.filter(t => t.moduleId !== moduleId);
    this.pendingUpdates = this.pendingUpdates.filter(([owner]) => owner !== moduleId);
    this.pendingCloses = this.pendingCloses.filter(([owner]) => owner !== moduleId);
    this.viewChanges = this.viewChanges.filter(t => t.moduleId !== moduleId);
    for (const [, , resolve] of this.documentLists.filter(([owner]) => owner === moduleId))
      resolve(null);
    this.documentLists = this.documentLists.filter(([owner]) => owner !== moduleId);
  }

  private changeView(change: PendingViewChange): void {
    if (this.isActivating)
      this.viewChanges.push(change);
    else
      change.apply();
  }

  private replayViews(): void {
    const active = new Set(this.activations.map(t => t.context.moduleId));
    const changes = this.viewChanges.splice(0);
    const started = [...this.startedModules].filter(t => active.has(t));
    this.startedModules.clear();
    const early = changes.filter(t => t.isEarly);
    for (const change of early)
      change.apply();
    for (const moduleId of started) {
      const views = this.activations.filter(t => t.context.moduleId === moduleId).flatMap(t => t.context.views).filter(t => t.hasInstances).map(t => t.name);
      const kept = early.filter(t => t.moduleId === moduleId).flatMap(t => Object.isNull(t.opened) ? [] : [t.opened]);
      this.instances.reconcile(new Set(views), new Set(kept));
    }
    for (const change of changes.filter(t => !t.isEarly))
      change.apply();
  }

  private later(action: () => void): void {
    try {
      action();
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private replay(pending: PendingDocument, open: (pending: PendingDocument) => void): void {
    try {
      open(pending);
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private openPending(pending: PendingDocument): void {
    this.opener.open(pending.moduleId, pending.name, pending.instance, pending.heading, pending.isPreview, pending.after);
  }

  private describeRuntimeCommand(info: CommandInfo): CommandContribution {
    return new CommandContribution(
      info.name.text,
      info.title,
      info.icon,
      info.defaultKey?.text ?? null,
      t => this.bridge.requestAsync(ShellMethods.runCommand.text, new CommandRun(info.name, t).toJson()),
      () => this.findRuntimeState(info)?.isEnabled ?? false,
      Object.isNull(info.isChecked) ? null : () => this.findRuntimeState(info)?.isChecked === true);
  }

  private findRuntimeState(info: CommandInfo): CommandInfo | undefined {
    return this.runtimeStates()?.commands.find(t => t.name.text === info.name.text);
  }

  private receiveCommands(name: string, payload: JsonValue): void {
    if (name !== ShellEvents.commandsChanged.text)
      return;
    try {
      this.applyCommands(CommandList.fromJson(payload));
    }
    catch (error) {
      this.errors.handleError(error);
    }
  }

  private takeRuntimeCommands(commands: CommandList): void {
    this.applyCommands(commands);
    this.runtimeCommands = commands.commands.map(t => this.describeRuntimeCommand(t));
  }

  private applyCommands(commands: CommandList): void {
    const current = this.runtimeStates();
    if (Object.isNull(current) || commands.sequence > current.sequence)
      this.runtimeStates.set(commands);
  }

  private describeFailure(status: ModuleStatus, isTurnedOff: boolean): ModuleFailure {
    const source = this.sources.find(t => t.moduleId === status.id);
    const isOff = status.state === ModuleState.Off;
    const keepsDocuments = isOff || status.state === ModuleState.Unavailable;
    return new ModuleFailure(status.id, status.displayName, status.state, status.cause, source?.viewNames ?? [], keepsDocuments ? source?.documentNames : [],
      isOff ? status.switchSetting : null, isTurnedOff);
  }

  private async activateAsync(status: ModuleStatus, active: ReadonlySet<string>): Promise<ModuleStatus> {
    const source = this.sources.find(t => t.moduleId === status.id);
    if (Object.isUndefined(source))
      return status;
    const blocker = source.dependencies.find(t => !active.has(t));
    if (!Object.isUndefined(blocker))
      return status.withState(ModuleState.Blocked, Resources.formatModuleBlocked(blocker), blocker);

    let part: IWindowPart;
    try {
      part = await source.load();
    }
    catch (error) {
      this.errors.handleError(new WindowPartLoadFailedException(status.id, error));
      return status.withState(ModuleState.Failed, Resources.windowPartLoadFailed);
    }

    const activation = new WindowPartActivation(source, new WindowPartContext(source, this), part);
    for (const dependency of source.optionalDependencies.filter(t => active.has(t)))
      activation.context.announceDependency(dependency, true, this.dependencyListenerFailure(status.id));
    this.activations.push(activation);
    this.changedModules.add(status.id);
    this.activatingModules.add(status.id);
    try {
      await part.activateAsync(activation.context);
    }
    catch (error) {
      this.activatingModules.delete(status.id);
      this.activations.splice(this.activations.indexOf(activation), 1);
      this.labels.dropLooks(t => WindowPartHostService.owns(activation.context, t));
      activation.context.withdraw();
      this.dropPending(status.id);
      if (RuntimeDisconnectedException.isIn(error))
        throw error;
      this.errors.handleError(new WindowPartActivationFailedException(status.id, error));
      return status.withState(ModuleState.Failed, Resources.windowPartActivationFailed);
    }
    this.activatingModules.delete(status.id);
    this.startedModules.add(status.id);
    return status;
  }

  private async deactivateAsync(activations: readonly WindowPartActivation[]): Promise<void> {
    for (const activation of [...activations].reverse()) {
      this.liveViews.destroy(t => WindowPartHostService.owns(activation.context, t));
      this.activations.splice(this.activations.indexOf(activation), 1);
      this.changedModules.add(activation.context.moduleId);
      try {
        await activation.part.deactivateAsync();
      }
      catch (error) {
        this.errors.handleError(error);
      }
      finally {
        this.labels.dropLooks(t => WindowPartHostService.owns(activation.context, t));
        activation.context.withdraw();
        this.dropPending(activation.context.moduleId);
        this.announceWithdrawn(t => t === activation.context.moduleId);
      }
    }
  }

  private announceWithdrawn(isWithdrawn: (moduleId: string) => boolean): void {
    for (const activation of this.activations)
      for (const dependency of activation.source.optionalDependencies.filter(t => activation.context.isDependencyActive(t) && isWithdrawn(t)))
        activation.context.announceDependency(dependency, false, this.dependencyListenerFailure(activation.context.moduleId));
  }

  private static owns(context: WindowPartContext, tab: Tab): boolean {
    const contributions = tab instanceof DocumentTab ? context.documents : context.views;
    return contributions.some(t => t.name === tab.name);
  }

  private matchPlaceholder(placeholder: PlaceholderContribution, activation: WindowPartActivation): ContributionMatch {
    const known = this.placeholderMatches.get(placeholder);
    if (!Object.isUndefined(known))
      return known;
    const match = WindowPartHostService.match(placeholder, activation.context, activation.part.padding);
    this.placeholderMatches.set(placeholder, match);
    return match;
  }

  private static match(contribution: ViewContribution | DocumentContribution | PlaceholderContribution, context: WindowPartContext | null, modulePadding?: ContentPadding): ContributionMatch {
    return new ContributionMatch(contribution.loadComponent, context, contribution.padding ?? modulePadding ?? ContentPadding.Default);
  }
}
