/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { pathToFileURL } from "node:url";

import type { AppDetailsOptions, BrowserWindowConstructorOptions, Rectangle, TitleBarOverlayOptions } from "electron";

import type { IMainProcessWindow } from "@noldova/desktop.electron";

import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { FakeWindowContents } from "./fake-window-contents.fixture.js";
import { FakeWindowSession } from "./fake-window-session.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeMainProcessWindow implements IMainProcessWindow {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();

  public readonly id: number;
  public readonly options: BrowserWindowConstructorOptions;
  public readonly webContents: FakeWindowContents;
  public readonly calls: string[] = [];
  public loadedFile: string | null = null;
  public backgroundColor: string | null = null;
  public overlay: TitleBarOverlayOptions | null = null;
  public appDetails: AppDetailsOptions | null = null;
  public readonly icons: string[] = [];
  public isShown: boolean = false;
  public isGone: boolean = false;
  public isMinimizedNow: boolean = false;
  public isFocusedNow: boolean = false;
  public isMaximizedNow: boolean = false;
  public isFullScreenNow: boolean = false;
  public bounds: Rectangle = { x: 100, y: 80, width: 1280, height: 800 };
  public boundsReads: number = 0;
  public mediaSourceId: string;
  public mediaSourceReads: number = 0;
  public title: string = "Electron";

  public constructor(options: BrowserWindowConstructorOptions, contentsId: number, session: FakeWindowSession = new FakeWindowSession(), id: number = contentsId) {
    this.id = id;
    this.options = options;
    this.webContents = new FakeWindowContents(contentsId, session);
    this.mediaSourceId = `window:${String(contentsId * 1000)}:0`;
  }

  public loadFile(filePath: string): Promise<void> {
    this.loadedFile = filePath;
    this.webContents.url = pathToFileURL(filePath).href;
    return Promise.resolve();
  }

  public setBackgroundColor(color: string): void {
    this.backgroundColor = color;
  }

  public setAppDetails(options: AppDetailsOptions): void {
    this.appDetails = options;
  }

  public setIcon(iconPath: string): void {
    this.icons.push(iconPath);
  }

  public setTitleBarOverlay(options: TitleBarOverlayOptions): void {
    this.overlay = options;
  }

  public getNormalBounds(): Rectangle {
    this.boundsReads++;
    return { ...this.bounds };
  }

  public getMediaSourceId(): string {
    this.mediaSourceReads++;
    return this.mediaSourceId;
  }

  public getTitle(): string {
    return this.title;
  }

  public setPageTitle(title: string): void {
    this.listeners.emit("page-title-updated", new FakePreventableEvent(), title);
    this.title = title;
  }

  public hide(): void {
    this.isShown = false;
    this.listeners.emit("hide");
  }

  public setBounds(bounds: Partial<Rectangle>): void {
    this.calls.push(`setBounds ${JSON.stringify(bounds)}`);
    this.bounds = { ...this.bounds, ...bounds };
  }

  public isMaximized(): boolean {
    return this.isMaximizedNow;
  }

  public isFullScreen(): boolean {
    return this.isFullScreenNow;
  }

  public maximize(): void {
    this.calls.push("maximize");
    this.isMaximizedNow = true;
    if (this.isShown)
      return;
    this.isShown = true;
    this.listeners.emit("show");
  }

  public unmaximize(): void {
    this.calls.push("unmaximize");
    this.isMaximizedNow = false;
  }

  public minimize(): void {
    this.calls.push("minimize");
    this.isMinimizedNow = true;
  }

  public change(event: string): void {
    this.listeners.emit(event);
  }

  public isVisible(): boolean {
    return this.isShown;
  }

  public isDestroyed(): boolean {
    return this.isGone;
  }

  public isMinimized(): boolean {
    return this.isMinimizedNow;
  }

  public isFocused(): boolean {
    return this.isFocusedNow;
  }

  public show(): void {
    this.calls.push("show");
    this.isShown = true;
    this.listeners.emit("show");
  }

  public restore(): void {
    this.calls.push("restore");
  }

  public focus(): void {
    this.calls.push("focus");
  }

  public gainFocus(): void {
    this.isFocusedNow = true;
    this.listeners.emit("focus");
  }
  public close(): void {
    this.calls.push("close");
    const event = new FakePreventableEvent();
    this.listeners.emit("close", event);
    if (!event.isPrevented)
      this.destroy();
  }

  public on(event: string, listener: (...values: never[]) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public once(event: string, listener: (...values: never[]) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public destroy(): void {
    this.isGone = true;
    this.listeners.emit("closed");
  }
}
