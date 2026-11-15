/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import electron = require("electron");
import type { IpcRendererEvent } from "electron";

import type { IPreloadChannels } from "./interfaces/i-preload-channels.js";
import type { IPreloadSettings } from "./interfaces/i-preload-settings.js";

class Preload {
  private static readonly SETTINGS_ARGUMENT: string = "--desktop-preload=";
  private static readonly SETTINGS_MISSING: string = "The window was opened without its preload settings.";
  private static readonly SETTINGS_NOT_OBJECT: string = "The window's preload settings are not an object: ";
  private static readonly SETTING_MISSING: string = "The window's preload settings have no valid ";
  private static readonly REPLY_NOT_BOOLEAN: string = "The main process answered with something other than true or false on ";
  private static readonly FILE_REFUSED: string = "A file could not be offered, because its path could not be read: ";
  private static readonly PAGE_BYTES: number = 16;
  private static readonly HEX_RADIX: number = 16;
  private static readonly HEX_WIDTH: number = 2;
  private static readonly HEX_PAD: string = "0";

  private readonly bridge: string;
  private readonly pastedByteLimit: number;
  private readonly appearance: unknown;
  private readonly channels: ReadonlyMap<string, unknown>;
  private readonly page: string;

  public constructor(argv: readonly string[]) {
    const settings = Preload.readSettings(argv);
    this.bridge = Preload.readText(settings, "bridge");
    this.pastedByteLimit = Preload.readCount(settings, "pastedByteLimit");
    this.appearance = settings.get("appearance" satisfies keyof IPreloadSettings) ?? null;
    this.channels = Preload.toMap(settings.get("channels" satisfies keyof IPreloadSettings), Preload.SETTINGS_ARGUMENT);
    this.page = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(Preload.PAGE_BYTES)),
      t => t.toString(Preload.HEX_RADIX).padStart(Preload.HEX_WIDTH, Preload.HEX_PAD)).join("");
  }

  public expose(): void {
    this.send("page", this.page);
    electron.contextBridge.exposeInMainWorld(this.bridge, {
      platform: process.platform,
      processor: process.arch,
      appearance: this.appearance,
      notifyReady: (appearance: unknown): void => this.send("ready", appearance),
      notifyAppearance: (appearance: unknown): void => this.send("appearance", appearance),
      onCloseRequest: (listener: (requestId: string) => void): (() => void) => this.listen("closeRequest", listener),
      answerClose: (requestId: string, isSaved: boolean): Promise<boolean> => this.askAsync("closeAnswer", requestId, isSaved),
      onUpdateSaveRequest: (listener: (requestId: string) => void): (() => void) => this.listen("updateSaveRequest", listener),
      answerUpdateSave: (requestId: string, problems: readonly string[]): Promise<boolean> => this.askAsync("updateSaveAnswer", requestId, problems),
      readStartup: (): Promise<unknown> => this.invokeAsync("readStartup"),
      onStartup: (listener: (state: unknown) => void): (() => void) => this.listen("startupState", listener),
      actOnStartup: (action: string): Promise<boolean> => this.askAsync("startupAction", action),
      readLayout: (): Promise<unknown> => this.invokeAsync("readLayout"),
      writeLayout: (layout: unknown): Promise<unknown> => this.invokeAsync("writeLayout", layout),
      request: (method: string, payload: unknown): Promise<unknown> => this.invokeAsync("request", method, payload, this.page),
      onEvent: (listener: (name: string, payload: unknown) => void): (() => void) => this.listen("runtimeEvent", listener),
      readBuild: (): Promise<unknown> => this.invokeAsync("readBuild"),
      copyText: (text: string): Promise<boolean> => this.askAsync("copyText", text),
      copyImage: (bytes: Uint8Array): Promise<boolean> => this.askAsync("copyImage", bytes),
      openLogFolder: (): Promise<boolean> => this.askAsync("openLogFolder"),
      copyDetails: (text: string): Promise<boolean> => this.askAsync("copyDetails", text),
      openLink: (url: string): Promise<boolean> => this.askAsync("openLink", url),
      showInFolder: (path: string): Promise<unknown> => this.invokeAsync("showInFolder", path),
      openFile: (path: string): Promise<unknown> => this.invokeAsync("openFile", path),
      chooseFolder: (): Promise<unknown> => this.invokeAsync("chooseFolder"),
      chooseFilePath: (options: unknown): Promise<unknown> => this.invokeAsync("chooseFilePath", options),
      saveFile: (name: string, bytes: Uint8Array): Promise<unknown> => this.invokeAsync("saveFile", name, bytes),
      chooseFiles: (moduleId: string, options: unknown): Promise<unknown> => this.invokeAsync("chooseFiles", moduleId, options, this.page),
      grantFiles: (moduleId: string, files: readonly File[], options: unknown): Promise<unknown> => this.grantFilesAsync(moduleId, files, options),
      installCommand: (): Promise<boolean> => this.askAsync("installCommand"),
      readUpdate: (): Promise<unknown> => this.invokeAsync("readUpdate"),
      onUpdate: (listener: (state: unknown) => void): (() => void) => this.listen("updateState", listener),
      actOnUpdate: (action: string): Promise<boolean> => this.askAsync("updateAction", action),
      keepAppearance: (preferences: unknown): void => this.send("keepAppearance", preferences),
      readSpelling: (): Promise<unknown> => this.invokeAsync("readSpelling"),
      keepSpelling: (isChecking: boolean, languages: readonly string[]): void => this.send("spelling", isChecking, languages),
      onFieldMenu: (listener: (request: unknown) => void): (() => void) => this.listen("fieldMenu", listener),
      replaceMisspelling: (text: string): Promise<boolean> => this.askAsync("replaceMisspelling", text),
      addToDictionary: (word: string): Promise<boolean> => this.askAsync("addToDictionary", word),
      edit: (action: string): Promise<boolean> => this.askAsync("edit", action),
      setMenuBar: (menuBar: unknown): void => this.send("menuBar", menuBar),
      onMenuCommand: (listener: (id: string) => void): (() => void) => this.listen("menuCommand", listener),
      onNotificationOpened: (listener: (id: string) => void): (() => void) => this.listen("notificationOpened", listener),
      onQuitQuestion: (listener: (question: unknown) => void): (() => void) => this.listen("quitQuestion", listener),
      answerQuit: (choice: string): Promise<boolean> => this.askAsync("quitAnswer", choice),
      readTrayAvailable: (): Promise<unknown> => this.invokeAsync("readTrayAvailable"),
      onTrayAvailable: (listener: (isAvailable: boolean) => void): (() => void) => this.listen("trayAvailable", listener),
      readFullScreen: (): Promise<unknown> => this.invokeAsync("readFullScreen"),
      onFullScreen: (listener: (isFullScreen: boolean) => void): (() => void) => this.listen("fullScreen", listener),
      readMaximized: (): Promise<unknown> => this.invokeAsync("readMaximized"),
      onMaximized: (listener: (isMaximized: boolean) => void): (() => void) => this.listen("maximized", listener),
      actOnWindow: (action: string): Promise<unknown> => this.invokeAsync("windowAction", action),
      openWebView: (moduleId: string, pane: unknown, profileKey: string): Promise<unknown> => this.invokeAsync("webViewOpen", moduleId, pane, profileKey),
      attachWebView: (moduleId: string, view: string, contentsId: number): Promise<unknown> => this.invokeAsync("webViewAttach", moduleId, view, contentsId),
      navigateWebView: (moduleId: string, view: string, url: string): Promise<unknown> => this.invokeAsync("webViewNavigate", moduleId, view, url),
      actOnWebView: (moduleId: string, view: string, action: string): Promise<unknown> => this.invokeAsync("webViewAct", moduleId, view, action),
      zoomWebView: (moduleId: string, view: string, change: unknown): Promise<unknown> => this.invokeAsync("webViewZoom", moduleId, view, change),
      findInWebView: (moduleId: string, view: string, request: unknown): Promise<unknown> => this.invokeAsync("webViewFind", moduleId, view, request),
      closeWebView: (moduleId: string, view: string): void => this.send("webViewClose", moduleId, view),
      keepWebView: (moduleId: string, view: string): unknown => this.sendSync("webViewKeep", moduleId, view),
      expectWebView: (moduleId: string, view: string): unknown => this.sendSync("webViewExpect", moduleId, view),
      setWebViewShortcuts: (keys: readonly string[]): void => this.send("webViewShortcuts", keys),
      setAppShortcuts: (shortcuts: unknown): void => this.send("appShortcuts", shortcuts),
      onWebViewEvent: (listener: (event: unknown) => void): (() => void) => this.listen("webViewEvent", listener),
      onWebViewShortcut: (listener: (stroke: unknown) => void): (() => void) => this.listen("webViewShortcut", listener),
      onWebViewInput: (listener: (input: unknown) => void): (() => void) => this.listen("webViewInput", listener),
      releaseWebViewFocus: (moduleId: string, view: string): void => this.send("webViewFocusRelease", moduleId, view),
      logModule: (moduleId: string, message: string): void => this.send("moduleLog", moduleId, message),
      logError: (moduleId: string | null, text: string): void => this.send("windowError", moduleId, text)
    });
  }

  private static toMap(value: unknown, name: string): ReadonlyMap<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new TypeError(`${Preload.SETTINGS_NOT_OBJECT}${name}`);
    return new Map<string, unknown>(Object.entries(value));
  }

  private static readSettings(argv: readonly string[]): ReadonlyMap<string, unknown> {
    const argument = argv.find(t => t.startsWith(Preload.SETTINGS_ARGUMENT));
    if (argument === undefined)
      throw new Error(Preload.SETTINGS_MISSING);
    const value: unknown = JSON.parse(argument.slice(Preload.SETTINGS_ARGUMENT.length));
    return Preload.toMap(value, Preload.SETTINGS_ARGUMENT);
  }

  private static readText(values: ReadonlyMap<string, unknown>, name: keyof IPreloadSettings | keyof IPreloadChannels): string {
    const value = values.get(name);
    if (typeof value !== "string" || value.length === 0)
      throw new TypeError(`${Preload.SETTING_MISSING}${name}`);
    return value;
  }

  private static readCount(values: ReadonlyMap<string, unknown>, name: keyof IPreloadSettings): number {
    const value = values.get(name);
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      throw new TypeError(`${Preload.SETTING_MISSING}${name}`);
    return value;
  }

  private channel(name: keyof IPreloadChannels): string {
    return Preload.readText(this.channels, name);
  }

  private send(name: keyof IPreloadChannels, ...values: unknown[]): void {
    electron.ipcRenderer.send(this.channel(name), ...values);
  }

  private sendSync(name: keyof IPreloadChannels, ...values: unknown[]): unknown {
    return electron.ipcRenderer.sendSync(this.channel(name), ...values);
  }

  private invokeAsync(name: keyof IPreloadChannels, ...values: unknown[]): Promise<unknown> {
    return electron.ipcRenderer.invoke(this.channel(name), ...values);
  }

  private async askAsync(name: keyof IPreloadChannels, ...values: unknown[]): Promise<boolean> {
    const reply = await this.invokeAsync(name, ...values);
    if (typeof reply !== "boolean")
      throw new TypeError(`${Preload.REPLY_NOT_BOOLEAN}${this.channel(name)}`);
    return reply;
  }

  private listen<T extends unknown[]>(name: keyof IPreloadChannels, listener: (...values: T) => void): () => void {
    const listened = this.channel(name);
    const handler = (_event: IpcRendererEvent, ...values: T): void => listener(...values);
    electron.ipcRenderer.on(listened, handler);
    return () => electron.ipcRenderer.removeListener(listened, handler);
  }

  private async offerAsync(file: File, take: (size: number) => boolean): Promise<unknown> {
    let path: string;
    try {
      path = electron.webUtils.getPathForFile(file);
    }
    catch (error: unknown) {
      if (!(error instanceof TypeError))
        throw error;
      this.send("windowError", null, `${Preload.FILE_REFUSED}${error.message}`);
      return null;
    }
    if (path.length > 0)
      return { name: file.name, type: file.type, path, size: file.size };
    if (!take(file.size))
      return { name: file.name, type: file.type, size: file.size };
    return { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()), size: file.size };
  }

  private async grantFilesAsync(moduleId: string, files: readonly File[], options: unknown): Promise<unknown> {
    let pasted = 0;
    const take = (size: number): boolean => {
      if (pasted + size > this.pastedByteLimit)
        return false;
      pasted += size;
      return true;
    };
    return this.invokeAsync("grantFiles", moduleId, await Promise.all(Array.from(files, t => this.offerAsync(t, take))), options, this.page);
  }
}

new Preload(process.argv).expose();
