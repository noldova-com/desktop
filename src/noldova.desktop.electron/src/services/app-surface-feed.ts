/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { AppShortcut, AppShortcutList, AppWindow, AppWindowList, FailureCode, KeyChord, MainWindow, type QualifiedName, type Response, ShellMethods } from "@noldova/desktop.protocol";
import { ShellCommands } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";

export class AppSurfaceFeed {
  private readonly platform: string;
  private readonly processId: number;
  private readonly send: (method: QualifiedName, payload: JsonObject) => Promise<Response>;
  private readonly log: (text: string) => void;
  private readonly windows: Map<number, AppWindow> = new Map();
  private readonly windowShortcuts: Map<number, readonly AppShortcut[]> = new Map();
  private readonly windowLooks: Map<number, MainWindow> = new Map();
  private readonly sent: Map<string, string> = new Map();
  private stopKey: KeyChord | null = null;
  private isConnected: boolean = false;

  public constructor(platform: string, processId: number, send: (method: QualifiedName, payload: JsonObject) => Promise<Response>, log: (text: string) => void) {
    this.platform = platform;
    this.processId = processId;
    this.send = send;
    this.log = log;
  }

  public get windowList(): AppWindowList {
    return new AppWindowList([...this.windows.values()]);
  }

  public get mainWindow(): MainWindow {
    const [first] = this.windows.keys();
    return this.windowLooks.get(first ?? 0) ?? new MainWindow(String.empty, false, false);
  }

  public get shortcutList(): AppShortcutList {
    const shortcuts: AppShortcut[] = [];
    const menuKeys = this.platform === Resources.macPlatform ? Resources.macMenuKeys.map(t => new AppShortcut(KeyChord.parse(t), null, false)) : [];
    const stop = Object.isNull(this.stopKey) ? [] : [new AppShortcut(this.stopKey, ShellCommands.stopAgentControl.text, true)];
    for (const shortcut of [...stop, ...[...this.windowShortcuts.values()].flat(), ...menuKeys])
      if (!shortcuts.some(t => t.key.isSameOn(shortcut.key, this.platform)))
        shortcuts.push(shortcut);
    return new AppShortcutList(shortcuts);
  }

  public openWindow(windowId: number, sourceId: string | null): void {
    this.windows.set(windowId, new AppWindow(Object.isNull(sourceId) ? null : AppSurfaceFeed.handleOf(sourceId), this.processId));
    this.flush();
  }

  public closeWindow(windowId: number): void {
    this.windows.delete(windowId);
    this.windowShortcuts.delete(windowId);
    this.windowLooks.delete(windowId);
    this.flush();
  }

  public describeWindow(windowId: number, title: string, isVisible: boolean, isPainted: boolean): void {
    if (!this.windows.has(windowId))
      return;
    this.windowLooks.set(windowId, new MainWindow(title, isVisible, isPainted));
    this.flush();
  }

  public receiveShortcuts(windowId: number, payload: unknown): void {
    if (!this.windows.has(windowId))
      return;
    try {
      this.windowShortcuts.set(windowId, AppShortcutList.fromJson(payload).shortcuts.map(t => new AppShortcut(t.key, t.command, false)));
    }
    catch (error) {
      this.log(Resources.formatAppShortcutsNotRead(String(error)));
      return;
    }
    this.flush();
  }

  public receiveStopKey(key: KeyChord | null): void {
    this.stopKey = key;
    this.flush();
  }

  public connect(): void {
    this.isConnected = true;
    this.sent.clear();
    this.flush();
  }

  public disconnect(): void {
    this.isConnected = false;
  }

  private flush(): void {
    if (!this.isConnected)
      return;
    this.offer(ShellMethods.appWindowsChanged, this.windowList.toJson());
    this.offer(ShellMethods.appShortcutsChanged, this.shortcutList.toJson());
    this.offer(ShellMethods.mainWindowChanged, this.mainWindow.toJson());
  }

  private offer(method: QualifiedName, payload: JsonObject): void {
    const text = JSON.stringify(payload);
    if (this.sent.get(method.text) === text)
      return;
    this.sent.set(method.text, text);
    void this.sendAsync(method, payload, text);
  }

  private async sendAsync(method: QualifiedName, payload: JsonObject, text: string): Promise<void> {
    const failure = (await this.send(method, payload)).failure;
    if (Object.isUndefined(failure))
      return;
    if (this.sent.get(method.text) === text)
      this.sent.delete(method.text);
    if (failure.code !== FailureCode.Disconnected)
      this.log(Resources.formatAppSurfaceNotSent(method.text, failure.message));
  }

  private static handleOf(sourceId: string): number | null {
    const parts = sourceId.split(Resources.mediaSourceSeparator);
    const handle = parts.length === Resources.mediaSourceParts && parts[0] === Resources.windowMediaSource ? Number(parts[1]) : 0;
    return Number.isSafeInteger(handle) && handle > 0 && String(handle) === parts[1] ? handle : null;
  }
}
