/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

import type { IPreloadBridge } from "../../src/app/interfaces/i-preload-bridge";

export class PreloadBridgeFixture implements IPreloadBridge {
  private static readonly NAME: string = "desktop";

  private readonly listeners: Set<(requestId: string) => void> = new Set();
  private readonly startupListeners: Set<(state: unknown) => void> = new Set();
  private readonly eventListeners: Set<(name: string, payload: unknown) => void> = new Set();
  private readonly menuListeners: Set<(id: string) => void> = new Set();
  private readonly openedListeners: Set<(id: string) => void> = new Set();
  private readonly quitListeners: Set<(question: unknown) => void> = new Set();
  private readonly updateListeners: Set<(state: unknown) => void> = new Set();
  private readonly fieldMenuListeners: Set<(request: unknown) => void> = new Set();
  private readonly updateSaveListeners: Set<(requestId: string) => void> = new Set();
  private readonly trayListeners: Set<(isAvailable: unknown) => void> = new Set();
  private readonly fullScreenListeners: Set<(isFullScreen: unknown) => void> = new Set();
  private readonly maximizedListeners: Set<(isMaximized: unknown) => void> = new Set();
  private readonly webViewListeners: Set<(event: unknown) => void> = new Set();
  private readonly webViewShortcutListeners: Set<(stroke: unknown) => void> = new Set();
  private webViewCount: number = 0;

  public platform: string;
  public processor: string = "x64";
  public update: unknown = { kind: "Off", version: null, progress: null, checkedAt: null, reason: null, mustMove: false };
  public readonly updateActions: string[] = [];
  public appearance: unknown = null;
  public readonly keptAppearances: JsonObject[] = [];
  public spelling: Promise<unknown> = Promise.resolve({ languages: [], fallback: null });
  public readonly keptSpellings: (readonly [boolean, readonly string[]])[] = [];
  public readonly replacements: string[] = [];
  public readonly addedWords: string[] = [];
  public readonly appearances: JsonObject[] = [];
  public readonly changes: JsonObject[] = [];
  public readonly answers: string[] = [];
  public readonly updateSaveAnswers: string[] = [];
  public readonly actions: string[] = [];
  public startup: unknown = { kind: "Ready", details: [] };
  public trayAvailable: Promise<unknown> = Promise.resolve(true);
  public fullScreen: Promise<unknown> = Promise.resolve(false);
  public maximized: Promise<unknown> = Promise.resolve(false);
  public windowAnswer: unknown = true;
  public layout: unknown = null;
  public readonly requests: [string, JsonValue][] = [];
  public answer: unknown = { payload: null };
  public readonly responses: Map<string, unknown> = new Map<string, unknown>([
    ["desktop.modules", { payload: { modules: [] } }],
    ["desktop.commands", { payload: { commands: [], sequence: 0 } }],
    ["desktop.notifications", { payload: { notifications: [], isDoNotDisturb: false, mutedModules: [], sequence: 0 } }],
    ["desktop.settings", { payload: { definitions: [], entries: [] } }],
    ["desktop.recentCommands", { payload: { ids: [] } }],
    ["desktop.programs", { payload: { programs: [], sequence: 0 } }],
    ["desktop.agentControl", { payload: { isStopped: false, isActing: false } }]
  ]);
  public build: unknown = { productVersion: "1.2.3", fingerprint: "abc123" };
  public readonly copied: string[] = [];
  public readonly copiedDetails: string[] = [];
  public isCopyAccepted: boolean = true;
  public copyFailure: unknown = null;
  public readonly copiedImages: number[][] = [];
  public isImageCopyAccepted: boolean = true;
  public imageCopyHold: Promise<void> = Promise.resolve();
  public logFolderOpens: number = 0;
  public commandInstalls: number = 0;
  public readonly quitAnswers: string[] = [];
  public readonly logged: string[] = [];
  public readonly errorsLogged: (readonly [string | null, string])[] = [];
  public logFolderOpened: Promise<boolean> = Promise.resolve(true);
  public readonly links: string[] = [];
  public isLinkOpened: boolean = true;
  public readonly shownFiles: string[] = [];
  public showRefusal: unknown = null;
  public readonly openedFiles: string[] = [];
  public openRefusal: unknown = null;
  public folder: unknown = null;
  public fileGrants: unknown = null;
  public readonly fileRequests: unknown[][] = [];
  public folderChoices: number = 0;
  public filePath: unknown = null;
  public readonly filePathChoices: JsonObject[] = [];
  public saveOutcome: unknown = "Saved";
  public readonly saves: [string, number[]][] = [];
  public readonly menuBars: JsonObject[] = [];
  public readonly edits: string[] = [];
  public readonly windowActions: string[] = [];
  public readonly webViewCalls: string[] = [];
  public readonly webViewKeys: (readonly string[])[] = [];
  public readonly appShortcuts: JsonObject[] = [];
  public isWebViewOpened: boolean = true;
  public webViewPartition: unknown = "persist:notes.workspace-1";
  public webViewAttached: Promise<unknown> = Promise.resolve({ isAttached: true });
  public webViewAnswer: unknown = { kind: "Started" };
  public webViewZoom: unknown = 1;
  public webViewFound: Promise<unknown> = Promise.resolve({ matches: 0, active: 0 });

  public constructor(platform: string) {
    this.platform = platform;
  }

  public static install(platform: string = "win32"): PreloadBridgeFixture {
    const bridge = new PreloadBridgeFixture(platform);
    vi.stubGlobal(PreloadBridgeFixture.NAME, bridge);
    return bridge;
  }

  public static installValue(value: unknown): void {
    vi.stubGlobal(PreloadBridgeFixture.NAME, value);
  }

  public static remove(): void {
    vi.unstubAllGlobals();
  }

  public get listenerCount(): number {
    return this.listeners.size + this.startupListeners.size + this.eventListeners.size + this.menuListeners.size + this.openedListeners.size + this.updateListeners.size;
  }

  public get eventListenerCount(): number {
    return this.eventListeners.size;
  }

  public get fieldMenuListenerCount(): number {
    return this.fieldMenuListeners.size;
  }

  public get maximizedListenerCount(): number {
    return this.maximizedListeners.size;
  }

  public get closeListenerCount(): number {
    return this.listeners.size;
  }

  public get updateSaveListenerCount(): number {
    return this.updateSaveListeners.size;
  }

  public notifyReady(appearance: JsonObject): void {
    this.appearances.push(appearance);
  }

  public notifyAppearance(appearance: JsonObject): void {
    this.changes.push(appearance);
  }

  public onCloseRequest(listener: (requestId: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public answerClose(requestId: string, isSaved: boolean): Promise<boolean> {
    this.answers.push(`${requestId}:${isSaved}`);
    return Promise.resolve(true);
  }

  public onUpdateSaveRequest(listener: (requestId: string) => void): () => void {
    this.updateSaveListeners.add(listener);
    return () => this.updateSaveListeners.delete(listener);
  }

  public answerUpdateSave(requestId: string, problems: readonly string[]): Promise<boolean> {
    this.updateSaveAnswers.push(`${requestId}:${problems.join("|")}`);
    return Promise.resolve(true);
  }

  public readStartup(): Promise<unknown> {
    return Promise.resolve(this.startup);
  }

  public onStartup(listener: (state: unknown) => void): () => void {
    this.startupListeners.add(listener);
    return () => this.startupListeners.delete(listener);
  }

  public actOnStartup(action: string): Promise<boolean> {
    this.actions.push(action);
    return Promise.resolve(true);
  }

  public readLayout(): Promise<unknown> {
    return Promise.resolve({ payload: this.layout });
  }

  public writeLayout(layout: JsonObject): Promise<unknown> {
    this.layout = layout;
    return Promise.resolve({ payload: null });
  }

  public request(method: string, payload: JsonValue): Promise<unknown> {
    this.requests.push([method, payload]);
    return Promise.resolve(this.responses.has(method) ? this.responses.get(method) : this.answer);
  }

  public onEvent(listener: (name: string, payload: unknown) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public readBuild(): Promise<unknown> {
    return Promise.resolve(this.build);
  }

  public copyText(text: string): Promise<boolean> {
    if (!Object.isNull(this.copyFailure))
      return Promise.reject(this.copyFailure);
    if (this.isCopyAccepted)
      this.copied.push(text);
    return Promise.resolve(this.isCopyAccepted);
  }

  public async copyImage(bytes: Uint8Array): Promise<boolean> {
    if (this.isImageCopyAccepted)
      this.copiedImages.push([...bytes]);
    await this.imageCopyHold;
    return this.isImageCopyAccepted;
  }

  public keepAppearance(preferences: JsonObject): void {
    this.keptAppearances.push(preferences);
  }

  public readSpelling(): Promise<unknown> {
    return this.spelling;
  }

  public keepSpelling(isChecking: boolean, languages: readonly string[]): void {
    this.keptSpellings.push([isChecking, languages]);
  }

  public onFieldMenu(listener: (request: unknown) => void): () => void {
    this.fieldMenuListeners.add(listener);
    return () => this.fieldMenuListeners.delete(listener);
  }

  public replaceMisspelling(text: string): Promise<boolean> {
    this.replacements.push(text);
    return Promise.resolve(true);
  }

  public addToDictionary(word: string): Promise<boolean> {
    this.addedWords.push(word);
    return Promise.resolve(true);
  }

  public publishFieldMenu(request: unknown): void {
    for (const listener of this.fieldMenuListeners)
      listener(request);
  }

  public copyDetails(text: string): Promise<boolean> {
    if (this.isCopyAccepted)
      this.copiedDetails.push(text);
    return Promise.resolve(this.isCopyAccepted);
  }

  public openLogFolder(): Promise<boolean> {
    this.logFolderOpens++;
    return this.logFolderOpened;
  }

  public openLink(url: string): Promise<boolean> {
    this.links.push(url);
    return Promise.resolve(this.isLinkOpened);
  }

  public showInFolder(path: string): Promise<unknown> {
    this.shownFiles.push(path);
    return Promise.resolve(this.showRefusal);
  }

  public openFile(path: string): Promise<unknown> {
    this.openedFiles.push(path);
    return Promise.resolve(this.openRefusal);
  }

  public saveFile(name: string, bytes: Uint8Array): Promise<unknown> {
    this.saves.push([name, [...bytes]]);
    return Promise.resolve(this.saveOutcome);
  }

  public chooseFiles(moduleId: string, options: JsonObject): Promise<unknown> {
    this.fileRequests.push(["chooseFiles", moduleId, options]);
    return Promise.resolve(this.fileGrants);
  }

  public grantFiles(moduleId: string, files: readonly File[], options: JsonObject): Promise<unknown> {
    this.fileRequests.push(["grantFiles", moduleId, files.map(t => t.name), options]);
    return Promise.resolve(this.fileGrants);
  }

  public chooseFolder(): Promise<unknown> {
    this.folderChoices++;
    return Promise.resolve(this.folder);
  }

  public chooseFilePath(options: JsonObject): Promise<unknown> {
    this.filePathChoices.push(options);
    return Promise.resolve(this.filePath);
  }

  public installCommand(): Promise<boolean> {
    this.commandInstalls++;
    return Promise.resolve(true);
  }

  public readUpdate(): Promise<unknown> {
    return Promise.resolve(this.update);
  }

  public onUpdate(listener: (state: unknown) => void): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  public actOnUpdate(action: string): Promise<boolean> {
    this.updateActions.push(action);
    return Promise.resolve(true);
  }

  public publishUpdate(state: unknown): void {
    for (const listener of this.updateListeners)
      listener(state);
  }

  public edit(action: string): Promise<boolean> {
    this.edits.push(action);
    return Promise.resolve(true);
  }

  public setMenuBar(menuBar: JsonObject): void {
    this.menuBars.push(menuBar);
  }

  public onMenuCommand(listener: (id: string) => void): () => void {
    this.menuListeners.add(listener);
    return () => this.menuListeners.delete(listener);
  }

  public chooseMenuCommand(id: string): void {
    for (const listener of this.menuListeners)
      listener(id);
  }

  public onNotificationOpened(listener: (id: string) => void): () => void {
    this.openedListeners.add(listener);
    return () => this.openedListeners.delete(listener);
  }

  public onQuitQuestion(listener: (question: unknown) => void): () => void {
    this.quitListeners.add(listener);
    return () => this.quitListeners.delete(listener);
  }

  public answerQuit(choice: string): Promise<boolean> {
    this.quitAnswers.push(choice);
    return Promise.resolve(true);
  }

  public readTrayAvailable(): Promise<unknown> {
    return this.trayAvailable;
  }

  public onTrayAvailable(listener: (isAvailable: unknown) => void): () => void {
    this.trayListeners.add(listener);
    return () => this.trayListeners.delete(listener);
  }

  public changeTrayAvailable(isAvailable: unknown): void {
    for (const listener of this.trayListeners)
      listener(isAvailable);
  }

  public readFullScreen(): Promise<unknown> {
    return this.fullScreen;
  }

  public onFullScreen(listener: (isFullScreen: unknown) => void): () => void {
    this.fullScreenListeners.add(listener);
    return () => this.fullScreenListeners.delete(listener);
  }

  public changeFullScreen(isFullScreen: unknown): void {
    for (const listener of this.fullScreenListeners)
      listener(isFullScreen);
  }

  public readMaximized(): Promise<unknown> {
    return this.maximized;
  }

  public onMaximized(listener: (isMaximized: unknown) => void): () => void {
    this.maximizedListeners.add(listener);
    return () => this.maximizedListeners.delete(listener);
  }

  public changeMaximized(isMaximized: unknown): void {
    for (const listener of this.maximizedListeners)
      listener(isMaximized);
  }

  public actOnWindow(action: string): Promise<unknown> {
    this.windowActions.push(action);
    return Promise.resolve(this.windowAnswer);
  }

  public openWebView(moduleId: string, pane: JsonObject, profileKey: string): Promise<unknown> {
    this.webViewCalls.push(`open ${moduleId} ${JSON.stringify(pane)} ${profileKey}`);
    if (!this.isWebViewOpened)
      return Promise.resolve(null);
    this.webViewCount += 1;
    return Promise.resolve({ view: { id: String(this.webViewCount), module: moduleId, pane, profileKey }, partition: this.webViewPartition });
  }

  public attachWebView(moduleId: string, view: string, contentsId: number): Promise<unknown> {
    this.webViewCalls.push(`attach ${moduleId} ${view} ${contentsId}`);
    return this.webViewAttached;
  }

  public navigateWebView(moduleId: string, view: string, url: string): Promise<unknown> {
    this.webViewCalls.push(`navigate ${moduleId} ${view} ${url}`);
    return Promise.resolve(this.webViewAnswer);
  }

  public actOnWebView(moduleId: string, view: string, action: string): Promise<unknown> {
    this.webViewCalls.push(`act ${moduleId} ${view} ${action}`);
    return Promise.resolve(this.webViewAnswer);
  }

  public zoomWebView(moduleId: string, view: string, change: string | number | null): Promise<unknown> {
    this.webViewCalls.push(`zoom ${moduleId} ${view} ${String(change)}`);
    return Promise.resolve(this.webViewZoom);
  }

  public findInWebView(moduleId: string, view: string, request: string | JsonObject): Promise<unknown> {
    this.webViewCalls.push(`find ${moduleId} ${view} ${JSON.stringify(request)}`);
    return this.webViewFound;
  }

  public closeWebView(moduleId: string, view: string): void {
    this.webViewCalls.push(`close ${moduleId} ${view}`);
  }

  public keepWebView(moduleId: string, view: string): unknown {
    this.webViewCalls.push(`keep ${moduleId} ${view}`);
    return true;
  }

  public expectWebView(moduleId: string, view: string): unknown {
    this.webViewCalls.push(`expect ${moduleId} ${view}`);
    return true;
  }

  public setWebViewShortcuts(keys: readonly string[]): void {
    this.webViewKeys.push(keys);
  }

  public setAppShortcuts(shortcuts: JsonObject): void {
    this.appShortcuts.push(shortcuts);
  }

  public onWebViewEvent(listener: (event: unknown) => void): () => void {
    this.webViewListeners.add(listener);
    return () => this.webViewListeners.delete(listener);
  }

  public publishWebViewEvent(event: unknown): void {
    for (const listener of this.webViewListeners)
      listener(event);
  }

  public onWebViewShortcut(listener: (stroke: unknown) => void): () => void {
    this.webViewShortcutListeners.add(listener);
    return () => this.webViewShortcutListeners.delete(listener);
  }

  public publishWebViewShortcut(stroke: unknown): void {
    for (const listener of this.webViewShortcutListeners)
      listener(stroke);
  }

  public logModule(moduleId: string, message: string): void {
    this.logged.push(`${moduleId}: ${message}`);
  }

  public logError(moduleId: string | null, text: string): void {
    this.errorsLogged.push([moduleId, text]);
  }

  public askToQuit(question: unknown): void {
    for (const listener of this.quitListeners)
      listener(question);
  }

  public publishNotificationOpened(id: string): void {
    for (const listener of this.openedListeners)
      listener(id);
  }

  public publishEvent(name: string, payload: unknown): void {
    for (const listener of this.eventListeners)
      listener(name, payload);
  }

  public publishStartup(state: unknown): void {
    for (const listener of this.startupListeners)
      listener(state);
  }

  public requestUpdateSave(requestId: string): void {
    for (const listener of this.updateSaveListeners)
      listener(requestId);
  }

  public requestClose(requestId: string): void {
    for (const listener of this.listeners)
      listener(requestId);
  }
}
