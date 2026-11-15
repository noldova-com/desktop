/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable } from "@angular/core";

import { ClipboardWriter } from "@noldova/ui.components.angular";
import { nameof } from "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { AppShortcut, AppShortcutList, type EditAction, FailureCode, FileGrantsDiscard, type IKeyStroke, type KeyChord, ShellMethods, type WebViewAction, WebViewEvent, WebViewInfo, WebViewNavigation, type WebViewPane, type WindowAction } from "@noldova/desktop.protocol";

import { FileSaveOutcome } from "../enums/file-save-outcome.js";
import type { QuitChoice } from "../enums/quit-choice.js";
import type { UpdateAction } from "../enums/update-action.js";
import { WebViewInputKind } from "../enums/web-view-input-kind.js";
import { PreloadBridgeException } from "../exceptions/preload-bridge.exception.js";
import { RuntimeDisconnectedException } from "../exceptions/runtime-disconnected.exception.js";
import { RuntimeRequestException } from "../exceptions/runtime-request.exception.js";
import type { IFileChoiceOptions } from "../interfaces/i-file-choice-options.js";
import type { IFilePathChoiceOptions } from "../interfaces/i-file-path-choice-options.js";
import type { IFileGrantOptions } from "../interfaces/i-file-grant-options.js";
import type { IOpenedWebView } from "../interfaces/i-opened-web-view.js";
import type { IPreloadBridge } from "../interfaces/i-preload-bridge.js";
import type { IWebViewFound } from "../interfaces/i-web-view-found.js";
import type { IWebViewInput } from "../interfaces/i-web-view-input.js";
import { BuildInfo } from "../models/build-info.js";
import { ClipboardImage } from "../models/clipboard-image.js";
import { FieldMenuRequest } from "../models/field-menu-request.js";
import type { IssuedFileGrants } from "../models/issued-file-grants.js";
import { QuitQuestion } from "../models/quit-question.js";
import { SpellingOffer } from "../models/spelling-offer.js";
import { StartupState } from "../models/startup-state.js";
import { UpdateState } from "../models/update-state.js";
import type { WindowAppearance } from "../models/window-appearance.js";
import { Resources } from "../../resources.js";
import { IssuedFileGrantsReader } from "./issued-file-grants.reader.js";

@Injectable({ providedIn: "root" })
export class PreloadBridgeService extends ClipboardWriter {
  private readonly bridge: IPreloadBridge = PreloadBridgeService.find();
  private readonly eventListeners: Set<(name: string, payload: JsonValue) => void> = new Set();
  private readonly namedEventListeners: Map<string, Set<(payload: JsonValue) => void>> = new Map();
  private stopEvents: (() => void) | null = null;
  private isCopyingImage: boolean = false;

  public get platform(): string {
    return this.bridge.platform;
  }

  public get processor(): string {
    return this.bridge.processor;
  }

  public get initialAppearance(): unknown {
    return this.bridge.appearance;
  }

  public get isMac(): boolean {
    return this.bridge.platform === Resources.macPlatform;
  }

  public notifyReady(appearance: WindowAppearance): void {
    this.bridge.notifyReady(appearance.toJson());
  }

  public notifyAppearance(appearance: WindowAppearance): void {
    this.bridge.notifyAppearance(appearance.toJson());
  }

  public onCloseRequest(listener: (requestId: string) => void): () => void {
    return this.bridge.onCloseRequest(listener);
  }

  public answerCloseAsync(requestId: string, isSaved: boolean): Promise<boolean> {
    return this.bridge.answerClose(requestId, isSaved);
  }

  public onUpdateSaveRequest(listener: (requestId: string) => void): () => void {
    return this.bridge.onUpdateSaveRequest(listener);
  }

  public answerUpdateSaveAsync(requestId: string, problems: readonly string[]): Promise<boolean> {
    return this.bridge.answerUpdateSave(requestId, problems);
  }

  public async readStartupAsync(): Promise<StartupState> {
    return StartupState.fromJson(await this.bridge.readStartup());
  }

  public onStartup(listener: (state: StartupState) => void): () => void {
    return this.bridge.onStartup(t => listener(StartupState.fromJson(t)));
  }

  public actOnStartupAsync(action: string): Promise<boolean> {
    return this.bridge.actOnStartup(action);
  }

  public async readLayoutAsync(): Promise<JsonObject | null> {
    const layout = PreloadBridgeService.readAnswer(await this.bridge.readLayout());
    return Object.isNull(layout) ? null : JsonReader.fromValue(layout).toJson();
  }

  public async writeLayoutAsync(layout: JsonObject): Promise<void> {
    PreloadBridgeService.readAnswer(await this.bridge.writeLayout(layout));
  }

  public async requestAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    return PreloadBridgeService.readAnswer(await this.bridge.request(method, payload));
  }

  public onEvent(listener: (name: string, payload: JsonValue) => void): () => void {
    const entry = (name: string, payload: JsonValue): void => listener(name, payload);
    this.eventListeners.add(entry);
    this.listenToEvents();
    return () => this.stopListening(() => this.eventListeners.delete(entry));
  }

  public onNamedEvent(name: string, listener: (payload: JsonValue) => void): () => void {
    const entry = (payload: JsonValue): void => listener(payload);
    const listeners = this.namedEventListeners.get(name) ?? new Set<(payload: JsonValue) => void>();
    this.namedEventListeners.set(name, listeners.add(entry));
    this.listenToEvents();
    return () => this.stopListening(() => {
      listeners.delete(entry);
      if (listeners.size === 0 && this.namedEventListeners.get(name) === listeners)
        this.namedEventListeners.delete(name);
    });
  }

  public editAsync(action: EditAction): Promise<boolean> {
    return this.bridge.edit(action);
  }

  public setMenuBar(menuBar: JsonObject): void {
    this.bridge.setMenuBar(menuBar);
  }

  public onMenuCommand(listener: (id: string) => void): () => void {
    return this.bridge.onMenuCommand(listener);
  }


  public async readBuildAsync(): Promise<BuildInfo> {
    return BuildInfo.fromJson(await this.bridge.readBuild());
  }

  public writeTextAsync(text: string): Promise<boolean> {
    return this.bridge.copyText(text);
  }

  public override async writeImageAsync(bytes: Uint8Array): Promise<boolean> {
    if (this.isCopyingImage)
      return false;
    this.isCopyingImage = true;
    try {
      const image = await ClipboardImage.readAsync(bytes);
      return !Object.isNull(image) && await this.bridge.copyImage(image);
    }
    finally {
      this.isCopyingImage = false;
    }
  }

  public openLogFolderAsync(): Promise<boolean> {
    return this.bridge.openLogFolder();
  }

  public copyDetailsAsync(text: string): Promise<boolean> {
    return this.bridge.copyDetails(text);
  }

  public openLinkAsync(url: string): Promise<boolean> {
    return this.bridge.openLink(url);
  }

  public async showInFolderAsync(path: string): Promise<string | null> {
    const refusal = await this.bridge.showInFolder(path);
    return Object.isNull(refusal) || Object.isString(refusal) ? refusal : Resources.fileNotShownWithoutReason;
  }

  public async openFileAsync(path: string): Promise<string | null> {
    const refusal = await this.bridge.openFile(path);
    return Object.isNull(refusal) || Object.isString(refusal) ? refusal : Resources.fileNotShownWithoutReason;
  }

  public async chooseFolderAsync(): Promise<string | null> {
    const folder = await this.bridge.chooseFolder();
    return Object.isString(folder) ? folder : null;
  }

  public async chooseFilePathAsync(options: IFilePathChoiceOptions): Promise<string | null> {
    const path = await this.bridge.chooseFilePath({
      ...Object.isUndefined(options.extensions) ? {} : { [Resources.extensionsField]: [...options.extensions] },
      ...Object.isUndefined(options.folder) ? {} : { [Resources.folderField]: options.folder }
    });
    return Object.isString(path) ? path : null;
  }

  public async saveFileAsync(name: string, bytes: Uint8Array): Promise<FileSaveOutcome> {
    const outcome = await this.bridge.saveFile(name, bytes);
    return Object.values(FileSaveOutcome).find(t => t === outcome) ?? FileSaveOutcome.Failed;
  }

  public async chooseFilesAsync(moduleId: string, options: IFileChoiceOptions): Promise<IssuedFileGrants> {
    return IssuedFileGrantsReader.read(await this.bridge.chooseFiles(moduleId, PreloadBridgeService.grantOptions(options, options.multiple)));
  }

  public async grantFilesAsync(moduleId: string, files: readonly File[], options: IFileGrantOptions): Promise<IssuedFileGrants> {
    return IssuedFileGrantsReader.read(await this.bridge.grantFiles(moduleId, files, PreloadBridgeService.grantOptions(options, undefined)));
  }

  public async discardFileGrantsAsync(grants: readonly string[]): Promise<void> {
    for (let start = 0; start < grants.length; start += FileGrantsDiscard.maximumGrants)
      await this.requestAsync(ShellMethods.discardFileGrants.text, new FileGrantsDiscard(grants.slice(start, start + FileGrantsDiscard.maximumGrants)).toJson());
  }

  public installCommandAsync(): Promise<boolean> {
    return this.bridge.installCommand();
  }

  public async readUpdateAsync(): Promise<UpdateState> {
    return UpdateState.fromJson(await this.bridge.readUpdate());
  }

  public onUpdate(listener: (state: UpdateState) => void): () => void {
    return this.bridge.onUpdate(t => listener(UpdateState.fromJson(t)));
  }

  public actOnUpdateAsync(action: UpdateAction): Promise<boolean> {
    return this.bridge.actOnUpdate(action);
  }

  public keepAppearance(preferences: JsonObject): void {
    this.bridge.keepAppearance(preferences);
  }

  public async readSpellingAsync(): Promise<SpellingOffer> {
    return SpellingOffer.fromJson(await this.bridge.readSpelling());
  }

  public keepSpelling(isChecking: boolean, languages: readonly string[]): void {
    this.bridge.keepSpelling(isChecking, languages);
  }

  public onFieldMenu(listener: (request: FieldMenuRequest) => void): () => void {
    return this.bridge.onFieldMenu(t => listener(FieldMenuRequest.fromJson(t)));
  }

  public replaceMisspellingAsync(text: string): Promise<boolean> {
    return this.bridge.replaceMisspelling(text);
  }

  public addToDictionaryAsync(word: string): Promise<boolean> {
    return this.bridge.addToDictionary(word);
  }

  public onNotificationOpened(listener: (id: string) => void): () => void {
    return this.bridge.onNotificationOpened(t => {
      if (Object.isString(t) && !String.isNullOrWhitespace(t))
        listener(t);
    });
  }

  public onQuitQuestion(listener: (question: QuitQuestion | null) => void): () => void {
    return this.bridge.onQuitQuestion(t => listener(Object.isNull(t) ? null : QuitQuestion.fromJson(t)));
  }

  public answerQuitAsync(choice: QuitChoice): Promise<boolean> {
    return this.bridge.answerQuit(choice);
  }

  public async readTrayAvailableAsync(): Promise<boolean> {
    return await this.bridge.readTrayAvailable() !== false;
  }

  public onTrayAvailable(listener: (isAvailable: boolean) => void): () => void {
    return this.bridge.onTrayAvailable(t => {
      if (Object.isBoolean(t))
        listener(t);
    });
  }

  public async readFullScreenAsync(): Promise<boolean> {
    return await this.bridge.readFullScreen() === true;
  }

  public onFullScreen(listener: (isFullScreen: boolean) => void): () => void {
    return this.bridge.onFullScreen(t => {
      if (Object.isBoolean(t))
        listener(t);
    });
  }

  public async readMaximizedAsync(): Promise<boolean> {
    return await this.bridge.readMaximized() === true;
  }

  public onMaximized(listener: (isMaximized: boolean) => void): () => void {
    return this.bridge.onMaximized(t => {
      if (Object.isBoolean(t))
        listener(t);
    });
  }

  public async actOnWindowAsync(action: WindowAction): Promise<boolean> {
    return await this.bridge.actOnWindow(action) === true;
  }

  public async openWebViewAsync(moduleId: string, pane: WebViewPane, profileKey: string): Promise<IOpenedWebView | null> {
    const answer = await this.bridge.openWebView(moduleId, pane.toJson(), profileKey);
    if (Object.isNull(answer))
      return null;
    const json = JsonReader.fromValue(answer);
    const view = WebViewInfo.fromJson(json.readObject(Resources.webViewViewField).toJson());
    const partition = json.readString(Resources.webViewPartitionField);
    if (!String.isNullOrWhitespace(partition))
      return { view, partition };
    this.bridge.closeWebView(moduleId, view.id);
    return null;
  }

  public async attachWebViewAsync(moduleId: string, view: string, contentsId: number): Promise<boolean> {
    const answer = await this.bridge.attachWebView(moduleId, view, contentsId);
    try {
      return JsonReader.fromValue(answer).readBoolean(Resources.webViewIsAttachedField);
    }
    catch {
      return false;
    }
  }

  public async navigateWebViewAsync(moduleId: string, view: string, url: string): Promise<WebViewNavigation | null> {
    const answer = await this.bridge.navigateWebView(moduleId, view, url);
    return Object.isNull(answer) ? null : WebViewNavigation.fromJson(answer);
  }

  public async actOnWebViewAsync(moduleId: string, view: string, action: WebViewAction): Promise<WebViewNavigation | null> {
    const answer = await this.bridge.actOnWebView(moduleId, view, action);
    return Object.isNull(answer) ? null : WebViewNavigation.fromJson(answer);
  }

  public async zoomWebViewAsync(moduleId: string, view: string, change: string | number | null): Promise<number | null> {
    const factor = await this.bridge.zoomWebView(moduleId, view, change);
    return Object.isNumber(factor) && Number.isFinite(factor) ? factor : null;
  }

  public async findInWebViewAsync(moduleId: string, view: string, request: string | JsonObject): Promise<IWebViewFound | null> {
    const found = await this.bridge.findInWebView(moduleId, view, request);
    try {
      const json = JsonReader.fromValue(found);
      if (json.hasField(Resources.webViewIsTimedOutField) && json.readBoolean(Resources.webViewIsTimedOutField))
        return { matches: 0, active: 0, isTimedOut: true, isEnded: false };
      if (json.hasField(Resources.webViewIsEndedField) && json.readBoolean(Resources.webViewIsEndedField))
        return { matches: 0, active: 0, isTimedOut: false, isEnded: true };
      return { matches: json.readInteger(Resources.webViewMatchesField), active: json.readInteger(Resources.webViewActiveField), isTimedOut: false, isEnded: false };
    }
    catch {
      return null;
    }
  }

  public closeWebView(moduleId: string, view: string): void {
    this.bridge.closeWebView(moduleId, view);
  }

  public keepWebView(moduleId: string, view: string): void {
    this.bridge.keepWebView(moduleId, view);
  }

  public expectWebView(moduleId: string, view: string): void {
    this.bridge.expectWebView(moduleId, view);
  }

  public setWebViewShortcuts(keys: readonly KeyChord[]): void {
    this.bridge.setWebViewShortcuts(keys.map(t => t.text));
  }

  public setAppShortcuts(shortcuts: readonly (readonly [KeyChord, string])[]): void {
    this.bridge.setAppShortcuts(new AppShortcutList(shortcuts.map(([key, command]) => new AppShortcut(key, command, false))).toJson());
  }

  public onWebViewEvent(listener: (event: WebViewEvent) => void): () => void {
    return this.bridge.onWebViewEvent(t => {
      const event = PreloadBridgeService.readWebViewEvent(t);
      if (!Object.isNull(event))
        listener(event);
    });
  }

  public onWebViewShortcut(listener: (event: KeyboardEvent) => void): () => void {
    return this.bridge.onWebViewShortcut(t => {
      const event = PreloadBridgeService.readKeyStroke(t);
      if (!Object.isNull(event))
        listener(event);
    });
  }

  public onWebViewInput(listener: (input: IWebViewInput) => void): () => void {
    return this.bridge.onWebViewInput(t => {
      const input = PreloadBridgeService.readWebViewInput(t);
      if (!Object.isNull(input))
        listener(input);
    });
  }

  public releaseWebViewFocus(moduleId: string, view: string): void {
    this.bridge.releaseWebViewFocus(moduleId, view);
  }

  public logModule(moduleId: string, message: string): void {
    this.bridge.logModule(moduleId, message);
  }

  public logError(moduleId: string | null, text: string): void {
    this.bridge.logError(moduleId, text);
  }

  private listenToEvents(): void {
    this.stopEvents ??= this.bridge.onEvent((name, payload) => this.receiveEvent(name, payload));
  }

  private stopListening(remove: () => void): void {
    remove();
    if (this.eventListeners.size > 0 || this.namedEventListeners.size > 0)
      return;
    this.stopEvents?.();
    this.stopEvents = null;
  }

  private receiveEvent(name: string, payload: unknown): void {
    const listeners = [...this.eventListeners];
    const named = [...this.namedEventListeners.get(name) ?? []];
    if (listeners.length === 0 && named.length === 0)
      return;
    const value = JsonReader.toJsonValue(payload);
    for (const listener of listeners)
      listener(name, value);
    for (const listener of named)
      listener(value);
  }

  private static readWebViewEvent(value: unknown): WebViewEvent | null {
    try {
      return WebViewEvent.fromJson(value);
    }
    catch {
      return null;
    }
  }

  private static readKeyStroke(value: unknown): KeyboardEvent | null {
    try {
      const json = JsonReader.fromValue(value);
      return new KeyboardEvent(Resources.keyDownEvent, {
        key: json.readString(nameof<IKeyStroke>(t => t.key)),
        code: json.readString(nameof<IKeyStroke>(t => t.code)),
        ctrlKey: json.readBoolean(nameof<IKeyStroke>(t => t.ctrlKey)),
        altKey: json.readBoolean(nameof<IKeyStroke>(t => t.altKey)),
        shiftKey: json.readBoolean(nameof<IKeyStroke>(t => t.shiftKey)),
        metaKey: json.readBoolean(nameof<IKeyStroke>(t => t.metaKey)),
        cancelable: true
      });
    }
    catch {
      return null;
    }
  }

  private static readWebViewInput(value: unknown): IWebViewInput | null {
    try {
      const json = JsonReader.fromValue(value);
      return {
        module: json.readString(nameof<IWebViewInput>(t => t.module)),
        view: json.readString(nameof<IWebViewInput>(t => t.view)),
        kind: json.readOneOf(nameof<IWebViewInput>(t => t.kind), Object.values(WebViewInputKind))
      };
    }
    catch {
      return null;
    }
  }

  private static grantOptions(options: IFileGrantOptions, multiple: boolean | undefined): JsonObject {
    return {
      ...Object.isUndefined(options.lifetime) ? {} : { [Resources.lifetimeField]: options.lifetime },
      ...Object.isUndefined(multiple) ? {} : { [Resources.multipleField]: multiple }
    };
  }

  private static readAnswer(value: unknown): JsonValue {
    const answer = JsonReader.fromValue(value);
    if (!answer.hasField(Resources.failureField))
      return answer.readValue(Resources.payloadField);
    const failure = answer.readObject(Resources.failureField);
    const code = failure.readString(Resources.codeField);
    if (code === FailureCode.Disconnected)
      throw new RuntimeDisconnectedException(failure.readString(Resources.messageField));
    throw new RuntimeRequestException(
      code,
      failure.readString(Resources.messageField),
      failure.hasField(Resources.detailsField) ? failure.readObject(Resources.detailsField).toJson() : undefined);
  }

  private static find(): IPreloadBridge {
    const bridge: unknown = PreloadBridgeService.memberOf(globalThis, Resources.bridgeName);
    if (!PreloadBridgeService.isBridge(bridge))
      throw new PreloadBridgeException();
    return bridge;
  }

  private static isBridge(value: unknown): value is IPreloadBridge {
    return Object.isObject(value) &&
      Object.isString(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.platform))) &&
      Object.isString(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.processor))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.notifyReady))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.notifyAppearance))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onCloseRequest))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.answerClose))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onUpdateSaveRequest))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.answerUpdateSave))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.readStartup))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onStartup))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.actOnStartup))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.readLayout))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.writeLayout))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.request))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onEvent))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.readBuild))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.copyText))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.copyImage))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.openLogFolder))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.copyDetails))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.openLink))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.showInFolder))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.openFile))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.chooseFolder))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.chooseFilePath))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.saveFile))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.chooseFiles))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.grantFiles))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.installCommand))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.readUpdate))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onUpdate))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.actOnUpdate))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.keepAppearance))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.readSpelling))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.keepSpelling))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onFieldMenu))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.replaceMisspelling))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.addToDictionary))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onNotificationOpened))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onQuitQuestion))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.answerQuit))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.readTrayAvailable))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onTrayAvailable))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.readFullScreen))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onFullScreen))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.readMaximized))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onMaximized))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.actOnWindow))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.openWebView))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.attachWebView))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.navigateWebView))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.actOnWebView))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.zoomWebView))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.findInWebView))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.closeWebView))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.keepWebView))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.expectWebView))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.setWebViewShortcuts))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.setAppShortcuts))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onWebViewEvent))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onWebViewShortcut))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.onWebViewInput))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.releaseWebViewFocus))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.logModule))) &&
      Object.isFunction(PreloadBridgeService.memberOf(value, nameof<IPreloadBridge>(t => t.logError)));
  }

  private static memberOf(value: object, name: string): unknown {
    return PreloadBridgeService.hasMember(value, name) ? value[name] : undefined;
  }

  private static hasMember(value: object, name: string): value is Record<string, unknown> {
    return name in value;
  }
}
