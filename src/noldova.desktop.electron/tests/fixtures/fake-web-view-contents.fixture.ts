/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { WindowOpenHandlerResponse } from "electron";
import { type IWebViewContents, type IWebViewFrame, type IWebViewKeyEvent, type IWindowOpenDetails, WebViewHistory } from "@noldova/desktop.electron";

import { FakeFrameNavigation } from "./fake-frame-navigation.fixture.js";
import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { FakeWebViewDebugger } from "./fake-web-view-debugger.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeWebViewContents implements IWebViewContents {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private openHandler: ((details: IWindowOpenDetails) => WindowOpenHandlerResponse) | null = null;
  private begin: () => void = () => undefined;
  public readonly id: number;
  public readonly debugger: FakeWebViewDebugger = new FakeWebViewDebugger();
  public readonly calls: string[] = [];
  public readonly started: Promise<void> = new Promise(resolve => {
    this.begin = resolve;
  });
  public url: string = String.empty;
  public title: string = String.empty;
  public loading: boolean = false;
  public destroyed: boolean = false;
  public history: string[] = [];
  public index: number = -1;
  public rtcPolicy: string | null = null;
  public loadFailure: Error | null = null;
  public restoreAnswer: () => Promise<void> = () => Promise.resolve();
  public restoredUrl: string | null = null;
  public findRequest: number = 0;
  public zoomFactor: number = 1;
  public readonly inputs: IWebViewKeyEvent[] = [];
  public readonly texts: string[] = [];
  public readonly isolated: string[] = [];
  public onInput: (event: IWebViewKeyEvent) => void = () => undefined;
  public onText: (text: string) => Promise<void> = () => Promise.resolve();
  public onIsolated: () => Promise<unknown> = () => Promise.resolve(0);
  public frameCount: number = 1;
  public onFrame: (index: number) => Promise<unknown> = () => Promise.resolve(0);
  public detachedFrames: readonly number[] = [];

  public constructor(id: number) {
    this.id = id;
  }

  public get mainFrame(): { readonly framesInSubtree: readonly IWebViewFrame[] } {
    return { framesInSubtree: Array.from({ length: this.frameCount }, (_, index) => this.frame(index)) };
  }

  public loadURL(url: string): Promise<void> {
    this.calls.push(`load ${url}`);
    this.begin();
    return Object.isNull(this.loadFailure) ? Promise.resolve() : Promise.reject(this.loadFailure);
  }

  public getURL(): string {
    return this.url;
  }

  public getTitle(): string {
    return this.title;
  }

  public isLoading(): boolean {
    return this.loading;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public canGoBack(): boolean {
    return this.index > 0;
  }

  public canGoForward(): boolean {
    return this.index < this.history.length - 1;
  }

  public readHistoryEntry(offset: number): string | null {
    return this.history[this.index + offset] ?? null;
  }

  public readHistory(): WebViewHistory {
    return new WebViewHistory(this.history.map(t => ({ url: t, title: String.empty, pageState: `state of ${t}` })), this.index);
  }

  public restoreHistoryAsync(history: WebViewHistory): Promise<void> {
    this.calls.push(`restore ${history.index} ${history.entries.map(t => `${t.url} ${t.pageState ?? String.empty}`).join(" ")}`);
    this.begin();
    return this.restoreAnswer().then(() => {
      this.url = this.restoredUrl ?? history.currentUrl ?? String.empty;
      this.history = history.entries.map(t => t.url);
      this.index = history.index;
    });
  }

  public goBack(): void {
    this.calls.push("back");
  }

  public goForward(): void {
    this.calls.push("forward");
  }

  public reload(): void {
    this.calls.push("reload");
  }

  public stop(): void {
    this.calls.push("stop");
  }

  public setWindowOpenHandler(handler: (details: IWindowOpenDetails) => WindowOpenHandlerResponse): void {
    this.openHandler = handler;
  }

  public setWebRTCIPHandlingPolicy(policy: "disable_non_proxied_udp"): void {
    this.rtcPolicy = policy;
  }

  public getZoomFactor(): number {
    return this.zoomFactor;
  }

  public setZoomFactor(factor: number): void {
    this.zoomFactor = factor;
    this.calls.push(`zoom ${factor}`);
  }

  public findInPage(text: string, options: { readonly forward: boolean; readonly findNext: boolean; readonly matchCase: boolean }): number {
    this.findRequest += 1;
    this.calls.push(`find ${this.findRequest} ${text} ${options.forward} ${options.findNext} ${options.matchCase}`);
    return this.findRequest;
  }

  public stopFindInPage(action: "clearSelection"): void {
    this.calls.push(`stop find ${action}`);
  }

  public sendInputEvent(event: IWebViewKeyEvent): void {
    this.inputs.push(event);
    this.onInput(event);
  }

  public insertText(text: string): Promise<void> {
    this.texts.push(text);
    return this.onText(text);
  }

  public executeJavaScriptInIsolatedWorld(worldId: number, scripts: { code: string }[]): Promise<unknown> {
    this.isolated.push(`${worldId} ${scripts.map(t => t.code).join(";")}`);
    return this.onIsolated();
  }

  public on(event: string, listener: (...values: never[]) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public emit(event: string, ...values: unknown[]): void {
    this.listeners.emit(event, ...values);
  }

  public prevent(event: string, ...values: unknown[]): boolean {
    const preventable = new FakePreventableEvent();
    this.listeners.emit(event, preventable, ...values);
    return preventable.isPrevented;
  }

  public navigateFrame(url: string, isMainFrame: boolean): boolean {
    const navigation = new FakeFrameNavigation(url, isMainFrame);
    this.listeners.emit("will-frame-navigate", navigation, url, false, isMainFrame);
    return navigation.isPrevented;
  }

  public openWindow(url: string, referrer: string = String.empty, disposition: string | null = "foreground-tab"): WindowOpenHandlerResponse | undefined {
    return this.openHandler?.({ url, referrer: { url: referrer }, ...Object.isNull(disposition) ? {} : { disposition } });
  }

  public show(url: string, title: string = String.empty): void {
    this.url = url;
    this.title = title;
    this.history = [...this.history.slice(0, this.index + 1), url];
    this.index = this.history.length - 1;
    this.emit("did-navigate");
  }

  private frame(index: number): IWebViewFrame {
    const isDetached = (): boolean => this.detachedFrames.includes(index);
    return {
      get detached(): boolean {
        return isDetached();
      },
      isDestroyed: () => this.destroyed,
      executeJavaScript: () => this.onFrame(index)
    };
  }
}
