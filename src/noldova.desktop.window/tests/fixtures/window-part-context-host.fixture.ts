/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { EnvironmentInjector, type Signal, type Type, type WritableSignal, createComponent, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import type { JsonObject, JsonValue } from "@noldova/context.json";
import { type AgentControlState, type NotificationPost, QualifiedName, type SettingChange, SettingEntry, type SettingOption, type SettingScope, type WebViewPane } from "@noldova/desktop.protocol";

import type { DockSide } from "../../src/app/enums/dock-side";
import { FileSaveOutcome } from "../../src/app/enums/file-save-outcome";
import type { ISelectionSource } from "../../src/app/interfaces/i-selection-source";
import type { ICommandKey } from "../../src/app/interfaces/i-command-key";
import type { IDocumentUpdate } from "../../src/app/interfaces/i-document-update";
import type { IFileChoiceOptions } from "../../src/app/interfaces/i-file-choice-options";
import type { IFilePathChoiceOptions } from "../../src/app/interfaces/i-file-path-choice-options";
import type { IFileGrantOptions } from "../../src/app/interfaces/i-file-grant-options";
import type { IInAppBrowser } from "../../src/app/interfaces/i-in-app-browser";
import type { ILinkOpenOptions } from "../../src/app/interfaces/i-link-open-options";
import type { IWebViewHandle } from "../../src/app/interfaces/i-web-view-handle";
import type { IWindowPalette } from "../../src/app/interfaces/i-window-palette";
import type { IWindowPartContext } from "../../src/app/interfaces/i-window-part-context";
import type { IWindowPartHost } from "../../src/app/interfaces/i-window-part-host";
import type { DocumentHeading } from "../../src/app/models/document-heading";
import { IssuedFileGrant } from "../../src/app/models/issued-file-grant";
import { IssuedFileGrants } from "../../src/app/models/issued-file-grants";
import type { Tab } from "../../src/app/models/layout/tab";
import type { MenuItem } from "../../src/app/models/menu-item";
import type { ViewBadge } from "../../src/app/models/view-badge";
import { WindowPalette } from "../../src/app/models/window-palette";
import { WebViewHandleFixture } from "./web-view-handle.fixture";

export class WindowPartContextHostFixture implements IWindowPartHost {
  public readonly calls: string[] = [];
  public readonly keys: WritableSignal<ICommandKey | null> = signal(null);
  public readonly docks: WritableSignal<DockSide | null> = signal(null);
  public readonly looks: (readonly [string, IDocumentUpdate])[] = [];
  public readonly agentControl: WritableSignal<AgentControlState | null> = signal(null);
  public platform: string = "linux";
  public fileAnswer: Promise<IssuedFileGrants> | null = null;
  public readonly listeners: Set<readonly [string, (payload: JsonValue) => void]> = new Set();
  public readonly registered: Set<string> = new Set(["notes.taken"]);
  public readonly settingListeners: Set<(change: SettingChange) => void> = new Set();
  public readonly dynamicGroups: Set<string> = new Set(["notes.recent"]);
  public readonly selectionSources: Map<HTMLElement, ISelectionSource> = new Map();
  public readonly inAppBrowsers: [IInAppBrowser, (message: string) => void][] = [];
  public readonly providers: Map<string, (context: JsonObject) => readonly MenuItem[]> = new Map();
  public readonly webViews: WebViewHandleFixture[] = [];
  public readonly dynamicSettings: Set<string> = new Set(["notes.model"]);
  public readonly optionProviders: Map<string, (values: JsonObject) => readonly SettingOption[] | null> = new Map();
  public readonly checkedSettings: Set<string> = new Set(["notes.sites"]);
  public readonly checks: Map<string, (value: string) => string | null> = new Map();
  public readonly viewListeners: Set<readonly [string, (instance: string) => void]> = new Set();
  public readonly documentListeners: Set<readonly [string, (instance: string) => void]> = new Set();
  public readonly renameListeners: Set<readonly [string, (instance: string, title: string) => void]> = new Set();
  public openDocuments: readonly string[] = [];
  public readonly paletteContexts: IWindowPartContext[] = [];
  public isPaletteRefused: boolean = false;
  public placeholderName: string | null = null;

  public requestAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    this.calls.push(`request ${method}`);
    return Promise.resolve({ method, payload });
  }

  public onEvent(name: string, listener: (payload: JsonValue) => void): () => void {
    const entry = [name, listener] as const;
    this.listeners.add(entry);
    return () => this.listeners.delete(entry);
  }

  public openDocument(moduleId: string, name: string, instance: string, heading: DocumentHeading, isPreview: boolean, after: string | null, activate: boolean): void {
    this.calls.push(`open ${moduleId} ${name} ${instance} ${heading.text}${Object.isNull(heading.icon) ? String.empty : ` ${heading.icon}`}${isPreview ? " as a preview" : String.empty}${Object.isNull(after) ? String.empty : ` after ${after}`}${activate ? String.empty : " inactive"}`);
  }

  public keepDocument(moduleId: string, name: string, instance: string): void {
    this.calls.push(`keep ${moduleId} ${name} ${instance}`);
  }

  public closeDocument(moduleId: string, name: string, instance: string): void {
    this.calls.push(`close ${moduleId} ${name} ${instance}`);
  }

  public forgetDocument(moduleId: string, name: string, instance: string): void {
    this.calls.push(`forget ${moduleId} ${name} ${instance}`);
  }

  public onDocumentClosed(name: string, listener: (instance: string) => void): () => void {
    const entry = [name, listener] as const;
    this.documentListeners.add(entry);
    return () => this.documentListeners.delete(entry);
  }

  public onTabRenamed(name: string, listener: (instance: string, title: string) => void): () => void {
    const entry = [name, listener] as const;
    this.renameListeners.add(entry);
    return () => this.renameListeners.delete(entry);
  }

  public listOpenDocumentsAsync(moduleId: string, name: string): Promise<readonly string[] | null> {
    this.calls.push(`list ${moduleId} ${name}`);
    return Promise.resolve(this.openDocuments);
  }

  public updateDocument(moduleId: string, name: string, instance: string, title: string | null, breadcrumb: readonly string[] | null, breadcrumbIcon: string | null = null): void {
    this.calls.push(`update ${moduleId} ${name} ${instance} ${title ?? "-"} ${Object.isNull(breadcrumb) ? "-" : `[${breadcrumb.join(", ")}]`}${Object.isNull(breadcrumbIcon) ? String.empty : ` ${breadcrumbIcon}`}`);
  }

  public openDocumentLook(moduleId: string, name: string, instance: string, change: IDocumentUpdate): void {
    this.looks.push([`open ${moduleId} ${name} ${instance}`, change]);
  }

  public updateDocumentLook(name: string, instance: string, change: IDocumentUpdate): void {
    this.looks.push([`update ${name} ${instance}`, change]);
  }

  public openView(moduleId: string, name: string, instance: string, heading: DocumentHeading, icon: string | null, tabGroup: string | null): void {
    this.calls.push(`openView ${moduleId} ${name} ${instance} ${heading.text}${Object.isNull(heading.icon) ? String.empty : ` ${heading.icon}`} ${icon ?? "-"} ${tabGroup ?? "-"}`);
  }

  public updateView(moduleId: string, name: string, instance: string, title: string | null, icon: string | null, breadcrumb: readonly string[] | null, breadcrumbIcon: string | null = null): void {
    this.calls.push(`updateView ${moduleId} ${name} ${instance} ${title ?? "-"} ${icon ?? "-"} ${Object.isNull(breadcrumb) ? "-" : `[${breadcrumb.join(", ")}]`}${Object.isNull(breadcrumbIcon) ? String.empty : ` ${breadcrumbIcon}`}`);
  }

  public closeView(moduleId: string, name: string, instance: string): void {
    this.calls.push(`closeView ${moduleId} ${name} ${instance}`);
  }

  public showView(moduleId: string, name: string): void {
    this.calls.push(`showView ${moduleId} ${name}`);
  }

  public hideViewDock(moduleId: string, name: string, instance: string | null): void {
    this.calls.push(`hideViewDock ${moduleId} ${name} ${instance ?? "-"}`);
  }

  public growViewDock(name: string, instance: string | null, minimum: number): () => void {
    this.calls.push(`growViewDock ${name} ${instance ?? "-"} ${minimum}`);
    return () => this.calls.push(`releaseViewDock ${name} ${instance ?? "-"}`);
  }

  public viewDockOf(name: string, instance: string | null): Signal<DockSide | null> {
    this.calls.push(`viewDockOf ${name} ${instance ?? "-"}`);
    return this.docks;
  }

  public onViewClosed(name: string, listener: (instance: string) => void): () => void {
    const entry = [name, listener] as const;
    this.viewListeners.add(entry);
    return () => this.viewListeners.delete(entry);
  }

  public log(moduleId: string, message: string): void {
    this.calls.push(`log ${moduleId} ${message}`);
  }

  public openLinkAsync(url: string, options: ILinkOpenOptions): Promise<void> {
    this.calls.push(`openLink ${url} ${JSON.stringify(options)}`);
    return Promise.resolve();
  }

  public showLinkMenu(url: string, event: MouseEvent): void {
    this.calls.push(`linkMenu ${url} ${event.type}`);
  }

  public registerInAppBrowser(browser: IInAppBrowser, log: (message: string) => void): () => void {
    this.inAppBrowsers.push([browser, log]);
    return () => this.calls.push("unregisterInAppBrowser");
  }

  public showInFolderAsync(path: string): Promise<void> {
    this.calls.push(`showInFolder ${path}`);
    return Promise.resolve();
  }

  public openFileAsync(path: string): Promise<void> {
    this.calls.push(`openFile ${path}`);
    return Promise.resolve();
  }

  public openWebViewAsync(_context: IWindowPartContext, moduleId: string, pane: WebViewPane, tab: Tab, profileKey: string): Promise<IWebViewHandle> {
    this.calls.push(`openWebView ${moduleId} ${tab.key} ${profileKey}`);
    const handle = new WebViewHandleFixture(String(this.webViews.length + 1), pane, profileKey);
    this.webViews.push(handle);
    return Promise.resolve(handle);
  }

  public saveFileAsync(name: string, bytes: Uint8Array): Promise<FileSaveOutcome> {
    this.calls.push(`saveFile ${name} ${bytes.length}`);
    return Promise.resolve(FileSaveOutcome.Saved);
  }

  public chooseFolderAsync(): Promise<string | null> {
    this.calls.push("chooseFolder");
    return Promise.resolve("/home/person/notes");
  }

  public chooseFilePathAsync(options: IFilePathChoiceOptions): Promise<string | null> {
    this.calls.push(`chooseFilePath ${JSON.stringify(options)}`);
    return Promise.resolve("/opt/tools/agent");
  }

  public chooseFilesAsync(moduleId: string, options: IFileChoiceOptions): Promise<IssuedFileGrants> {
    this.calls.push(`chooseFiles ${moduleId} ${JSON.stringify(options)}`);
    return this.fileAnswer ?? Promise.resolve(new IssuedFileGrants([new IssuedFileGrant("a".repeat(32), "report.pdf", "application/pdf", 1204)], []));
  }

  public grantFilesAsync(moduleId: string, files: readonly File[], options: IFileGrantOptions): Promise<IssuedFileGrants> {
    this.calls.push(`grantFiles ${moduleId} ${files.map(t => t.name).join(",")} ${JSON.stringify(options)}`);
    return Promise.resolve(new IssuedFileGrants(files.map((t, index) => new IssuedFileGrant(String(index + 1).repeat(32), t.name, t.type, t.size)), []));
  }

  public discardFileGrants(grants: readonly string[]): void {
    this.calls.push(`discardFileGrants ${grants.map(t => t[0]).join(",")}`);
  }

  public showInDialogAsync(name: string, instance: string | null, title: string | null): Promise<void> {
    this.calls.push(`show ${name} ${instance ?? "-"} ${title ?? "-"}`);
    return Promise.resolve();
  }

  public openBelowWindowRow<T>(context: IWindowPartContext, component: Type<T>): IWindowPalette<T> | null {
    const index = this.paletteContexts.push(context);
    this.calls.push(`palette ${index}`);
    if (this.isPaletteRefused)
      return null;
    let resolveClosed: () => void = () => undefined;
    const closed = new Promise<void>(resolve => {
      resolveClosed = resolve;
    });
    const componentRef = createComponent(component, { environmentInjector: TestBed.inject(EnvironmentInjector) });
    return new WindowPalette(componentRef, closed, () => {
      this.calls.push(`close palette ${index}`);
      resolveClosed();
    }, () => true);
  }

  public isCommandRegistered(name: string): boolean {
    return this.registered.has(name);
  }

  public findPlaceholderName(): string | null {
    return this.placeholderName;
  }

  public declaresDynamicMenuGroup(moduleId: string, group: string): boolean {
    return moduleId === "notes" && this.dynamicGroups.has(group);
  }

  public provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuItem[]): () => void {
    this.providers.set(group, provider);
    return () => this.providers.delete(group);
  }

  public declaresDynamicSetting(setting: string): boolean {
    return this.dynamicSettings.has(setting);
  }

  public provideSettingOptions(setting: string, provider: (values: JsonObject) => readonly SettingOption[] | null): () => void {
    this.optionProviders.set(setting, provider);
    return () => this.optionProviders.delete(setting);
  }

  public refreshSettingOptions(setting: string): void {
    this.calls.push(`refresh ${setting}`);
  }

  public declaresCheckedSetting(setting: string): boolean {
    return this.checkedSettings.has(setting);
  }

  public provideSettingCheck(setting: string, check: (value: string) => string | null): () => void {
    this.checks.set(setting, check);
    return () => this.checks.delete(setting);
  }

  public runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue> {
    this.calls.push(`run ${name}`);
    return Promise.resolve({ name, commandArguments });
  }

  public findWindowCommand(event: KeyboardEvent): string | null {
    this.calls.push(`findWindowCommand ${event.key}`);
    return event.key === "k" ? "notes.find" : null;
  }

  public keyOf(name: string): Signal<ICommandKey | null> {
    this.calls.push(`keyOf ${name}`);
    return this.keys;
  }

  public postNotificationAsync(post: NotificationPost): Promise<string> {
    this.calls.push(`post ${post.title}`);
    return Promise.resolve(String(this.calls.length));
  }

  public dismissNotification(id: string): void {
    this.calls.push(`dismiss ${id}`);
  }

  public readSetting(name: string): JsonValue | undefined {
    return name === "notes.missing" ? undefined : `${name} value`;
  }

  public readSettingAsync(name: string, scope: SettingScope | null): Promise<SettingEntry> {
    this.calls.push(`read ${name} ${scope?.id ?? "app"}`);
    return Promise.resolve(new SettingEntry(QualifiedName.parse(name), `${name} at ${scope?.id ?? "app"}`, !Object.isNull(scope)));
  }

  public writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null): Promise<void> {
    this.calls.push(`write ${name} ${JSON.stringify(value)} ${scope?.id ?? "app"}`);
    return Promise.resolve();
  }

  public resetSettingAsync(name: string, scope: SettingScope | null): Promise<void> {
    this.calls.push(`reset ${name} ${scope?.id ?? "app"}`);
    return Promise.resolve();
  }

  public onSettingChanged(listener: (change: SettingChange) => void): () => void {
    this.settingListeners.add(listener);
    return () => this.settingListeners.delete(listener);
  }

  public changeSetting(change: SettingChange): void {
    for (const listener of this.settingListeners)
      listener(change);
  }

  public setViewBadge(view: string, badge: ViewBadge | null): void {
    this.calls.push(`badge ${view} ${badge?.count ?? "dot"} ${badge?.description ?? "none"}`);
  }

  public setTabWorking(tabKey: string, isWorking: boolean): void {
    this.calls.push(`working ${tabKey} ${isWorking}`);
  }

  public setTabWaiting(tabKey: string, isWaiting: boolean): void {
    this.calls.push(`waiting ${tabKey} ${isWaiting}`);
  }

  public registerSelectionSource(element: HTMLElement, source: ISelectionSource): () => void {
    this.selectionSources.set(element, source);
    return () => this.selectionSources.delete(element);
  }

  public refresh(): void {
    this.calls.push("refresh");
  }

  public publish(name: string, payload: JsonValue): void {
    for (const [event, listener] of this.listeners)
      if (event === name)
        listener(payload);
  }
}
