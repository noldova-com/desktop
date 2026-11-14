/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventEmitter } from "node:events";

import type { KeyboardInputEvent, NavigationHistory, WebContents, WindowOpenHandlerResponse } from "electron";

import type { IWebViewContents } from "../interfaces/i-web-view-contents.js";
import type { IWebViewDebugger } from "../interfaces/i-web-view-debugger.js";
import type { IWebViewKeyEvent } from "../interfaces/i-web-view-key-event.js";
import type { IWindowOpenDetails } from "../interfaces/i-window-open-details.js";

export class ElectronWebViewContents implements IWebViewContents {
  private readonly page: WebContents;
  private readonly history: NavigationHistory;
  private readonly events: EventEmitter;

  public readonly id: number;
  public readonly debugger: IWebViewDebugger;

  public constructor(page: WebContents) {
    this.page = page;
    this.history = page.navigationHistory;
    this.events = page;
    this.id = page.id;
    this.debugger = page.debugger;
  }

  public loadURL(url: string): Promise<void> {
    return this.page.loadURL(url);
  }

  public getURL(): string {
    return this.page.getURL();
  }

  public getTitle(): string {
    return this.page.getTitle();
  }

  public isLoading(): boolean {
    return this.page.isLoading();
  }

  public isDestroyed(): boolean {
    return this.page.isDestroyed();
  }

  public canGoBack(): boolean {
    return this.history.canGoBack();
  }

  public canGoForward(): boolean {
    return this.history.canGoForward();
  }

  public readHistoryEntry(offset: number): string | null {
    const index = this.history.getActiveIndex() + offset;
    return index >= 0 && index < this.history.length() ? this.history.getEntryAtIndex(index).url : null;
  }

  public goBack(): void {
    this.history.goBack();
  }

  public goForward(): void {
    this.history.goForward();
  }

  public reload(): void {
    this.page.reload();
  }

  public stop(): void {
    this.page.stop();
  }

  public setWindowOpenHandler(handler: (details: IWindowOpenDetails) => WindowOpenHandlerResponse): void {
    this.page.setWindowOpenHandler(handler);
  }

  public setWebRTCIPHandlingPolicy(policy: "disable_non_proxied_udp"): void {
    this.page.setWebRTCIPHandlingPolicy(policy);
  }

  public getZoomFactor(): number {
    return this.page.getZoomFactor();
  }

  public setZoomFactor(factor: number): void {
    this.page.setZoomFactor(factor);
  }

  public findInPage(text: string, options: { readonly forward: boolean; readonly findNext: boolean; readonly matchCase: boolean }): number {
    return this.page.findInPage(text, options);
  }

  public stopFindInPage(action: "clearSelection"): void {
    this.page.stopFindInPage(action);
  }

  public sendInputEvent(event: IWebViewKeyEvent): void {
    this.page.sendInputEvent({ type: event.type, keyCode: event.keyCode, modifiers: [...event.modifiers] as NonNullable<KeyboardInputEvent["modifiers"]> });
  }

  public insertText(text: string): Promise<void> {
    return this.page.insertText(text);
  }

  public on<TValues extends unknown[]>(event: string, listener: (...values: TValues) => void): unknown {
    return this.events.on(event, listener);
  }
}
