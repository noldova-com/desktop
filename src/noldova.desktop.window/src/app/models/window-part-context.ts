/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type Signal, type Type, type WritableSignal, signal } from "@angular/core";

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { type AgentControlState, FileGrant, type NotificationPost, type SettingEntry, type SettingOption, type SettingScope, type WebViewPane } from "@noldova/desktop.protocol";

import type { DockSide } from "../enums/dock-side.js";
import { FileSaveOutcome } from "../enums/file-save-outcome.js";
import { CommandAlreadyRegisteredException } from "../exceptions/command-already-registered.exception.js";
import { CommandNotDeclaredException } from "../exceptions/command-not-declared.exception.js";
import { ContributionNotDeclaredException } from "../exceptions/contribution-not-declared.exception.js";
import { ContributionRegisteredException } from "../exceptions/contribution-registered.exception.js";
import { ForeignContributionException } from "../exceptions/foreign-contribution.exception.js";
import { ForeignNameException } from "../exceptions/foreign-name.exception.js";
import { PlaceholderShownException } from "../exceptions/placeholder-shown.exception.js";
import { SearchSourceRegisteredException } from "../exceptions/search-source-registered.exception.js";
import type { IWindowPartContext } from "../interfaces/i-window-part-context.js";
import type { ICommandKey } from "../interfaces/i-command-key.js";
import type { IDocumentOptions } from "../interfaces/i-document-options.js";
import type { IDocumentUpdate } from "../interfaces/i-document-update.js";
import type { IFileChoiceOptions } from "../interfaces/i-file-choice-options.js";
import type { IFilePathChoiceOptions } from "../interfaces/i-file-path-choice-options.js";
import type { IFileGrantOptions } from "../interfaces/i-file-grant-options.js";
import type { IInAppBrowser } from "../interfaces/i-in-app-browser.js";
import type { ILinkOpenOptions } from "../interfaces/i-link-open-options.js";
import type { ISelectionSource } from "../interfaces/i-selection-source.js";
import type { IViewDialogOptions } from "../interfaces/i-view-dialog-options.js";
import type { IViewInstanceOptions } from "../interfaces/i-view-instance-options.js";
import type { IViewUpdate } from "../interfaces/i-view-update.js";
import type { IWebViewHandle } from "../interfaces/i-web-view-handle.js";
import type { IWindowPalette } from "../interfaces/i-window-palette.js";
import type { IWindowPartHost } from "../interfaces/i-window-part-host.js";
import type { CommandContribution } from "./command-contribution.js";
import type { DocumentContribution } from "./document-contribution.js";
import { DocumentHeading } from "./document-heading.js";
import { DocumentLook } from "./document-look.js";
import { IssuedFileGrants } from "./issued-file-grants.js";
import { DocumentTab } from "./layout/document-tab.js";
import type { Tab } from "./layout/tab.js";
import { ViewTab } from "./layout/view-tab.js";
import { MenuItem } from "./menu-item.js";
import type { MenuRowContribution } from "./menu-row-contribution.js";
import { NotificationHandle } from "./notification-handle.js";
import type { PlaceholderContribution } from "./placeholder-contribution.js";
import type { SearchSourceContribution } from "./search-source-contribution.js";
import type { SettingsPageContribution } from "./settings-page-contribution.js";
import type { SettingsRow } from "./settings/settings-row.js";
import { StatusBarItem } from "./status-bar-item.js";
import type { StatusBarItemContribution } from "./status-bar-item-contribution.js";
import { TopBarAction } from "./top-bar-action.js";
import type { TopBarActionContribution } from "./top-bar-action-contribution.js";
import type { ViewBadge } from "./view-badge.js";
import type { ViewContribution } from "./view-contribution.js";
import type { WindowPartSource } from "./window-part-source.js";
import { WindowSecrets } from "./window-secrets.js";
import { WindowWebViews } from "./window-web-views.js";
import { Resources } from "../../resources.js";

export class WindowPartContext implements IWindowPartContext {
  private static readonly ignore: () => void = () => undefined;
  private static readonly noDock: Signal<DockSide | null> = signal<DockSide | null>(null).asReadonly();

  private readonly host: IWindowPartHost;
  private readonly owners: readonly string[];
  private readonly source: WindowPartSource;
  private readonly notifications: Set<NotificationHandle> = new Set();
  private readonly commandList: CommandContribution[] = [];
  private readonly statusBarItemList: StatusBarItem[] = [];
  private readonly topBarActionList: TopBarAction[] = [];
  private readonly viewList: ViewContribution[] = [];
  private readonly withdrawnViews: ViewContribution[] = [];
  private readonly fileGrants: Set<string> = new Set();
  private readonly documentList: DocumentContribution[] = [];
  private readonly placeholderList: PlaceholderContribution[] = [];
  private readonly settingsPageList: SettingsPageContribution[] = [];
  private readonly searchSourceList: SearchSourceContribution[] = [];
  private readonly settingsRows: WritableSignal<ReadonlyMap<string, readonly SettingsRow[]>> = signal(new Map());
  private readonly saveList: (() => Promise<void>)[] = [];
  private readonly subscriptions: (() => void)[] = [];
  private readonly dependencyListeners: Set<(moduleId: string, isActive: boolean) => void> = new Set();
  private readonly activeDependencies: Set<string> = new Set();
  private readonly badgedViews: Set<string> = new Set();
  private readonly workingTabs: Map<string, Set<object>> = new Map();
  private readonly waitingTabs: Map<string, Set<object>> = new Map();
  private readonly palettes: Set<IWindowPalette<unknown>> = new Set();
  private isWithdrawn: boolean = false;

  public readonly moduleId: string;
  public readonly webViews: WindowWebViews;
  public readonly secrets: WindowSecrets;
  public readonly agentControl: Signal<AgentControlState | null>;

  public constructor(source: WindowPartSource, host: IWindowPartHost) {
    this.moduleId = source.moduleId;
    this.owners = [source.moduleId, ...source.dependencies, ...source.optionalDependencies];
    this.source = source;
    this.host = host;
    this.webViews = new WindowWebViews((pane, profileKey) => this.openWebViewAsync(pane, profileKey));
    this.secrets = new WindowSecrets(source.moduleId, (method, payload) => host.requestAsync(method, payload));
    this.agentControl = host.agentControl;
  }

  public get views(): readonly ViewContribution[] {
    return this.viewList;
  }

  public get documents(): readonly DocumentContribution[] {
    return this.documentList;
  }

  public get placeholders(): readonly PlaceholderContribution[] {
    return this.placeholderList;
  }

  public get settingsPages(): readonly SettingsPageContribution[] {
    return this.settingsPageList;
  }

  public get searchSources(): readonly SearchSourceContribution[] {
    return this.searchSourceList;
  }

  public get saves(): readonly (() => Promise<void>)[] {
    return this.saveList;
  }

  public get commands(): readonly CommandContribution[] {
    return this.commandList;
  }

  public get statusBarItems(): readonly StatusBarItem[] {
    return this.source.statusBarItemNames.flatMap(t => this.statusBarItemList.filter(u => u.name === t));
  }

  public get topBarActions(): readonly TopBarAction[] {
    return this.source.topBarActionNames.flatMap(t => this.topBarActionList.filter(u => u.name === t));
  }

  public registerView(view: ViewContribution): void {
    this.requireDeclared(view.name, this.source.viewNames, this.viewList, Resources.viewKind);
    if (!Object.isNull(view.tabRowPlace))
      this.requireOwn(view.tabRowPlace);
    if (this.isWithdrawn)
      return;
    this.viewList.push(view);
    this.host.refresh();
  }

  public registerDocument(document: DocumentContribution): void {
    this.requireDeclared(document.name, this.source.documentNames, this.documentList, Resources.documentKind);
    if (!Object.isNull(document.tabRowPlace))
      this.requireOwn(document.tabRowPlace);
    if (this.isWithdrawn)
      return;
    this.documentList.push(document);
    this.host.refresh();
  }

  public registerPlaceholder(placeholder: PlaceholderContribution): void {
    this.requireDeclared(placeholder.name, this.source.placeholderNames, this.placeholderList, Resources.placeholderKind);
    if (this.isWithdrawn)
      return;
    const registered = this.host.findPlaceholderName();
    if (!Object.isNull(registered))
      throw new PlaceholderShownException(this.moduleId, placeholder.name, registered);
    this.placeholderList.push(placeholder);
    this.host.refresh();
  }

  public registerSettingsPage(page: SettingsPageContribution): void {
    this.requireDeclared(page.name, this.source.settingsPages.map(t => t.name), this.settingsPageList, Resources.settingsPageKind);
    if (this.isWithdrawn)
      return;
    this.settingsPageList.push(page);
    this.host.refresh();
  }

  public setSettingsRows(page: string, rows: readonly SettingsRow[]): void {
    this.requireOwn(page);
    if (!this.source.settingsPages.some(t => t.name === page))
      throw new ContributionNotDeclaredException(this.moduleId, page, Resources.settingsPageKind);
    for (const row of rows)
      this.requireOwn(row.id);
    if (new Set(rows.map(t => t.id)).size !== rows.length)
      throw new ArgumentException(Resources.settingsRowsRepeated, Resources.rowsParameter);
    if (this.isWithdrawn)
      return;
    const kept = [...rows];
    this.settingsRows.update(t => new Map([...t, [page, kept]]));
  }

  public settingsRowsOf(page: string): readonly SettingsRow[] {
    return this.settingsRows().get(page) ?? [];
  }

  public registerCommand(command: CommandContribution): void {
    this.requireOwn(command.name);
    if (!this.source.commandNames.includes(command.name))
      throw new CommandNotDeclaredException(this.moduleId, command.name);
    if (this.isWithdrawn)
      return;
    if (this.host.isCommandRegistered(command.name))
      throw new CommandAlreadyRegisteredException(this.moduleId, command.name);
    this.commandList.push(command);
    this.host.refresh();
  }

  public registerSearchSource(source: SearchSourceContribution): void {
    this.requireOwn(source.name);
    if (this.isWithdrawn)
      return;
    if (this.searchSourceList.some(t => t.name === source.name))
      throw new SearchSourceRegisteredException(this.moduleId, source.name);
    this.searchSourceList.push(source);
    this.host.refresh();
  }

  public registerStatusBarItem(item: StatusBarItemContribution): StatusBarItem {
    this.requireDeclared(item.name, this.source.statusBarItemNames, this.statusBarItemList, Resources.statusBarItemKind);
    const registered = new StatusBarItem(item, t => {
      if (!Object.isNull(t.command))
        this.requireAllowed(t.command);
    });
    if (this.isWithdrawn)
      return registered;
    this.statusBarItemList.push(registered);
    this.host.refresh();
    return registered;
  }

  public registerTopBarAction(action: TopBarActionContribution): TopBarAction {
    this.requireDeclared(action.name, this.source.topBarActionNames, this.topBarActionList, Resources.topBarActionKind);
    const registered = new TopBarAction(action, t => this.requireAllowed(t.command));
    if (this.isWithdrawn)
      return registered;
    this.topBarActionList.push(registered);
    this.host.refresh();
    return registered;
  }

  public registerSave(save: () => Promise<void>): () => void {
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    this.saveList.push(save);
    return () => {
      const index = this.saveList.indexOf(save);
      if (index >= 0)
        this.saveList.splice(index, 1);
    };
  }

  public registerSelectionSource(element: HTMLElement, source: ISelectionSource): () => void {
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const unregister = this.host.registerSelectionSource(element, source);
    this.subscriptions.push(unregister);
    return unregister;
  }

  public provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuRowContribution[]): () => void {
    this.requireOwn(group);
    if (!this.host.declaresDynamicMenuGroup(this.moduleId, group))
      throw new ContributionNotDeclaredException(this.moduleId, group, Resources.dynamicMenuGroupKind);
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const withdraw = this.host.provideMenuGroup(group, context => provider(context).filter(t => this.isAllowed(t.command))
      .map(t => MenuItem.ofCommand(t.command, t.commandArguments, t.label, t.icon)));
    this.subscriptions.push(withdraw);
    return withdraw;
  }

  public provideSettingOptions(setting: string, provider: (values: JsonObject) => readonly SettingOption[] | null): () => void {
    this.requireDynamicSetting(setting);
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const stop = this.host.provideSettingOptions(setting, provider);
    this.subscriptions.push(stop);
    return stop;
  }

  public refreshSettingOptions(setting: string): void {
    this.requireDynamicSetting(setting);
    this.host.refreshSettingOptions(setting);
  }

  public provideSettingCheck(setting: string, check: (value: string) => string | null): () => void {
    this.requireOwn(setting);
    if (!this.host.declaresCheckedSetting(setting))
      throw new ContributionNotDeclaredException(this.moduleId, setting, Resources.checkedSettingKind);
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const stop = this.host.provideSettingCheck(setting, value => {
      try {
        return check(value);
      }
      catch (error) {
        this.log(Resources.formatSettingCheckFailed(setting, error));
        return null;
      }
    });
    this.subscriptions.push(stop);
    return stop;
  }

  public setViewBadge(view: string, badge: ViewBadge | null): void {
    this.requireOwn(view);
    if (!this.source.viewNames.includes(view))
      throw new ContributionNotDeclaredException(this.moduleId, view, Resources.viewKind);
    if (this.isWithdrawn)
      return;
    if (Object.isNull(badge))
      this.badgedViews.delete(view);
    else
      this.badgedViews.add(view);
    this.host.setViewBadge(view, badge);
  }

  public markWorking(name: string, instance?: string): () => void {
    return this.markTab(name, instance, this.workingTabs, (t, u) => this.host.setTabWorking(t, u));
  }

  public markWaiting(name: string, instance?: string): () => void {
    return this.markTab(name, instance, this.waitingTabs, (t, u) => this.host.setTabWaiting(t, u));
  }

  public runCommandAsync(name: string, commandArguments: JsonValue = null): Promise<JsonValue> {
    if (name !== Resources.searchCommand)
      this.requireAllowed(name);
    return this.host.runCommandAsync(name, commandArguments);
  }

  public findWindowCommand(event: KeyboardEvent): string | null {
    return this.host.findWindowCommand(event);
  }

  public keyOf(command: string): Signal<ICommandKey | null> {
    return this.host.keyOf(command);
  }

  public async postNotificationAsync(post: NotificationPost): Promise<NotificationHandle> {
    this.requireNotification(post);
    if (this.isWithdrawn)
      return WindowPartContext.unposted(String.empty);
    const id = await this.host.postNotificationAsync(post);
    if (this.isWithdrawn) {
      this.host.dismissNotification(id);
      return WindowPartContext.unposted(id);
    }
    const handle: NotificationHandle = new NotificationHandle(id, () => this.dismissNotification(handle));
    this.notifications.add(handle);
    return handle;
  }

  public openDocument(name: string, instance: string, title: string, options: IDocumentOptions = {}): void {
    this.requireOwn(name);
    const heading = new DocumentHeading(title, options.breadcrumb ?? [], options.breadcrumbIcon ?? null);
    DocumentLook.validate(options);
    if (this.isWithdrawn)
      return;
    this.host.openDocumentLook(this.moduleId, name, instance, options);
    this.host.openDocument(this.moduleId, name, instance, heading, options.preview === true, options.after ?? null);
  }

  public keepDocument(name: string, instance: string): void {
    this.requireOwn(name);
    if (!this.isWithdrawn)
      this.host.keepDocument(this.moduleId, name, instance);
  }

  public closeDocument(name: string, instance: string): void {
    this.requireOwn(name);
    if (!this.isWithdrawn)
      this.host.closeDocument(this.moduleId, name, instance);
  }

  public forgetDocument(name: string, instance: string): void {
    this.requireOwn(name);
    if (!this.isWithdrawn)
      this.host.forgetDocument(this.moduleId, name, instance);
  }

  public updateDocument(name: string, instance: string, update: IDocumentUpdate): void {
    this.requireOwn(name);
    const title = Object.isUndefined(update.title) ? null : DocumentHeading.requireTitle(update.title);
    const breadcrumb = Object.isUndefined(update.breadcrumb) ? null : DocumentHeading.requireBreadcrumb(update.breadcrumb);
    const breadcrumbIcon = DocumentHeading.requireUpdateIcon(update.breadcrumbIcon ?? null, breadcrumb);
    const changesLook = DocumentLook.changes(update);
    if (changesLook)
      DocumentLook.validate(update);
    if (this.isWithdrawn)
      return;
    this.host.updateDocument(this.moduleId, name, instance, title, breadcrumb, breadcrumbIcon);
    if (changesLook)
      this.host.updateDocumentLook(name, instance, update);
  }

  public onDocumentClosed(name: string, listener: (instance: string) => void): () => void {
    this.requireOwnDocument(name);
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const unsubscribe = this.host.onDocumentClosed(name, listener);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  public onTabRenamed(name: string, listener: (instance: string, title: string) => void): () => void {
    this.requireOwn(name);
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    if (!this.viewList.some(t => t.name === name && t.isRenamable) && !this.documentList.some(t => t.name === name && t.isRenamable))
      throw new ContributionNotDeclaredException(this.moduleId, name, Resources.renamableKind);
    const unsubscribe = this.host.onTabRenamed(name, listener);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  public async listOpenDocumentsAsync(name: string): Promise<readonly string[] | null> {
    this.requireOwnDocument(name);
    return this.isWithdrawn ? null : await this.host.listOpenDocumentsAsync(this.moduleId, name);
  }

  public openView(name: string, instance: string, title: string, options: IViewInstanceOptions = {}): void {
    this.requireInstance(name, instance);
    const heading = new DocumentHeading(title, options.breadcrumb ?? [], options.breadcrumbIcon ?? null);
    if (!this.isWithdrawn)
      this.host.openView(this.moduleId, name, instance, heading, options.icon ?? null, options.tabGroup ?? null);
  }

  public updateView(name: string, instance: string, update: IViewUpdate): void {
    this.requireInstance(name, instance);
    const title = Object.isUndefined(update.title) ? null : DocumentHeading.requireTitle(update.title);
    const breadcrumb = Object.isUndefined(update.breadcrumb) ? null : DocumentHeading.requireBreadcrumb(update.breadcrumb);
    const breadcrumbIcon = DocumentHeading.requireUpdateIcon(update.breadcrumbIcon ?? null, breadcrumb);
    if (!this.isWithdrawn)
      this.host.updateView(this.moduleId, name, instance, title, update.icon ?? null, breadcrumb, breadcrumbIcon);
  }

  public closeView(name: string, instance: string): void {
    this.requireInstance(name, instance);
    if (!this.isWithdrawn)
      this.host.closeView(this.moduleId, name, instance);
  }

  public closeDialog(name: string, instance?: string): void {
    this.findOwnTab(name, instance);
    if (!Object.isUndefined(instance) && String.isNullOrWhitespace(instance))
      throw new ArgumentException(Resources.invalidInstance, Resources.instanceParameter);
    if (!this.isWithdrawn)
      this.host.closeDialog(name, instance ?? null);
  }

  public showView(name: string): void {
    this.requirePlainView(name);
    if (!this.isWithdrawn)
      this.host.showView(this.moduleId, name);
  }

  public hideViewDock(name: string, instance?: string): void {
    if (Object.isUndefined(instance))
      this.requirePlainView(name);
    else
      this.requireInstance(name, instance);
    if (!this.isWithdrawn)
      this.host.hideViewDock(this.moduleId, name, instance ?? null);
  }

  public growViewDock(name: string, minimum: number, instance?: string): () => void {
    if (Object.isUndefined(instance))
      this.requirePlainView(name);
    else
      this.requireInstance(name, instance);
    if (!(Number.isFinite(minimum) && minimum > 0))
      throw new ArgumentOutOfRangeException(Resources.minimumParameter, minimum, Resources.dockGrowthMinimumInvalid);
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const release = this.host.growViewDock(name, instance ?? null, minimum);
    this.subscriptions.push(release);
    return release;
  }

  public viewDockOf(name: string, instance?: string): Signal<DockSide | null> {
    if (Object.isUndefined(instance))
      this.requirePlainView(name);
    else
      this.requireInstance(name, instance);
    return this.isWithdrawn ? WindowPartContext.noDock : this.host.viewDockOf(name, instance ?? null);
  }

  public onViewClosed(name: string, listener: (instance: string) => void): () => void {
    this.requireInstanceView(name);
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const unsubscribe = this.host.onViewClosed(name, listener);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  public async showInDialogAsync(name: string, options: IViewDialogOptions = {}): Promise<void> {
    this.requireReadable(name);
    if (!this.isWithdrawn)
      await this.host.showInDialogAsync(name, options.instance ?? null, options.title ?? null);
  }

  public async openBelowWindowRowAsync<T>(load: () => Promise<Type<T>>): Promise<IWindowPalette<T> | null> {
    const component = await load();
    if (this.isWithdrawn)
      return null;
    const palette = this.host.openBelowWindowRow(this, component);
    if (Object.isNull(palette))
      return null;
    this.palettes.add(palette);
    void palette.closed.then(() => this.palettes.delete(palette));
    return palette;
  }

  public log(message: string): void {
    this.host.log(this.moduleId, message);
  }

  public async openLinkAsync(url: string, options: ILinkOpenOptions = {}): Promise<void> {
    if (!this.isWithdrawn)
      await this.host.openLinkAsync(url, options);
  }

  public showLinkMenu(url: string, event: MouseEvent): void {
    if (!this.isWithdrawn)
      this.host.showLinkMenu(url, event);
  }

  public registerInAppBrowser(browser: IInAppBrowser): () => void {
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const unregister = this.host.registerInAppBrowser(browser, message => this.log(message));
    this.subscriptions.push(unregister);
    return unregister;
  }

  public async showInFolderAsync(path: string): Promise<void> {
    if (!this.isWithdrawn)
      await this.host.showInFolderAsync(path);
  }

  public async openFileAsync(path: string): Promise<void> {
    if (!this.isWithdrawn)
      await this.host.openFileAsync(path);
  }

  public chooseFolderAsync(): Promise<string | null> {
    return this.isWithdrawn ? Promise.resolve(null) : this.host.chooseFolderAsync();
  }

  public async chooseFilePathAsync(options: IFilePathChoiceOptions = {}): Promise<string | null> {
    const { extensions, folder } = options;
    if (!Object.isUndefined(extensions) && (extensions.length === 0 || extensions.length > Resources.maximumFileExtensions || !extensions.every(t => Resources.fileExtensionPattern.test(t))))
      throw new ArgumentException(Resources.fileExtensionsInvalid, Resources.extensionsParameter);
    if (!Object.isUndefined(folder) && !this.isAbsoluteFolder(folder))
      throw new ArgumentException(Resources.fileChoiceFolderInvalid, Resources.folderParameter);
    return this.isWithdrawn ? null : await this.host.chooseFilePathAsync(options);
  }

  public saveFileAsync(name: string, bytes: Uint8Array): Promise<FileSaveOutcome> {
    return this.isWithdrawn ? Promise.resolve(FileSaveOutcome.Cancelled) : this.host.saveFileAsync(name, bytes);
  }

  public async chooseFilesAsync(options: IFileChoiceOptions = {}): Promise<IssuedFileGrants> {
    WindowPartContext.requireLifetime(options.lifetime);
    if (this.isWithdrawn)
      return IssuedFileGrants.none;
    return this.keepGrants(await this.host.chooseFilesAsync(this.moduleId, options));
  }

  public async grantFilesAsync(files: readonly File[], options: IFileGrantOptions = {}): Promise<IssuedFileGrants> {
    WindowPartContext.requireLifetime(options.lifetime);
    if (files.length > Resources.maximumOfferedFiles)
      throw new ArgumentOutOfRangeException(Resources.filesParameter, files.length, Resources.tooManyOfferedFiles);
    if (this.isWithdrawn || files.length === 0)
      return IssuedFileGrants.none;
    return this.keepGrants(await this.host.grantFilesAsync(this.moduleId, files, options));
  }

  public discardFileGrants(grants: readonly string[]): void {
    this.discard([...new Set(grants)].filter(t => this.fileGrants.delete(t)));
  }

  public fileAddressOf(grant: string): string {
    if (!Resources.sharedFileGrantPattern.test(grant))
      throw new ArgumentException(Resources.sharedFileGrantInvalid, Resources.grantParameter);
    if (this.isWithdrawn)
      this.discard([grant]);
    else
      this.fileGrants.add(grant);
    return Resources.formatSharedFileUrl(grant);
  }

  public async requestAsync(method: string, parameters: JsonValue): Promise<JsonValue> {
    this.requireAllowed(method);
    return this.host.requestAsync(method, parameters);
  }

  public onEvent(event: string, listener: (payload: JsonValue) => void): () => void {
    this.requireAllowed(event);
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const unsubscribe = this.host.onEvent(event, listener);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  public readSetting(name: string): JsonValue | undefined {
    this.requireReadable(name);
    return this.host.readSetting(name);
  }

  public async readSettingAsync(name: string, scope: SettingScope | null = null): Promise<SettingEntry> {
    this.requireReadable(name);
    return await this.host.readSettingAsync(name, scope);
  }

  public async writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null = null): Promise<void> {
    this.requireOwn(name);
    await this.host.writeSettingAsync(name, value, scope);
  }

  public async resetSettingAsync(name: string, scope: SettingScope | null = null): Promise<void> {
    this.requireOwn(name);
    await this.host.resetSettingAsync(name, scope);
  }

  public onSettingChanged(name: string, listener: (value: JsonValue, scope: SettingScope | null, isSet: boolean) => void): () => void {
    this.requireReadable(name);
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const unsubscribe = this.host.onSettingChanged(t => {
      if (t.key.name.text === name)
        listener(t.value, t.key.scope, t.isSet);
    });
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  public onDependencyChanged(listener: (moduleId: string, isActive: boolean) => void): () => void {
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const entry = (moduleId: string, isActive: boolean): void => listener(moduleId, isActive);
    this.dependencyListeners.add(entry);
    const stop = (): void => {
      this.dependencyListeners.delete(entry);
    };
    this.subscriptions.push(stop);
    return stop;
  }

  public isDependencyActive(moduleId: string): boolean {
    return !this.isWithdrawn && this.activeDependencies.has(moduleId);
  }

  public announceDependency(moduleId: string, isActive: boolean, fail: (error: unknown) => void): void {
    if (isActive)
      this.activeDependencies.add(moduleId);
    else
      this.activeDependencies.delete(moduleId);
    for (const listener of [...this.dependencyListeners]) {
      if (!this.dependencyListeners.has(listener))
        continue;
      try {
        listener(moduleId, isActive);
      }
      catch (error) {
        fail(error);
      }
    }
  }

  public withdraw(): void {
    this.isWithdrawn = true;
    this.webViews.withdraw();
    this.discard([...this.fileGrants]);
    this.fileGrants.clear();
    for (const unsubscribe of this.subscriptions.splice(0))
      unsubscribe();
    this.withdrawnViews.push(...this.viewList.splice(0));
    this.documentList.length = 0;
    this.placeholderList.length = 0;
    this.settingsPageList.length = 0;
    this.searchSourceList.length = 0;
    this.saveList.length = 0;
    this.commandList.length = 0;
    for (const handle of [...this.notifications])
      this.dismissNotification(handle);
    for (const palette of [...this.palettes])
      palette.close();
    for (const view of [...this.badgedViews])
      this.host.setViewBadge(view, null);
    this.badgedViews.clear();
    for (const [key, marks] of this.workingTabs) {
      marks.clear();
      this.host.setTabWorking(key, false);
    }
    this.workingTabs.clear();
    for (const [key, marks] of this.waitingTabs) {
      marks.clear();
      this.host.setTabWaiting(key, false);
    }
    this.waitingTabs.clear();
    this.statusBarItemList.length = 0;
    this.topBarActionList.length = 0;
    this.host.refresh();
  }

  public isAllowed(name: string): boolean {
    return this.owners.includes(name.substring(0, name.indexOf(Resources.contributionSeparator)));
  }

  private get knownViews(): readonly ViewContribution[] {
    return this.isWithdrawn ? this.withdrawnViews : this.viewList;
  }

  private keepGrants(issued: IssuedFileGrants): IssuedFileGrants {
    const grants = issued.files.map(t => t.grant);
    if (this.isWithdrawn) {
      this.discard(grants);
      return IssuedFileGrants.none;
    }
    for (const grant of grants)
      this.fileGrants.add(grant);
    return issued;
  }

  private discard(grants: readonly string[]): void {
    if (grants.length > 0)
      this.host.discardFileGrants(grants);
  }

  private isAbsoluteFolder(folder: string): boolean {
    const absolute = this.host.platform === Resources.windowsPlatform ? Resources.windowsAbsolutePathPattern : Resources.posixAbsolutePathPattern;
    return absolute.test(folder) && !Resources.controlCharacterPattern.test(folder);
  }

  private static requireLifetime(lifetime: number | undefined): void {
    if (!Object.isUndefined(lifetime) && (!Number.isInteger(lifetime) || lifetime <= 0 || lifetime > FileGrant.maximumLifetime))
      throw new ArgumentOutOfRangeException(Resources.lifetimeParameter, lifetime, Resources.fileGrantLifetimeInvalid);
  }

  private static unposted(id: string): NotificationHandle {
    return new NotificationHandle(id, WindowPartContext.ignore);
  }

  private dismissNotification(handle: NotificationHandle): void {
    if (this.notifications.delete(handle))
      this.host.dismissNotification(handle.id);
  }

  private requireNotification(post: NotificationPost): void {
    this.requireOwn(post.kind.text);
    if (!this.source.notificationKinds.includes(post.kind.text))
      throw new ContributionNotDeclaredException(this.moduleId, post.kind.text, Resources.notificationKind);
    for (const command of [...Object.isNull(post.open) ? [] : [post.open], ...post.actions.map(t => t.command)])
      this.requireAllowed(command.name.text);
  }

  private async openWebViewAsync(pane: WebViewPane, profileKey: string): Promise<IWebViewHandle> {
    const tab = this.findOwnTab(pane.name.text, pane.instance ?? undefined);
    return await this.host.openWebViewAsync(this, this.moduleId, pane, tab, profileKey);
  }

  private markTab(name: string, instance: string | undefined, tabs: Map<string, Set<object>>, show: (tabKey: string, isMarked: boolean) => void): () => void {
    const key = this.findOwnTab(name, instance).key;
    if (this.isWithdrawn)
      return WindowPartContext.ignore;
    const mark = {};
    const marks = tabs.get(key) ?? new Set<object>();
    marks.add(mark);
    if (marks.size === 1) {
      tabs.set(key, marks);
      show(key, true);
    }
    return () => {
      if (!marks.delete(mark) || marks.size > 0)
        return;
      tabs.delete(key);
      show(key, false);
    };
  }

  private findOwnTab(name: string, instance: string | undefined): Tab {
    this.requireOwn(name);
    if (this.source.viewNames.includes(name))
      return new ViewTab(name, instance);
    if (this.source.documentNames.includes(name))
      return new DocumentTab(name, instance);
    throw new ContributionNotDeclaredException(this.moduleId, name, Resources.viewOrDocumentKind);
  }

  private requireOwn(name: string): void {
    if (!name.startsWith(`${this.moduleId}${Resources.contributionSeparator}`))
      throw new ForeignContributionException(this.moduleId, name);
  }

  private requireInstance(name: string, instance: string): void {
    this.requireInstanceView(name);
    if (String.isNullOrWhitespace(instance))
      throw new ArgumentException(Resources.invalidInstance, Resources.instanceParameter);
  }

  private requireOwnDocument(name: string): void {
    this.requireOwn(name);
    if (!this.source.documentNames.includes(name))
      throw new ContributionNotDeclaredException(this.moduleId, name, Resources.documentKind);
  }

  private requireInstanceView(name: string): void {
    this.requireOwn(name);
    if (!this.knownViews.some(t => t.name === name && t.hasInstances))
      throw new ContributionNotDeclaredException(this.moduleId, name, Resources.instanceViewKind);
  }

  private requirePlainView(name: string): void {
    this.requireOwn(name);
    if (!this.knownViews.some(t => t.name === name && !t.hasInstances))
      throw new ContributionNotDeclaredException(this.moduleId, name, Resources.plainViewKind);
  }

  private requireDynamicSetting(setting: string): void {
    this.requireOwn(setting);
    if (!this.host.declaresDynamicSetting(setting))
      throw new ContributionNotDeclaredException(this.moduleId, setting, Resources.dynamicSettingKind);
  }

  private requireDeclared(name: string, declared: readonly string[], registered: readonly { readonly name: string }[], kind: string): void {
    this.requireOwn(name);
    if (!declared.includes(name))
      throw new ContributionNotDeclaredException(this.moduleId, name, kind);
    if (registered.some(t => t.name === name))
      throw new ContributionRegisteredException(this.moduleId, name, kind);
  }

  private requireReadable(name: string): void {
    if (!name.startsWith(`${Resources.shellOwner}${Resources.contributionSeparator}`))
      this.requireAllowed(name);
  }

  private requireAllowed(name: string): void {
    if (!this.isAllowed(name))
      throw new ForeignNameException(this.moduleId, name);
  }
}
