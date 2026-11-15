/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

export interface IPreloadBridge {
  readonly platform: string;
  readonly processor: string;
  readonly appearance: unknown;

  notifyReady(appearance: JsonObject): void;
  notifyAppearance(appearance: JsonObject): void;
  onCloseRequest(listener: (requestId: string) => void): () => void;
  answerClose(requestId: string, isSaved: boolean): Promise<boolean>;
  onUpdateSaveRequest(listener: (requestId: string) => void): () => void;
  answerUpdateSave(requestId: string, problems: readonly string[]): Promise<boolean>;
  readStartup(): Promise<unknown>;
  onStartup(listener: (state: unknown) => void): () => void;
  actOnStartup(action: string): Promise<boolean>;
  readLayout(): Promise<unknown>;
  writeLayout(layout: JsonObject): Promise<unknown>;
  request(method: string, payload: JsonValue): Promise<unknown>;
  onEvent(listener: (name: string, payload: unknown) => void): () => void;
  readBuild(): Promise<unknown>;
  copyText(text: string): Promise<boolean>;
  copyImage(bytes: Uint8Array): Promise<boolean>;
  openLogFolder(): Promise<boolean>;
  copyDetails(text: string): Promise<boolean>;
  openLink(url: string): Promise<boolean>;
  showInFolder(path: string): Promise<unknown>;
  openFile(path: string): Promise<unknown>;
  chooseFolder(): Promise<unknown>;
  chooseFilePath(options: JsonObject): Promise<unknown>;
  saveFile(name: string, bytes: Uint8Array): Promise<unknown>;
  chooseFiles(moduleId: string, options: JsonObject): Promise<unknown>;
  grantFiles(moduleId: string, files: readonly File[], options: JsonObject): Promise<unknown>;
  installCommand(): Promise<boolean>;
  readUpdate(): Promise<unknown>;
  onUpdate(listener: (state: unknown) => void): () => void;
  actOnUpdate(action: string): Promise<boolean>;
  keepAppearance(preferences: JsonObject): void;
  readSpelling(): Promise<unknown>;
  keepSpelling(isChecking: boolean, languages: readonly string[]): void;
  onFieldMenu(listener: (request: unknown) => void): () => void;
  replaceMisspelling(text: string): Promise<boolean>;
  addToDictionary(word: string): Promise<boolean>;
  edit(action: string): Promise<boolean>;
  setMenuBar(menuBar: JsonObject): void;
  onMenuCommand(listener: (id: string) => void): () => void;
  onNotificationOpened(listener: (id: string) => void): () => void;
  onQuitQuestion(listener: (question: unknown) => void): () => void;
  answerQuit(choice: string): Promise<boolean>;
  readTrayAvailable(): Promise<unknown>;
  onTrayAvailable(listener: (isAvailable: unknown) => void): () => void;
  readFullScreen(): Promise<unknown>;
  onFullScreen(listener: (isFullScreen: unknown) => void): () => void;
  readMaximized(): Promise<unknown>;
  onMaximized(listener: (isMaximized: unknown) => void): () => void;
  actOnWindow(action: string): Promise<unknown>;
  openWebView(moduleId: string, pane: JsonObject, profileKey: string): Promise<unknown>;
  attachWebView(moduleId: string, view: string, contentsId: number): Promise<unknown>;
  navigateWebView(moduleId: string, view: string, url: string): Promise<unknown>;
  actOnWebView(moduleId: string, view: string, action: string): Promise<unknown>;
  zoomWebView(moduleId: string, view: string, change: string | number | null): Promise<unknown>;
  findInWebView(moduleId: string, view: string, request: string | JsonObject): Promise<unknown>;
  closeWebView(moduleId: string, view: string): void;
  keepWebView(moduleId: string, view: string): unknown;
  expectWebView(moduleId: string, view: string): unknown;
  setWebViewShortcuts(keys: readonly string[]): void;
  setAppShortcuts(shortcuts: JsonObject): void;
  onWebViewEvent(listener: (event: unknown) => void): () => void;
  onWebViewShortcut(listener: (stroke: unknown) => void): () => void;
  logModule(moduleId: string, message: string): void;
  logError(moduleId: string | null, text: string): void;
}
