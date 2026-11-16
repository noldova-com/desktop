/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal, Type } from "@angular/core";

import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { AgentControlState, NotificationPost, SettingEntry, SettingOption, SettingScope } from "@noldova/desktop.protocol";

import type { DockSide } from "../enums/dock-side.js";
import type { FileSaveOutcome } from "../enums/file-save-outcome.js";
import type { CommandContribution } from "../models/command-contribution.js";
import type { DocumentContribution } from "../models/document-contribution.js";
import type { IssuedFileGrants } from "../models/issued-file-grants.js";
import type { MenuRowContribution } from "../models/menu-row-contribution.js";
import type { NotificationHandle } from "../models/notification-handle.js";
import type { PlaceholderContribution } from "../models/placeholder-contribution.js";
import type { SearchSourceContribution } from "../models/search-source-contribution.js";
import type { SettingsPageContribution } from "../models/settings-page-contribution.js";
import type { SettingsRow } from "../models/settings/settings-row.js";
import type { StatusBarItem } from "../models/status-bar-item.js";
import type { StatusBarItemContribution } from "../models/status-bar-item-contribution.js";
import type { TopBarAction } from "../models/top-bar-action.js";
import type { TopBarActionContribution } from "../models/top-bar-action-contribution.js";
import type { ViewBadge } from "../models/view-badge.js";
import type { ViewContribution } from "../models/view-contribution.js";
import type { ICommandKey } from "./i-command-key.js";
import type { IDocumentOptions } from "./i-document-options.js";
import type { IDocumentUpdate } from "./i-document-update.js";
import type { IFileChoiceOptions } from "./i-file-choice-options.js";
import type { IFilePathChoiceOptions } from "./i-file-path-choice-options.js";
import type { IFileGrantOptions } from "./i-file-grant-options.js";
import type { IInAppBrowser } from "./i-in-app-browser.js";
import type { ILinkOpenOptions } from "./i-link-open-options.js";
import type { ISelectionSource } from "./i-selection-source.js";
import type { IViewDialogOptions } from "./i-view-dialog-options.js";
import type { IViewInstanceOptions } from "./i-view-instance-options.js";
import type { IViewUpdate } from "./i-view-update.js";
import type { IWindowPalette } from "./i-window-palette.js";
import type { IWindowSecrets } from "./i-window-secrets.js";
import type { IWindowWebViews } from "./i-window-web-views.js";

export interface IWindowPartContext {
  readonly webViews: IWindowWebViews;
  readonly secrets: IWindowSecrets;
  readonly agentControl: Signal<AgentControlState | null>;

  registerView(view: ViewContribution): void;
  registerDocument(document: DocumentContribution): void;

  registerPlaceholder(placeholder: PlaceholderContribution): void;
  registerSettingsPage(page: SettingsPageContribution): void;
  setSettingsRows(page: string, rows: readonly SettingsRow[]): void;
  registerCommand(command: CommandContribution): void;
  registerSearchSource(source: SearchSourceContribution): void;
  registerStatusBarItem(item: StatusBarItemContribution): StatusBarItem;
  registerTopBarAction(action: TopBarActionContribution): TopBarAction;
  registerSave(save: () => Promise<void>): () => void;
  registerSelectionSource(element: HTMLElement, source: ISelectionSource): () => void;
  provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuRowContribution[]): () => void;
  provideSettingOptions(setting: string, provider: (values: JsonObject) => readonly SettingOption[] | null): () => void;
  refreshSettingOptions(setting: string): void;
  provideSettingCheck(setting: string, check: (value: string) => string | null): () => void;
  setViewBadge(view: string, badge: ViewBadge | null): void;
  markWorking(name: string, instance?: string): () => void;
  markWaiting(name: string, instance?: string): () => void;
  isAllowed(name: string): boolean;
  runCommandAsync(name: string, commandArguments?: JsonValue): Promise<JsonValue>;
  findWindowCommand(event: KeyboardEvent): string | null;
  keyOf(command: string): Signal<ICommandKey | null>;
  postNotificationAsync(post: NotificationPost): Promise<NotificationHandle>;
  openDocument(name: string, instance: string, title: string, options?: IDocumentOptions): void;
  keepDocument(name: string, instance: string): void;
  closeDocument(name: string, instance: string): void;
  forgetDocument(name: string, instance: string): void;
  updateDocument(name: string, instance: string, update: IDocumentUpdate): void;
  onDocumentClosed(name: string, listener: (instance: string) => void): () => void;
  onTabRenamed(name: string, listener: (instance: string, title: string) => void): () => void;
  listOpenDocumentsAsync(name: string): Promise<readonly string[] | null>;
  openView(name: string, instance: string, title: string, options?: IViewInstanceOptions): void;
  updateView(name: string, instance: string, update: IViewUpdate): void;
  closeView(name: string, instance: string): void;
  closeDialog(name: string, instance?: string): void;
  showView(name: string): void;
  hideViewDock(name: string, instance?: string): void;
  growViewDock(name: string, minimum: number, instance?: string): () => void;
  viewDockOf(name: string, instance?: string): Signal<DockSide | null>;
  onViewClosed(name: string, listener: (instance: string) => void): () => void;
  showInDialogAsync(name: string, options?: IViewDialogOptions): Promise<void>;
  openBelowWindowRowAsync<T>(load: () => Promise<Type<T>>): Promise<IWindowPalette<T> | null>;
  log(message: string): void;
  openLinkAsync(url: string, options?: ILinkOpenOptions): Promise<void>;
  showLinkMenu(url: string, event: MouseEvent): void;
  registerInAppBrowser(browser: IInAppBrowser): () => void;
  showInFolderAsync(path: string): Promise<void>;
  openFileAsync(path: string): Promise<void>;
  chooseFolderAsync(): Promise<string | null>;
  chooseFilePathAsync(options?: IFilePathChoiceOptions): Promise<string | null>;
  saveFileAsync(name: string, bytes: Uint8Array): Promise<FileSaveOutcome>;
  chooseFilesAsync(options?: IFileChoiceOptions): Promise<IssuedFileGrants>;
  grantFilesAsync(files: readonly File[], options?: IFileGrantOptions): Promise<IssuedFileGrants>;
  discardFileGrants(grants: readonly string[]): void;
  fileAddressOf(grant: string): string;
  requestAsync(method: string, parameters: JsonValue): Promise<JsonValue>;
  onEvent(event: string, listener: (payload: JsonValue) => void): () => void;
  readSetting(name: string): JsonValue | undefined;
  readSettingAsync(name: string, scope?: SettingScope | null): Promise<SettingEntry>;
  writeSettingAsync(name: string, value: JsonValue, scope?: SettingScope | null): Promise<void>;
  resetSettingAsync(name: string, scope?: SettingScope | null): Promise<void>;
  onSettingChanged(name: string, listener: (value: JsonValue, scope: SettingScope | null, isSet: boolean) => void): () => void;

  isDependencyActive(moduleId: string): boolean;
  onDependencyChanged(listener: (moduleId: string, isActive: boolean) => void): () => void;
}
