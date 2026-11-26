/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal, Type } from "@angular/core";

import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { AgentControlState, NotificationPost, SettingChange, SettingEntry, SettingOption, SettingScope, WebViewPane } from "@noldova/desktop.protocol";

import type { DockSide } from "../enums/dock-side.js";
import type { FileSaveOutcome } from "../enums/file-save-outcome.js";
import type { DocumentHeading } from "../models/document-heading.js";
import type { IssuedFileGrants } from "../models/issued-file-grants.js";
import type { Tab } from "../models/layout/tab.js";
import type { MenuItem } from "../models/menu-item.js";
import type { ViewBadge } from "../models/view-badge.js";
import type { ViewPlace } from "../models/view-place.js";
import type { ICommandKey } from "./i-command-key.js";
import type { IDocumentUpdate } from "./i-document-update.js";
import type { IInAppBrowser } from "./i-in-app-browser.js";
import type { ILinkOpenOptions } from "./i-link-open-options.js";
import type { IFileChoiceOptions } from "./i-file-choice-options.js";
import type { IFilePathChoiceOptions } from "./i-file-path-choice-options.js";
import type { IFileGrantOptions } from "./i-file-grant-options.js";
import type { ISelectionSource } from "./i-selection-source.js";
import type { IUndoProvider } from "./i-undo-provider.js";
import type { IWebViewHandle } from "./i-web-view-handle.js";
import type { IWindowPalette } from "./i-window-palette.js";
import type { IWindowPartContext } from "./i-window-part-context.js";

export interface IWindowPartHost {
  readonly agentControl: Signal<AgentControlState | null>;
  readonly platform: string;

  requestAsync(method: string, payload: JsonValue): Promise<JsonValue>;

  onEvent(name: string, listener: (payload: JsonValue) => void): () => void;

  openDocument(moduleId: string, name: string, instance: string, heading: DocumentHeading, isPreview: boolean, after: string | null, activate: boolean): void;

  keepDocument(moduleId: string, name: string, instance: string): void;

  closeDocument(moduleId: string, name: string, instance: string): void;

  forgetDocument(moduleId: string, name: string, instance: string): void;

  onDocumentClosed(name: string, listener: (instance: string) => void): () => void;

  onTabRenamed(name: string, listener: (instance: string, title: string) => void): () => void;

  listOpenDocumentsAsync(moduleId: string, name: string): Promise<readonly string[] | null>;

  updateDocument(moduleId: string, name: string, instance: string, title: string | null, breadcrumb: readonly string[] | null, breadcrumbIcon: string | null): void;
  openDocumentLook(moduleId: string, name: string, instance: string, change: IDocumentUpdate): void;
  updateDocumentLook(name: string, instance: string, change: IDocumentUpdate): void;

  openView(moduleId: string, name: string, instance: string, heading: DocumentHeading, icon: string | null, tabGroup: string | null, revealDock: boolean): void;

  updateView(moduleId: string, name: string, instance: string, title: string | null, icon: string | null, breadcrumb: readonly string[] | null, breadcrumbIcon: string | null): void;

  closeView(moduleId: string, name: string, instance: string): void;
  returnView(moduleId: string, name: string, instance: string): void;
  closeDialog(name: string, instance: string | null): void;

  showView(moduleId: string, name: string): void;

  hideViewDock(moduleId: string, name: string, instance: string | null): void;

  growViewDock(name: string, instance: string | null, minimum: number): () => void;

  viewDockOf(name: string, instance: string | null): Signal<DockSide | null>;

  onViewClosed(name: string, listener: (instance: string) => void): () => void;

  recordPlace(place: ViewPlace): void;

  forgetPlace(place: ViewPlace): void;

  onPlaceShown(view: string, listener: (place: string, instance: string | null) => void): () => void;

  showInDialogAsync(name: string, instance: string | null, title: string | null): Promise<void>;

  openBelowWindowRow<T>(context: IWindowPartContext, component: Type<T>): IWindowPalette<T> | null;

  log(moduleId: string, message: string): void;
  noteIcon(moduleId: string, name: string | null): void;

  openLinkAsync(url: string, options: ILinkOpenOptions): Promise<void>;

  showLinkMenu(url: string, event: MouseEvent): void;

  registerInAppBrowser(browser: IInAppBrowser, log: (message: string) => void): () => void;

  showInFolderAsync(path: string): Promise<void>;

  openFileAsync(path: string): Promise<void>;

  openWebViewAsync(context: IWindowPartContext, moduleId: string, pane: WebViewPane, tab: Tab, profileKey: string, name: string | null): Promise<IWebViewHandle>;

  chooseFolderAsync(): Promise<string | null>;

  chooseFilePathAsync(options: IFilePathChoiceOptions): Promise<string | null>;

  saveFileAsync(name: string, bytes: Uint8Array): Promise<FileSaveOutcome>;

  chooseFilesAsync(moduleId: string, options: IFileChoiceOptions): Promise<IssuedFileGrants>;

  grantFilesAsync(moduleId: string, files: readonly File[], options: IFileGrantOptions): Promise<IssuedFileGrants>;

  discardFileGrants(grants: readonly string[]): void;

  isCommandRegistered(name: string): boolean;

  findPlaceholderName(): string | null;

  declaresDynamicMenuGroup(moduleId: string, group: string): boolean;

  provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuItem[]): () => void;

  declaresDynamicSetting(setting: string): boolean;

  provideSettingOptions(setting: string, provider: (values: JsonObject) => readonly SettingOption[] | null): () => void;

  refreshSettingOptions(setting: string): void;

  declaresCheckedSetting(setting: string): boolean;

  provideSettingCheck(setting: string, check: (value: string) => string | null): () => void;

  runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue>;

  findWindowCommand(event: KeyboardEvent): string | null;

  keyOf(name: string): Signal<ICommandKey | null>;

  postNotificationAsync(post: NotificationPost): Promise<string>;

  dismissNotification(id: string): void;

  readSetting(name: string): JsonValue | undefined;

  readSettingAsync(name: string, scope: SettingScope | null): Promise<SettingEntry>;

  writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null): Promise<void>;

  resetSettingAsync(name: string, scope: SettingScope | null): Promise<void>;

  onSettingChanged(listener: (change: SettingChange) => void): () => void;

  setViewBadge(view: string, badge: ViewBadge | null): void;

  setTabWorking(tabKey: string, isWorking: boolean): void;

  setTabWaiting(tabKey: string, isWaiting: boolean): void;

  registerSelectionSource(element: HTMLElement, source: ISelectionSource): () => void;

  provideUndo(provider: IUndoProvider): () => void;

  refresh(): void;
}
